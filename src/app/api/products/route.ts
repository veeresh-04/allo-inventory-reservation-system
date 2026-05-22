import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    try {
      await releaseExpiredReservations();
    } catch (error) {
      console.error("Lazy reservation expiry failed:", error);
    }

    const products = await prisma.product.findMany({
      include: {
        inventory: {
          include: {
            warehouse: true,
          },
          orderBy: {
            warehouse: { name: "asc" },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const response = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      inventory: product.inventory.map((inv) => ({
        id: inv.id,
        warehouseId: inv.warehouseId,
        warehouse: {
          id: inv.warehouse.id,
          name: inv.warehouse.name,
          location: inv.warehouse.location,
        },
        totalUnits: inv.totalUnits,
        reservedUnits: inv.reservedUnits,
        availableUnits: Math.max(0, inv.totalUnits - inv.reservedUnits),
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
