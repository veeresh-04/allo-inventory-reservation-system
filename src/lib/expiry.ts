import { prisma } from "./prisma";

/**
 * Release all expired PENDING reservations and return the reserved units to inventory.
 * This is called:
 *  1. Lazily on every read of inventory (to keep available counts accurate)
 *  2. By the Vercel Cron job at /api/cron/release-expired
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<
      Array<{
        id: string;
        productId: string;
        warehouseId: string;
        quantity: number;
      }>
    >`
      UPDATE "Reservation"
      SET status = 'RELEASED', "updatedAt" = NOW()
      WHERE status = 'PENDING'
        AND "expiresAt" <= ${now}
      RETURNING id, "productId", "warehouseId", quantity
    `;

    if (expired.length === 0) return 0;

    for (const reservation of expired) {
      const updated = await tx.inventory.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          reservedUnits: { gte: reservation.quantity },
        },
        data: {
          reservedUnits: {
            decrement: reservation.quantity,
          },
        },
      });

      if (updated.count !== 1) {
        throw new Error(
          `Inventory invariant violation while releasing reservation ${reservation.id}`
        );
      }
    }

    return expired.length;
  });

  return result;
}
