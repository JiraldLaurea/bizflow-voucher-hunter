# Voucher Hunt Engine

Reservation-based voucher hunting MVP for SMEs. A customer picks a campaign, spins to reveal voucher candidates, selects one, then books a date/time slot **from the windows that voucher's benefit tier is offered at**, and redeems it through a staff/admin surface.

## Current Scope

- Mobile-first public voucher hunt flow
- Desktop-optimized admin dashboard
- Desktop-optimized staff validation and redemption page
- libSQL/Turso persistence (`@libsql/client`) with transactional, race-safe stock control — serverless-ready for Vercel
- Admin CRUD API for campaigns, slots, and voucher pools (session + token guarded)
- Real SMS delivery layer (Movider/Twilio/Infobip/ClickSend) with mock fallback
- Server-enforced referral extra attempts
- Phone **OTP sign-in** for every customer, so a voucher can only be issued to a verified number
- **IP rate limiting** on public hunt/OTP/referral endpoints (hashed IPs)
- Staff **no-show** tagging and **reservation rescheduling** (per-campaign `allowReschedule`)
- **CSV redemption import** (e.g. Shopify used-codes report) from the dashboard
- Sold-out recovery UI that suggests alternate available slots
- Dashboard metrics and multi-section CSV export
- Unit and integration tests, including concurrency, OTP, rate-limit, and lifecycle guarantees

## Public Customer Flow

**The draw comes before the booking.** The prize is drawn campaign-wide first,
and the slot picker then offers only the windows that prize's tier is bound to
(`pool_slots`). An earlier version of this file described the reverse — date and
time first — which has not been true since the roulette landed. Rarity is set by
`probability_weight` alone, never by how many slots a tier is offered at.

| Step | Page | Route |
|---|---|---|
| 1 | Campaign Landing | `/campaign/july-dinner` |
| 2 | Hunt Intro | `/campaign/july-dinner/hunt` |
| 3 | Voucher Roulette | `/campaign/july-dinner/roulette` |
| 4 | Voucher Results | `/campaign/july-dinner/results` |
| 5 | Date & Time (tier-gated) | `/campaign/july-dinner/datetime` |
| 6 | Confirm & Details | `/campaign/july-dinner/confirm` |
| 7 | Confirmation SMS/QR | `/campaign/july-dinner/confirmation` |

Sign-in is a single global phone-OTP step (`/api/public/signin/request-otp`),
not a per-campaign gate: the old per-campaign `requireOtp` flag is gone.

Online shop campaign:

```text
/campaign/8pm-drop
```

The customer-facing flow also ships as an Expo/React Native Android app
(`apps/mobile`), which mirrors these steps screen for screen. The admin and
staff surfaces stay web-only. See `docs/MOBILE_APP_MIGRATION.md`.

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
| `/api/campaigns/{id}/redemptions/import` | POST | Bulk-redeem codes from a CSV export (Shopify used-codes) |
| `/api/staff/vouchers/no-show` | POST | Flag a reserved booking + voucher as no-show |
| `/api/staff/reservations/reschedule` | POST | Move an issued reservation to another slot (if `allowReschedule`) |

Public anti-abuse / verification endpoints (rate-limited, no admin token):

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/public/signin/request-otp` | POST | Send a 6-digit sign-in OTP via SMS |
| `/api/public/signin/verify-otp` | POST | Verify the code and establish the customer session |
| `/api/public/signin/session` | GET | Current customer session, if any |
| `/api/public/signin/signout` | POST | Clear the customer session |

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
- libSQL datastore (`@libsql/client`): a local SQLite file for dev/tests (`DATABASE_PATH`), Turso (`DATABASE_URL`) in production

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

## Database (libSQL / Turso)

The data layer uses `@libsql/client`, which speaks the SQLite dialect over a
local file **or** a hosted Turso database:

- **Local dev & tests**: a SQLite file (`DATABASE_PATH`, default `data/bizflow.db`).
  The schema is created and seeded automatically on first use.
- **Production (Vercel)**: set `DATABASE_URL=libsql://<db>.turso.io` and
  `DATABASE_AUTH_TOKEN=<token>`. When `DATABASE_URL` is set it takes precedence.

To deploy on Vercel: create a free Turso DB (`turso db create` + `turso db tokens create`),
add `DATABASE_URL` / `DATABASE_AUTH_TOKEN` (and `ADMIN_SESSION_SECRET`, admin creds,
SMS keys) as project env vars, and deploy. The schema/seed runs on the first request.

To regenerate seeded demo data locally, stop the dev server and delete
`data/bizflow.db*`; the next load recreates and reseeds it. Tests use a separate
`data/test-bizflow.db`.

## Stock Control & Concurrency

Slot capacity and voucher-pool quantity are protected against race conditions:

- Every mutation runs inside a libSQL write transaction (`withTx`).
- Stock and capacity are reduced with conditional updates (`... WHERE remaining > 0`) and the affected-row count is verified, so a depleted pool/slot can never be over-issued.
- A `UNIQUE(campaign_id, user_id)` constraint on `vouchers` is the authoritative guard for the "one final voucher per phone per campaign" rule under concurrent selects.

Covered by `tests/integration/concurrency.test.ts`. On Turso these guarantees hold across serverless instances (single primary with transactional writes).

## Important Notes

- `npm install` has reported dependency vulnerabilities, including a Next.js security warning. Perform a dependency security review before production use.
- `npm audit --json` needs explicit approval because it sends dependency inventory to the external npm audit service.
- Playwright E2E is scaffolded, but a previous run hung without producing a useful report. Unit tests, integration tests, lint, typecheck, and build have passed.

## Production Path

Before production:

- Provision a Turso database and set `DATABASE_URL` / `DATABASE_AUTH_TOKEN` (the data layer is already serverless-ready via `@libsql/client`).
- Add real SMS provider integration.
- Add OTP or stronger duplicate prevention for high-value campaigns.
- Add rate limiting and a real admin auth/session layer (the current admin API uses a single shared token).
- Re-run E2E and security tests after the persistence layer is replaced.
