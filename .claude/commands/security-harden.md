---
description: Adversarial security audit and hardening pass over the web app, API, and mobile app
---

# Security hardening: BizFlow Voucher Hunt

You are acting as an application security engineer doing an authorized review of this
codebase, which you own. This system moves real value — Loyalty Points (LP) that partners
are billed for, vouchers redeemed for goods at a till, and SMS spend on a live SMPP
carrier link. A bug here is not a crash, it is money leaving the business. Treat every
finding through that lens.

$ARGUMENTS

## Ground rules

1. **Audit before you edit.** Phase 1 is read-only. Do not change a single line until you
   have produced the findings list and I have seen it.
2. **Prove it, don't guess.** For every finding, name the exact file and line, and write a
   concrete exploit walkthrough: the literal HTTP request or app action an attacker sends,
   what the server currently does, and what they gain. If you cannot write that
   walkthrough, it is not a finding — drop it.
3. **No theatre.** Do not report "missing CSP" or "dependency is one minor behind" as a
   high finding when a customer can mint LP for free. Rank by money and account takeover.
4. **Do not weaken UX to look secure.** No CAPTCHAs, no forced re-login, no extra OTP
   steps unless a finding genuinely requires it and I approve.
5. **Every fix ships with a regression test** in `tests/` (vitest) or `e2e/` (Playwright)
   that fails before the fix and passes after. A fix without a test is not done.
6. **Never** commit, push, run migrations against a live database, or touch production
   env values. Never print real secrets from `.env` into the transcript.

## Threat model — assume these attackers

- **A greedy customer** with the mobile app, a rooted phone, mitmproxy on the API, and
  unlimited free SIM cards. They can read the app bundle, see every request the app makes,
  replay it, change any field, and call any endpoint the app never calls.
- **A dishonest staff member** with valid staff credentials at one partner business.
- **A dishonest partner admin** with a dashboard login scoped to their own business.
- **An anonymous stranger** who found the API base URL and is enumerating routes.

## Phase 1 — audit

Work through these surfaces. Trace the real code path each time; do not rely on comments
or naming to tell you a check exists.

### A. Value creation and spend (highest priority)

- `src/server/rewards-network.ts`, `src/server/voucher-engine.ts`
- `/api/public/rewards/*` — `wallet`, `convert`, `products/purchase`, `purchases`
- `/api/public/hunt/*` — `start`, `attempt`, `select`, `state`, `reset`
- `/api/staff/rewards/*` and `/api/staff/vouchers/*`

Answer specifically:

- **`walletSecret`**: the API hands it to the client and the client passes it back to
  authorize `convert` and `products/purchase` (see `apps/mobile/src/api/client.ts`). What
  does it actually protect that the bearer token does not? Can one signed-in customer
  obtain or guess another's? Is it compared in constant time? If it adds no security
  boundary, say so plainly rather than hardening a decoration.
- **Balance arithmetic**: is LP ever handled as a float or a JS `number` where centavos
  could be lost or rounded up? Is `amount` validated as positive, integral, and bounded —
  what happens on a negative, `1e309`, `"0x10"`, or a 40-digit string?
- **Concurrency**: fire N simultaneous `purchase` / `convert` / `hunt/select` requests for
  the same wallet or the same limited-quantity slot. Does the transaction boundary in
  `src/server/db.ts` (`withTx`) plus the actual SQL prevent double-spend and pool
  oversubscription, or is it read-then-write with a gap? Check for `SELECT` then `UPDATE`
  without a conditional `WHERE balance >= ?` or equivalent guard.
- **Idempotency**: if a purchase or redemption request is retried after a network timeout,
  is value moved twice?
- **Draw fairness**: `drawAttempt` accepts a client-supplied `devPoolId` that forces the
  outcome. Where is that gated, and does the gate hold in a production build? Is the RNG
  in the voucher engine cryptographic, and is the pool weighting done server-side only?
