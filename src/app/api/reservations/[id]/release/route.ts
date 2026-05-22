import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          productId: string;
          warehouseId: string;
          quantity: number;
        }>
      >`
        SELECT id, status, "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        return { ok: false, status: 404, error: "Reservation not found" } as const;
      }

      const reservation = reservations[0];

      if (reservation.status === "CONFIRMED") {
        return {
          ok: false,
          status: 409,
          error: "Cannot release a confirmed reservation",
        } as const;
      }

      if (reservation.status === "PENDING") {
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
            `Inventory invariant violation while releasing reservation ${id}`
          );
        }

        await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });
      }

      const updated = await tx.reservation.findUnique({
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

      return { ok: true, reservation: updated! } as const;
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ...result.reservation,
      expiresAt: result.reservation.expiresAt.toISOString(),
      createdAt: result.reservation.createdAt.toISOString(),
      updatedAt: result.reservation.updatedAt.toISOString(),
      product: {
        ...result.reservation.product,
        price: result.reservation.product.price.toString(),
      },
    });
  } catch (error) {
    console.error("POST /api/reservations/:id/release error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
