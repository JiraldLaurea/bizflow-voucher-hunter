# BizFlow Voucher Hunt Engine

Reservation-based voucher hunting MVP for SMEs. The app lets a customer choose a date and time slot first, reveal voucher candidates, select one final voucher, then redeem it through a staff/admin surface.

## Current Scope

- Mobile-first public voucher hunt flow
- Desktop-optimized admin dashboard
- Desktop-optimized staff validation and redemption page
- SQLite persistence (`better-sqlite3`) with transactional, race-safe stock control
- Admin CRUD API for campaigns, slots, and voucher pools (token-guarded)
- Mock SMS logging
- Dashboard metrics and CSV export
- Unit and integration tests for the voucher engine, including concurrency guarantees

## Public Customer Flow

The customer journey is split into separate pages to match the reference UI flow:

| Step | Page | Route |
|---|---|---|
| 1 | Campaign Landing | `/campaign/july-dinner` |
| 2 | Select Date | `/campaign/july-dinner/date` |
| 3 | Select Time | `/campaign/july-dinner/time` |
| 4 | Hunt Intro | `/campaign/july-dinner/hunt` |
| 5 | Voucher Results | `/campaign/july-dinner/results` |
| 6 | Share for Extra Chance | `/campaign/july-dinner/share` |
| 7 | Confirm & Details | `/campaign/july-dinner/confirm` |
| 8 | Confirmation SMS/QR | `/campaign/july-dinner/confirmation` |

Online shop campaign:

```text
/campaign/8pm-drop
```

Current UI direction:

- Step 1 has no progress indicator and uses the mobile landing mockup structure.
- Step 2 has no progress indicator and no Restaurant / Online Shop tabs, matching the Select Date mockup.
- Later steps are still being refined page by page.

## Admin and Staff Routes

| Area | Route |
|---|---|
| Admin dashboard | `/dashboard` |
| Staff validation / redemption | `/staff` |
| CSV export | `/api/export/campaigns/camp_july_dinner` |
| Health check | `/api/health` |

## Admin Configuration API

These endpoints create and manage campaign configuration. They are guarded by a
shared admin token — send it as `Authorization: Bearer <token>` or `x-admin-token: <token>`,
where the token matches `ADMIN_ACCESS_TOKEN` from the environment.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/campaigns` | POST | Create a campaign |
| `/api/campaigns/{id}` | GET / PATCH | Read or update a campaign |
| `/api/campaigns/{id}/slots` | GET / POST | List or create date/time slots |
| `/api/slots/{slotId}/pools` | GET / POST | List or create voucher pools for a slot |

Example:

```bash
curl -X POST http://127.0.0.1:3000/api/campaigns \
  -H "Authorization: Bearer local-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"biz_demo_shop","slug":"aug-drop","title":"August Drop","offerMessage":"...","heroImage":"#000","mode":"online_shop","startDate":"2026-08-01","endDate":"2026-08-31","baseAttempts":3,"referralDailyLimit":5,"candidateTimeoutMinutes":10,"terms":"..."}'
```

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Zod
- React Icons
- Inter via `next/font/local`
- Vitest
- Playwright test scaffold
- SQLite datastore (`better-sqlite3`) at `data/bizflow.db` (path via `DATABASE_PATH`)

## Setup

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Validation

Run before handoff:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Additional scripts:

```bash
npm run test:integration
npm run test:e2e
```

Detailed manual and automated test instructions are in:

```text
docs/TESTING.md
```

## Reset Local Data

Runtime data is stored in a SQLite database at:

```text
data/bizflow.db
```

To regenerate seeded campaigns, stop the dev server and delete `data/bizflow.db*`
(including the `-shm`/`-wal` sidecar files). The next app/API load recreates and
reseeds it from `src/server/db.ts`. Tests use a separate `data/test-bizflow.db`.

## Stock Control & Concurrency

Slot capacity and voucher-pool quantity are protected against race conditions:

- Every mutation runs inside a `better-sqlite3` transaction.
- Stock and capacity are reduced with conditional updates (`... WHERE remaining > 0`) and the row-change count is verified, so a depleted pool/slot can never be over-issued.
- A `UNIQUE(campaign_id, user_id)` constraint on `vouchers` is the authoritative guard for the "one final voucher per phone per campaign" rule under concurrent selects.

Covered by `tests/integration/concurrency.test.ts`.

> Note: this protects a single SQLite instance. A multi-instance/serverless
> deployment should move to PostgreSQL/Supabase with the same transactional pattern.

## Important Notes

- `npm install` has reported dependency vulnerabilities, including a Next.js security warning. Perform a dependency security review before production use.
- `npm audit --json` needs explicit approval because it sends dependency inventory to the external npm audit service.
- Playwright E2E is scaffolded, but a previous run hung without producing a useful report. Unit tests, integration tests, lint, typecheck, and build have passed.

## Production Path

Before production:

- Move SQLite to PostgreSQL/Supabase for multi-instance deployments (keep the transactional / conditional-update pattern).
- Add real SMS provider integration.
- Add OTP or stronger duplicate prevention for high-value campaigns.
- Add rate limiting and a real admin auth/session layer (the current admin API uses a single shared token).
- Re-run E2E and security tests after the persistence layer is replaced.