- **Attempt limits**: `remainingBaseAttempts` / `remainingBonusAttempts` — are they
  recomputed server-side per request, or can a client influence them via `sessionId`,
  `phone`, or a re-`start`? Can `hunt/reset` be reached by a customer?
- **The daily 10 LP app-use award**: what stops a script from claiming it every day across
  1,000 phone numbers, or more than once per day per number?

### B. Dev-only endpoints that mint value

`/api/public/rewards/dev-credit`, `dev-purchase`, `dev-collect`, and
`/api/public/hunt/dev-refresh-vouchers` create spendable balance and vouchers out of
nothing. Today they are gated on `process.env.NODE_ENV === "production"`.

- Enumerate every such endpoint and every dev branch inside shared server code.
- Is `NODE_ENV` guaranteed to be `"production"` in every deployment target (Vercel,
  standalone `next start`, the SMPP worker process, preview deploys)? What happens if it
  is unset or `"preview"`?
- Recommend a fail-closed pattern: a single explicit allow flag that must be affirmatively
  set to enable dev tooling, defaulting to disabled, checked in one shared helper — plus
  ideally excluding these route files from the production build entirely.

### C. Customer authentication and OTP

`src/server/otp.ts`, `src/server/customer-auth.ts`, `src/server/sms.ts`,
`/api/public/signin/*`

- **OTP brute force**: how many digits, what entropy, what lifetime? Is there a per-phone
  attempt counter that invalidates the code after N wrong guesses, or only an IP rate
  limit? Is the comparison constant-time? Does the same code stay valid across multiple
  `request-otp` calls?
- **SMS pumping / toll fraud**: an attacker loops `request-otp` against premium-rate or
  international ranges and burns your SMPP balance. What caps exist per phone, per prefix,
  per IP, and globally per hour? Is there a country/prefix allowlist?
- **Enumeration**: do responses or timings reveal whether a phone is already registered?
- **Phone normalization**: `src/server/phone.ts` — can `+63917...`, `0917...`, and
  `63917...` resolve to different accounts, or worse, collide into someone else's wallet?
  Try unicode digits, leading zeros, and whitespace.
- **Tokens**: customer bearer tokens live for a year with no rotation. Is there any
  revocation path besides the global epoch bump? Is `last_used_at` tracked? Should tokens
  be bound to a device id, and should sign-in on a new device notify or invalidate?
- **Cookie session**: the phone cookie plus epoch cookie pattern in `customer-auth.ts` —
  the epoch is a global value shared by all users, so it authenticates nothing about
  *which* phone. Confirm whether the `httpOnly` flag is the only thing preventing forgery,
  and what happens under XSS or a subdomain-scoped cookie write. Consider a signed
  (HMAC) session value binding the phone to the epoch.
- **CSRF**: cookies are `sameSite: "lax"`, and state-changing routes are `POST` JSON.
  Verify no money-moving route accepts a simple form-encoded POST or a `GET`.

### D. Admin, staff, and multi-tenancy

`middleware.ts`, `src/server/auth.ts`, `src/lib/admin-session.ts`, `/api/admin/*`,
`/api/dashboard/*`, `/api/staff/*`, `/api/export/*`

- **Matcher coverage**: enumerate every privileged route and check it against the
  `middleware.ts` matcher list. Anything privileged that is *not* matched must be proven
  to guard itself in-route via `requireAdmin`. Report every route relying on the matcher
  alone, and every route relying on neither. Pay attention to `/api/admin/*`,
  `/api/cron/*`, and `/api/sms/*`.
- **`ADMIN_ACCESS_TOKEN`**: a single static bearer that grants `super_admin` with
  `businessIds: ["*"]`, compared with `!==`. Assess: constant-time comparison, minimum
  entropy enforcement, whether it should be restricted to specific routes rather than
  everything, whether its use is audit-logged, and what the rotation story is. Note that
  `src/server/rate-limit.ts` falls back to this same secret as a hash salt — flag the
  coupling.
