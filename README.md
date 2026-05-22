# Allo Inventory

A multi-warehouse inventory and reservation platform built with Next.js App Router, TypeScript, Prisma, hosted Postgres, and optional Upstash Redis.

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
- Vercel Cron plus lazy cleanup for expired reservations.
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
| `DATABASE_URL` | Hosted Postgres connection string from Supabase, Neon, Railway, or equivalent. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL. Optional locally. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token. Optional locally. |
| `CRON_SECRET` | Secret used to protect the cron endpoint in production. |

Redis is optional for local development. If it is not configured, the app still relies on Postgres row locks for reservation correctness.

### 3. Prepare the database

```bash
npm run db:push
npm run db:seed
```

The seed creates 6 products, 3 warehouses, and stock records for each product and warehouse pair.

### 4. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production Deployment

Use:

- Vercel for the Next.js app.
- Supabase, Neon, Railway, or another hosted Postgres provider for `DATABASE_URL`.
- Upstash Redis for the distributed lock and idempotency cache.

`vercel.json` schedules:

```json
{
  "path": "/api/cron/release-expired",
  "schedule": "* * * * *"
}
```

Set the same env vars in Vercel. `CRON_SECRET` is checked by `/api/cron/release-expired` in production.

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

- Primary cleanup: Vercel Cron calls `GET /api/cron/release-expired` every minute.
- Lazy cleanup: product reads call `releaseExpiredReservations()` before stock is returned.

The cleanup uses one atomic `UPDATE ... RETURNING` query to move expired `PENDING` reservations to `RELEASED`, then decrements the matching inventory rows in the same transaction. This prevents duplicate cleanup work from double-releasing the same reservation if cron and a user-triggered read happen at the same time.

Maximum stock limbo is about one minute under normal cron operation, and usually shorter when product pages are being read.

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
