import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotencyRecord, setIdempotencyRecord } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const idempotencyRecordKey = idempotencyKey
    ? `confirm:${idempotencyKey}`
    : null;

  if (idempotencyRecordKey) {
    const cached = await getIdempotencyRecord(idempotencyRecordKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          expiresAt: Date;
          productId: string;
          warehouseId: string;
          quantity: number;
        }>
      >`
        SELECT id, status, "expiresAt", "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        return { ok: false, status: 404, error: "Reservation not found" } as const;
      }

      const reservation = reservations[0];

      if (reservation.status === "CONFIRMED") {
        if (!idempotencyRecordKey) {
          return {
            ok: false,
            status: 409,
            error: "Reservation already confirmed",
          } as const;
        }

        const existing = await tx.reservation.findUnique({
          where: { id },
          include: {
            product: {
              select: { id: true, name: true, sku: true, price: true, imageUrl: true },
            },
            warehouse: {
              select: { id: true, name: true, location: true },
            },
          },
        });

        return { ok: true, reservation: existing! } as const;
      }

      if (reservation.status === "RELEASED") {
        return {
          ok: false,
          status: 410,
          error: "Reservation has already been released",
        } as const;
      }

      if (new Date(reservation.expiresAt) <= new Date()) {
        const releasedInventory = await tx.inventory.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
            reservedUnits: { gte: reservation.quantity },
          },
          data: { reservedUnits: { decrement: reservation.quantity } },
        });

        if (releasedInventory.count !== 1) {
          throw new Error(
            `Inventory invariant violation while expiring reservation ${id}`
          );
        }

        await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });

        return { ok: false, status: 410, error: "Reservation has expired" } as const;
      }

      const confirmedInventory = await tx.inventory.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          reservedUnits: { gte: reservation.quantity },
          totalUnits: { gte: reservation.quantity },
        },
        data: {
          reservedUnits: { decrement: reservation.quantity },
          totalUnits: { decrement: reservation.quantity },
        },
      });

      if (confirmedInventory.count !== 1) {
        throw new Error(
          `Inventory invariant violation while confirming reservation ${id}`
        );
      }

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: {
          product: {
            select: { id: true, name: true, sku: true, price: true, imageUrl: true },
          },
          warehouse: {
            select: { id: true, name: true, location: true },
          },
        },
      });

      return { ok: true, reservation: updated } as const;
    });

    if (!result.ok) {
      const body = { error: result.error };
      if (idempotencyRecordKey) {
        await setIdempotencyRecord(idempotencyRecordKey, result.status, body);
      }
      return NextResponse.json(body, { status: result.status });
    }

    const body = {
      ...result.reservation,
      expiresAt: result.reservation.expiresAt.toISOString(),
      createdAt: result.reservation.createdAt.toISOString(),
      updatedAt: result.reservation.updatedAt.toISOString(),
      product: {
        ...result.reservation.product,
        price: result.reservation.product.price.toString(),
      },
    };

    if (idempotencyRecordKey) {
      await setIdempotencyRecord(idempotencyRecordKey, 200, body);
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("POST /api/reservations/:id/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
