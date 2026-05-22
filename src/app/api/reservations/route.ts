import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateReservationSchema } from "@/lib/schemas";
import {
  acquireLock,
  releaseLock,
  getIdempotencyRecord,
  setIdempotencyRecord,
} from "@/lib/redis";

export const dynamic = "force-dynamic";

const RESERVATION_TTL_MINUTES = 10;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const idempotencyRecordKey = idempotencyKey
    ? `reserve:${idempotencyKey}`
    : null;

  if (idempotencyRecordKey) {
    const cached = await getIdempotencyRecord(idempotencyRecordKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const lockKey = `inventory:${productId}:${warehouseId}`;
  const lockAcquired = await acquireLock(lockKey, 30000);

  if (!lockAcquired) {
    return NextResponse.json(
      { error: "Another reservation is in progress for this item. Please retry." },
      { status: 429 }
    );
  }

  try {
    if (idempotencyRecordKey) {
      const cached = await getIdempotencyRecord(idempotencyRecordKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.statusCode });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const inventory = await tx.$queryRaw<
        Array<{
          id: string;
          totalUnits: number;
          reservedUnits: number;
        }>
      >`
        SELECT id, "totalUnits", "reservedUnits"
        FROM "Inventory"
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (inventory.length === 0) {
        return {
          ok: false,
          status: 404,
          error: "Product not found in this warehouse",
        } as const;
      }

      const inv = inventory[0];
      const available = inv.totalUnits - inv.reservedUnits;

      if (available < quantity) {
        return {
          ok: false,
          status: 409,
          error: `Insufficient stock. Requested ${quantity}, available ${available}.`,
        } as const;
      }

      await tx.inventory.update({
        where: { id: inv.id },
        data: { reservedUnits: { increment: quantity } },
      });

      const expiresAt = new Date(
        Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
      );

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              imageUrl: true,
            },
          },
          warehouse: {
            select: { id: true, name: true, location: true },
          },
        },
      });

      return { ok: true, reservation } as const;
    });

    if (!result.ok) {
      const response = { error: result.error };
      if (idempotencyRecordKey) {
        await setIdempotencyRecord(
          idempotencyRecordKey,
          result.status,
          response
        );
      }
      return NextResponse.json(response, { status: result.status });
    }

    const responseBody = {
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
      await setIdempotencyRecord(idempotencyRecordKey, 201, responseBody);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } finally {
    await releaseLock(lockKey);
  }
}
