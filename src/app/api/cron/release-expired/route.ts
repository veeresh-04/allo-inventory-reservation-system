import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron Job — runs every minute via vercel.json cron config.
 * Releases all PENDING reservations past their expiresAt timestamp.
 */
export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (in production)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({
      ok: true,
      releasedCount: released,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron release-expired error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
