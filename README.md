# Allo Inventory

A multi-warehouse inventory and reservation platform built with Next.js App Router, TypeScript, Prisma, hosted Postgres, and optional Upstash Redis.

**Live Demo:** https://allo-inventory-reservation-system.vercel.app/products

## What It Implements

- Product and warehouse data models.
- Inventory per product and warehouse with `totalUnits` and `reservedUnits`.
- Reservations with `PENDING`, `CONFIRMED`, and `RELEASED` states plus `expiresAt`.
- `GET /api/products` with available stock per warehouse.
- `GET /api/warehouses`.
- `POST /api/reservations` with concurrency-safe stock reservation.
- `POST /api/reservations/:id/confirm`.
- `POST /api/reservations/:id/release`.
- Product listing UI, reservation checkout UI, live countdown, and visible 409/410 errors.
- Lazy cleanup plus Vercel Cron housekeeping for expired reservations.
- Bonus idempotency support for reserve and confirm.

## Running Locally

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set these values:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres connection string from Neon, Supabase, Railway, or equivalent. |
| `DATABASE_URL_UNPOOLED` | Direct (non-pooled) Postgres connection string. Required by Prisma for migrations. On Neon, this is the same host without the `-pooler` suffix. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL. Optional locally. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token. Optional locally. |
| `CRON_SECRET` | Secret used to protect the cron endpoint in production. |

Redis is optional for local development. If it is not configured, the app still relies on Postgres row locks for reservation correctness.

### 3. Configure Prisma schema

Make sure `prisma/schema.prisma` has both URLs configured:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
```

The `directUrl` is required when connection pooling is enabled (e.g. Neon pooler) so that Prisma migrations and `db push` use a direct connection.

### 4. Prepare the database

```bash
npm run db:push
npm run db:seed
```

> **Note:** If port 5432 is blocked on your network (common on college or office WiFi), either switch to a mobile hotspot or use the pooler URL for both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` temporarily.

The seed creates 6 products, 3 warehouses, and stock records for each product and warehouse pair.

### 5. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production Deployment

Use:

- Vercel for the Next.js app.
- Neon, Supabase, Railway, or another hosted Postgres provider for `DATABASE_URL`.
- Upstash Redis for the distributed lock and idempotency cache.

### Vercel Build Command

In **Vercel → Project → Settings → General → Build & Development Settings**, set the Build Command to:

```
prisma generate && next build
```

This is required because Vercel caches `node_modules` and does not re-run `postinstall` on cached builds. Running `prisma generate` explicitly ensures the Prisma Client is always up to date.

### Environment Variables

Set all five variables in **Vercel → Project → Settings → Environment Variables**:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres URL (used at runtime) |
| `DATABASE_URL_UNPOOLED` | Direct Postgres URL (used by Prisma migrations) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `CRON_SECRET` | Secret checked by the cron endpoint |

### Cron Schedule

`vercel.json` schedules the expiry cleanup to run every minute:

```json
{
  "path": "/api/cron/release-expired",
  "schedule": "* * * * *"
}
```

> **Note:** Vercel Hobby plan only supports a daily cron (`0 0 * * *`). The every-minute schedule requires a paid Vercel plan. On Hobby, lazy cleanup on product reads keeps stock accurate in the meantime.

## Concurrency Model

The reservation endpoint is designed so two buyers cannot reserve the same last unit.

First, when Redis is configured, the app acquires a short-lived lock for:

```text
inventory:{productId}:{warehouseId}
```

That reduces database contention for concurrent requests targeting the same product and warehouse. Requests for different SKUs do not block each other.

Second, and most importantly, the reservation transaction locks the inventory row in Postgres:

```sql
SELECT id, "totalUnits", "reservedUnits"
FROM "Inventory"
WHERE "productId" = $1
  AND "warehouseId" = $2
FOR UPDATE
```

The available stock check and `reservedUnits` increment happen inside the same transaction. If two requests race for the final unit, one transaction commits and the other sees no stock left and returns `409`.

## Reservation Expiry

Expired reservations are released in two ways:

- Primary cleanup: product reads call `releaseExpiredReservations()` before stock is returned. This keeps stock accurate whenever shoppers view the catalog, even on Vercel Hobby.
- Housekeeping cleanup: Vercel Cron calls `GET /api/cron/release-expired` on the configured schedule. On a paid Vercel plan this runs every minute (`* * * * *`); on Hobby it runs daily as a backstop.

The cleanup uses one atomic `UPDATE ... RETURNING` query to move expired `PENDING` reservations to `RELEASED`, then decrements the matching inventory rows in the same transaction. This prevents duplicate cleanup work from double-releasing the same reservation if cron and a user-triggered read happen at the same time.

## Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support the `Idempotency-Key` header.

- A cached key returns the original status code and response body.
- Reserve rechecks the idempotency cache after waiting on the per-SKU lock, so immediate retries do not create duplicate reservations.
- Confirm uses a stable frontend key, `confirm-{reservationId}`, so repeated clicks or network retries return the confirmed reservation instead of repeating the stock decrement.
- Redis records expire after 24 hours.

## Trade-Offs

- The Redis lock is a contention reducer; Postgres row locking is the correctness guarantee.
- Upstash single-node Redis is good for this take-home and demo. A high-scale production lock could use a multi-node Redlock setup or lean entirely on database constraints and transaction isolation.
- Reservations are not tied to authenticated users yet, so anyone with a reservation URL can act on it.
- The Prisma schema does not include database check constraints for `reservedUnits >= 0` and `reservedUnits <= totalUnits`; the API enforces those invariants, but database-level checks would be a useful hard stop.
- The project would benefit from Playwright E2E tests and a concurrency smoke test that fires parallel reservation requests against the same last unit.

## Verification

The production build passes with:

```bash
npm run build
```

TypeScript passes with:

```bash
npx tsc --noEmit
```
