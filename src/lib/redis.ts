import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_REDIS_LOCALLY !== "true"
  ) {
    return null;
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

/**
 * Acquire a distributed lock using Redis SET NX PX.
 * Returns true if lock was acquired, false otherwise.
 */
export async function acquireLock(
  key: string,
  ttlMs: number = 5000
): Promise<boolean> {
  const client = getRedis();
  if (!client) return true; // fallback: no Redis, let DB handle it via SELECT FOR UPDATE

  const result = await client.set(`lock:${key}`, "1", {
    nx: true,
    px: ttlMs,
  });
  return result === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.del(`lock:${key}`);
}

/**
 * Get an idempotency record from Redis.
 */
export async function getIdempotencyRecord(
  key: string
): Promise<{ statusCode: number; body: unknown } | null> {
  const client = getRedis();
  if (!client) return null;

  const value = await client.get<{ statusCode: number; body: unknown }>(
    `idempotency:${key}`
  );
  return value;
}

/**
 * Store an idempotency record in Redis (24h TTL).
 */
export async function setIdempotencyRecord(
  key: string,
  statusCode: number,
  body: unknown
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  await client.set(
    `idempotency:${key}`,
    { statusCode, body },
    { ex: 86400 } // 24 hours
  );
}
