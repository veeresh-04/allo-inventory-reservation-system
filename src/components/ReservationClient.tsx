"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Package,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { formatCurrency, formatCountdown, cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    price: string;
    imageUrl: string | null;
    description?: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

interface Props {
  reservation: Reservation;
}

export function ReservationClient({ reservation: initial }: Props) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initial);
  const [msLeft, setMsLeft] = useState(
    Math.max(0, new Date(initial.expiresAt).getTime() - Date.now())
  );
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);

  const navigateToProducts = useCallback(() => {
    router.push(`/products?stockUpdated=${Date.now()}`);
  }, [router]);

  // Countdown timer
  useEffect(() => {
    if (reservation.status !== "PENDING") return;

    const interval = setInterval(() => {
      const remaining = new Date(reservation.expiresAt).getTime() - Date.now();
      setMsLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        setReservation((r) => ({ ...r, status: "RELEASED" }));
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [reservation.expiresAt, reservation.status]);

  const handleConfirm = useCallback(async () => {
    setLoading("confirm");
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `confirm-${reservation.id}`,
        },
      });
      const data = await res.json();

      if (res.status === 410) {
        toast({
          variant: "destructive",
          title: "Reservation expired",
          description: data.error,
        });
        setReservation((r) => ({ ...r, status: "RELEASED" }));
        return;
      }

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Confirmation failed",
          description: data.error ?? "Something went wrong.",
        });
        return;
      }

      setReservation((r) => ({ ...r, status: "CONFIRMED" }));
      toast({
        variant: "success",
        title: "Purchase confirmed!",
        description: `Order for ${reservation.product.name} is confirmed.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not connect to the server.",
      });
    } finally {
      setLoading(null);
    }
  }, [reservation.id, reservation.product.name]);

  const handleCancel = useCallback(async () => {
    setLoading("cancel");
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Cancel failed",
          description: data.error ?? "Something went wrong.",
        });
        return;
      }

      setReservation((r) => ({ ...r, status: "RELEASED" }));
      toast({
        title: "Reservation cancelled",
        description: "Units returned to stock.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not connect to the server.",
      });
    } finally {
      setLoading(null);
    }
  }, [reservation.id]);

  const isUrgent = msLeft < 120_000 && reservation.status === "PENDING";
  const total = Number(reservation.product.price) * reservation.quantity;

  return (
    <div className="fade-in-up max-w-2xl mx-auto">
      {/* Back link */}
      <button
        onClick={navigateToProducts}
        className="flex items-center gap-2 text-white/40 hover:text-white font-mono text-xs mb-8 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to products
      </button>

      {/* Status banner */}
      <StatusBanner status={reservation.status} msLeft={msLeft} />

      <div className="mt-6 space-y-4">
        {/* Order summary card */}
        <div className="bg-[#141414] border border-white/8 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-white/8">
            <div className="flex gap-4 items-start">
              {reservation.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reservation.product.imageUrl}
                  alt={reservation.product.name}
                  className="w-20 h-20 rounded-lg object-cover bg-[#1C1C1C]"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-[#1C1C1C] flex items-center justify-center">
                  <Package className="w-8 h-8 text-white/20" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-syne font-bold text-lg leading-tight">
                  {reservation.product.name}
                </h2>
                <p className="font-mono text-xs text-white/40 mt-0.5">
                  SKU: {reservation.product.sku}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-white/40 font-mono text-xs">
                  <MapPin className="w-3 h-3" />
                  {reservation.warehouse.name} · {reservation.warehouse.location}
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="p-5 space-y-2">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-white/50">Unit price</span>
              <span>{formatCurrency(reservation.product.price)}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-white/50">Quantity</span>
              <span>× {reservation.quantity}</span>
            </div>
            <div className="border-t border-white/8 pt-2 flex justify-between font-syne font-bold text-lg">
              <span>Total</span>
              <span className="text-[#E8FF47]">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Countdown card (only for PENDING) */}
        {reservation.status === "PENDING" && (
          <div
            className={cn(
              "bg-[#141414] rounded-xl p-5 border transition-all",
              isUrgent
                ? "border-orange-500/40 countdown-urgent"
                : "border-white/8"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/60 font-mono text-sm">
                <Clock className="w-4 h-4" />
                Reservation expires in
              </div>
              <span
                className={cn(
                  "font-mono font-bold text-2xl tabular-nums",
                  isUrgent ? "text-orange-400" : "text-[#E8FF47]"
                )}
              >
                {formatCountdown(msLeft)}
              </span>
            </div>
            <div className="mt-3 h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  isUrgent ? "bg-orange-400" : "bg-[#E8FF47]"
                )}
                style={{
                  width: `${(msLeft / (10 * 60 * 1000)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Reservation metadata */}
        <div className="bg-[#141414] border border-white/8 rounded-xl p-5">
          <h3 className="font-mono text-xs text-white/40 uppercase tracking-widest mb-3">
            Reservation Details
          </h3>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-white/40">ID</span>
              <span className="text-white/70 font-bold truncate max-w-[200px]">
                {reservation.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Created</span>
              <span className="text-white/70">
                {new Date(reservation.createdAt).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Expires</span>
              <span className="text-white/70">
                {new Date(reservation.expiresAt).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {reservation.status === "PENDING" && (
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-2 border border-white/15 rounded-xl py-3.5 font-syne font-semibold text-sm text-white/60 hover:text-white hover:border-white/30 disabled:opacity-40 transition-all"
            >
              {loading === "cancel" ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full spin-slow" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Cancel
            </button>

            <button
              onClick={handleConfirm}
              disabled={loading !== null || msLeft === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-[#E8FF47] text-black font-syne font-bold text-sm rounded-xl py-3.5 hover:bg-[#d4eb3c] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading === "confirm" ? (
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full spin-slow" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Confirm Purchase
            </button>
          </div>
        )}

        {/* Post-action CTA */}
        {reservation.status !== "PENDING" && (
          <button
            onClick={navigateToProducts}
            className="w-full border border-white/10 rounded-xl py-3.5 font-syne font-semibold text-sm text-white/60 hover:text-white hover:border-white/25 transition-all"
          >
            Browse more products
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  msLeft,
}: {
  status: ReservationStatus;
  msLeft: number;
}) {
  const expired = status === "PENDING" && msLeft === 0;
  const effectiveStatus = expired ? "RELEASED" : status;

  const config = {
    PENDING: {
      icon: Clock,
      color: "text-[#E8FF47]",
      bg: "bg-[#E8FF47]/8 border-[#E8FF47]/20",
      label: "Awaiting payment",
      sub: "Complete your purchase before the timer runs out.",
    },
    CONFIRMED: {
      icon: CheckCircle2,
      color: "text-green-400",
      bg: "bg-green-950/40 border-green-500/20",
      label: "Purchase confirmed",
      sub: "Payment successful. Your order is being processed.",
    },
    RELEASED: {
      icon: expired ? AlertTriangle : XCircle,
      color: expired ? "text-orange-400" : "text-white/40",
      bg: expired
        ? "bg-orange-950/30 border-orange-500/20"
        : "bg-white/4 border-white/10",
      label: expired ? "Reservation expired" : "Reservation cancelled",
      sub: expired
        ? "The 10-minute hold expired. Units returned to stock."
        : "You cancelled this reservation. Units returned to stock.",
    },
  }[effectiveStatus];

  const Icon = config.icon;

  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border", config.bg)}>
      <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", config.color)} />
      <div>
        <p className={cn("font-syne font-bold text-sm", config.color)}>
          {config.label}
        </p>
        <p className="font-mono text-xs text-white/40 mt-0.5">{config.sub}</p>
      </div>
    </div>
  );
}