- **Session tokens**: how is the admin session signed and verified, what is the expiry,
  is the algorithm pinned (no `alg: none` / algorithm confusion), and is it invalidated
  when an admin is deleted or demoted?
- **IDOR / horizontal escalation**: for every dashboard, staff, and export route that
  takes an `id`, `businessId`, `campaignId`, `productId`, `phone`, or `voucherId` from the
  path, query, or body — is `assertBusinessAccess` actually called with the resource's
  *owning* business, resolved from the database, not from the request? A staff account at
  business A must not read, edit, redeem, credit, or export anything belonging to
  business B. Check `/api/dashboard/users/[phone]` and the export routes especially:
  what customer PII do they return, and is it scoped?
- **Vertical escalation**: can a `staff` role reach an admin-only action —
  rewards settlement, deposits, product creation, `/api/dashboard/reset`, change-request
  approval, or admin user creation? Confirm `assertAdminRole` / `assertSuperAdmin` guard
  each one.
- **`/api/dashboard/reset`** wipes data and bumps the auth epoch. Who can call it?

### E. Voucher and QR redemption integrity

- How are voucher codes and `qrToken` values generated — length, entropy, CSPRNG? Are they
  guessable or enumerable at 100 req/s?
- Can the same voucher be redeemed twice by two staff members scanning simultaneously?
  Is the redeem an atomic conditional update?
- Can a *screenshot* of a QR be redeemed after the original was redeemed, or at a business
  that does not own it? Is there any binding to time, business, or a rotating value?
- `/api/campaigns/[id]/redemptions/import` — an import path that can mark vouchers
  redeemed in bulk. Who can call it, is the file parsed safely, and is there a size cap?

### F. Referral abuse

`/api/public/referral/{link,visit,open,claim,state}`

- Can a user refer themselves — same phone, same device, second SIM, or by crafting `ref`
  directly? What identity is the anti-self-referral check keyed on?
- `referral/visit` takes a `ref` in the query and redirects. Verify it is not an open
  redirect and cannot be pointed at an arbitrary host.
- What is the ceiling on bonus attempts earned per day, and is it enforced server-side?

### G. Input validation, injection, and data layer

- **SQL**: this uses raw SQL over libsql. Grep for every template literal or string
  concatenation reaching `run` / `one` / `all` / `withTx`. Every user-influenced value must
  be a `?` parameter. Table and column names must never come from input.
- **Zod coverage**: every route must parse its body/query with a schema before use. Find
  routes reading `await request.json()` fields without one, or using `.passthrough()` /
  loose objects on money-moving input.
- **Mass assignment**: can a client send extra fields — `role`, `businessIds`, `status`,
  `priceCentavos`, `balance` — that reach an INSERT or UPDATE?
- **File and image upload**: campaign artwork accepts `data:` URIs. Is there a size cap,
  a MIME allowlist, and is SVG (script-capable) rejected? Can a `data:` URI be stored and
  later rendered into an admin page?
- **Error handling**: does `fail()` in `src/server/errors.ts` ever leak a stack trace, SQL
  text, or internal id to the client in production?

### H. Webhooks, cron, and the SMPP worker

- `/api/sms/delivery-receipt` — is it authenticated, or can anyone forge delivery receipts
  and corrupt SMS state or trigger resends?
- `/api/cron/notifications` — is it protected by a cron secret, and is that secret
  compared safely?
- `server/smpp-worker.cjs` — how are carrier credentials sourced, does it log message
  bodies or OTP codes, and is its inbound handling resilient to hostile PDUs?
- `/api/public/voucher/resend` — an unauthenticated-looking SMS trigger. Rate limits?

### I. Rate limiting

`src/server/rate-limit.ts`

- `clientIp()` trusts the first entry in `X-Forwarded-For`. Since anyone can send that
  header, is the limiter bypassable by rotating a spoofed value? Determine what the actual
  deployment's trusted proxy is and pin to the correct hop.
- Fixed-window counting allows a 2× burst across a boundary — does that matter for OTP or
  purchase endpoints?
