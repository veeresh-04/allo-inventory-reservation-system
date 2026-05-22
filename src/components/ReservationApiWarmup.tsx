"use client";

import { useEffect } from "react";

export function ReservationApiWarmup() {
  useEffect(() => {
    fetch("/api/reservations", { method: "OPTIONS" }).catch(() => {
      // Warm-up is best-effort; the reserve button still handles real errors.
    });
  }, []);

  return null;
}
