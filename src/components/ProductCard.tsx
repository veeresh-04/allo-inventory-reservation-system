"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, MapPin, Package, Zap } from "lucide-react";
import { ProductWithInventory } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductWithInventory;
  index: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    product.inventory.find((i) => i.availableUnits > 0)?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const selectedInventory = product.inventory.find(
    (i) => i.warehouseId === selectedWarehouse
  );
  const maxQty = selectedInventory?.availableUnits ?? 0;
  const totalAvailable = product.inventory.reduce(
    (sum, item) => sum + item.availableUnits,
    0
  );

  async function handleReserve() {
    if (!selectedWarehouse || maxQty === 0) return;
    setLoading(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${product.id}-${selectedWarehouse}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast({
          variant: "destructive",
          title: "Insufficient stock",
          description: data.error,
        });
        return;
      }

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Reservation failed",
          description: data.error ?? "Something went wrong.",
        });
        return;
      }

      toast({
        variant: "success",
        title: "Reserved",
        description: `${quantity}x ${product.name} held for 10 minutes.`,
      });

      router.push(`/reservations/${data.id}`);
    } catch {
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not connect to the server.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="group relative bg-[#141414] border border-white/8 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative h-44 overflow-hidden bg-[#1C1C1C]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-white/20" />
          </div>
        )}

        <div className="absolute top-3 right-3">
          {totalAvailable === 0 ? (
            <span className="font-mono text-xs bg-red-950/90 text-red-400 border border-red-500/30 px-2 py-1 rounded">
              OUT OF STOCK
            </span>
          ) : totalAvailable <= 3 ? (
            <span className="font-mono text-xs bg-orange-950/90 text-orange-400 border border-orange-500/30 px-2 py-1 rounded">
              LOW: {totalAvailable} LEFT
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-3 left-3">
          <span className="font-mono text-[10px] bg-black/60 text-white/50 px-2 py-0.5 rounded backdrop-blur-sm">
            {product.sku}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-syne font-bold text-base leading-tight">
            {product.name}
          </h3>
          <span className="font-mono text-[#E8FF47] font-bold text-sm shrink-0">
            {formatCurrency(product.price)}
          </span>
        </div>

        {product.description && (
          <p className="text-white/40 text-xs leading-relaxed mb-4 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="space-y-1.5 mb-4">
          {product.inventory.map((inv) => (
            <button
              key={inv.warehouseId}
              onClick={() => {
                if (inv.availableUnits > 0) {
                  setSelectedWarehouse(inv.warehouseId);
                  setQuantity(1);
                }
              }}
              disabled={inv.availableUnits === 0}
              className={cn(
                "w-full flex items-center justify-between rounded-md px-3 py-2 text-xs transition-all border",
                selectedWarehouse === inv.warehouseId
                  ? "bg-[#E8FF47]/10 border-[#E8FF47]/30 text-white"
                  : inv.availableUnits === 0
                    ? "bg-white/3 border-white/5 text-white/25 cursor-not-allowed"
                    : "bg-white/5 border-white/8 text-white/60 hover:bg-white/8 hover:border-white/15"
              )}
            >
              <span className="flex items-center gap-1.5 font-mono">
                <MapPin className="w-3 h-3" />
                {inv.warehouse.name}
              </span>
              <span
                className={cn(
                  "font-mono font-bold",
                  inv.availableUnits === 0
                    ? "text-white/20"
                    : inv.availableUnits <= 3
                      ? "text-orange-400"
                      : "text-[#E8FF47]"
                )}
              >
                {inv.availableUnits} avail
              </span>
            </button>
          ))}
        </div>

        {totalAvailable > 0 ? (
          <div className="flex gap-2">
            <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                disabled={quantity <= 1}
                className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors font-mono text-sm"
              >
                -
              </button>
              <span className="px-3 font-mono text-sm min-w-[2rem] text-center">
                {quantity}
              </span>
              <button
                onClick={() =>
                  setQuantity((current) => Math.min(maxQty, current + 1))
                }
                disabled={quantity >= maxQty}
                className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors font-mono text-sm"
              >
                +
              </button>
            </div>

            <button
              onClick={handleReserve}
              disabled={loading || !selectedWarehouse || maxQty === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-[#E8FF47] text-black font-syne font-bold text-sm rounded-lg px-4 py-2 hover:bg-[#d4eb3c] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full spin-slow" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {loading ? "Reserving..." : "Reserve"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white/30 font-mono text-xs border border-white/8 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4" />
            Not available in any warehouse
          </div>
        )}
      </div>
    </div>
  );
}