- Which money-moving and auth routes have **no** limiter at all? Which need a *per-phone*
  or *per-wallet* limit in addition to per-IP?

### J. Transport, headers, and dependencies

- `next.config.mjs` — HSTS, `X-Content-Type-Options`, `X-Frame-Options`/frame-ancestors,
  `Referrer-Policy`, and a Content-Security-Policy. Report what is missing.
- CORS on the API: what origins are allowed, and does any route reflect `Origin`?
- Check `next@14.2.30` and the other production dependencies for known advisories
  (`npm audit --omit=dev`); report only those actually reachable in this app's usage.
- Grep for secrets committed to the repo, and confirm `.env.example` documents every
  required secret without containing a real one.

### K. Mobile app

`apps/mobile/`

- **Token storage**: confirm the bearer token is in `expo-secure-store`, never
  `AsyncStorage`, never in Redux persisted to disk, and never written to a log.
- **Logging**: grep for `console.log` of tokens, `walletSecret`, OTP codes, or full API
  responses that reach production builds.
- **`EXPO_PUBLIC_*`**: everything under this prefix is embedded in the shipped bundle and
  fully readable. Confirm no secret is passed this way — only the API base URL.
- **Client-side trust**: identify every place the app makes a decision the server should
  own (remaining attempts, whether a voucher is `collectable`, LP price, whether dev tools
  are shown). Each is bypassable; each needs the server as the authority.
- **Deep links**: referral links open the app with attacker-controlled parameters. Are
  they validated before use, and can one drive a state-changing call without user intent?
- **Transport**: HTTPS is enforced for non-`__DEV__` builds in `api/client.ts` — verify
  nothing bypasses `getApiBaseUrl()`, and evaluate whether cert pinning is warranted for
  the money endpoints.
- **Device posture**: consider what a rooted device or a repackaged APK can do, and make
  sure the answer is "nothing the API would not allow anyway."
- **Leakage**: voucher codes and QR tokens in screenshots, notification previews, and the
  app switcher snapshot.

## Phase 1 output

Produce a single findings table, ordered by severity, then stop and wait for my go-ahead:

| # | Severity | Title | File:line | What an attacker gains | Fix sketch | Effort |

Severity means:

- **Critical** — free money, account takeover, or cross-tenant data access, reachable by an
  anonymous or ordinary customer.
- **High** — same impact but needs staff access, or a limited/awkward precondition.
- **Medium** — abuse that costs money at scale (SMS pumping, referral farming) or leaks PII.
- **Low** — hardening and defense-in-depth.

Then add:

- **Verified safe** — the checks above that you traced and found genuinely sound. Name them
  so I know they were looked at, not skipped.
- **Cannot determine from code alone** — anything that depends on deployment config,
  proxy behavior, or the live database, with the exact question I need to answer.

## Phase 2 — fix (only after I approve)

- Fix in severity order. Critical and High first, each as its own focused change.
- Prefer fixing the shared helper over patching N call sites, but do not invent a new
  framework — follow the existing patterns in `src/server/`.
- Fail closed. A missing env var, an unparseable input, or an unexpected state must deny,
  never allow.
- Enforce every invariant at the database boundary where possible: conditional updates,
  unique constraints, and `CHECK` constraints beat application-layer `if` statements. Flag
  any schema change separately — do not run migrations yourself.
- Add the regression test for each fix. Name tests after the attack
  (`rejects negative LP convert amount`), not the function.
- After each fix: `npm run typecheck && npm run lint && npm run test`, plus
  `npm run mobile:typecheck` for mobile changes. Report real output; if something fails,
  say so with the failure text.
- Keep a running `docs/SECURITY.md` recording the trust boundaries, the invariants the
  system now enforces, and the residual risks I chose to accept.

Finish with a short summary: what was fixed, what was deliberately left, and the top three
things to do next that are outside the scope of a code change (secret rotation, monitoring
and alerting on anomalous LP movement, a reconciliation job that compares LP issued against
LP settled).
