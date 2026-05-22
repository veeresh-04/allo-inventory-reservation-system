import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import { ProductCard } from "@/components/ProductCard";
import { ReservationApiWarmup } from "@/components/ReservationApiWarmup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProducts() {
  try {
    await releaseExpiredReservations();
  } catch (error) {
    console.error("Lazy reservation expiry failed:", error);
  }

  return prisma.product.findMany({
    include: {
      inventory: {
        include: { warehouse: true },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });
}

export default async function ProductsPage() {
  const products = await getProducts();

  const totalAvailable = products.reduce(
    (sum, p) =>
      sum +
      p.inventory.reduce(
        (s, i) => s + Math.max(0, i.totalUnits - i.reservedUnits),
        0
      ),
    0
  );

  return (
    <div className="fade-in-up">
      <ReservationApiWarmup />

      {/* Page header */}
      <div className="mb-10 flex flex-col gap-2">
        <div className="flex items-baseline gap-4">
          <h1 className="font-syne font-extrabold text-4xl md:text-5xl tracking-tight">
            Products
          </h1>
          <span className="font-mono text-sm text-white/30 border border-white/10 rounded px-2 py-0.5">
            {products.length} SKUs
          </span>
        </div>
        <p className="text-white/40 font-mono text-sm">
          {totalAvailable} units available across 3 warehouses
        </p>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              description: product.description,
              sku: product.sku,
              price: product.price.toString(),
              imageUrl: product.imageUrl,
              inventory: product.inventory.map((inv) => ({
                id: inv.id,
                warehouseId: inv.warehouseId,
                warehouse: inv.warehouse,
                totalUnits: inv.totalUnits,
                reservedUnits: inv.reservedUnits,
                availableUnits: Math.max(0, inv.totalUnits - inv.reservedUnits),
              })),
            }}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
