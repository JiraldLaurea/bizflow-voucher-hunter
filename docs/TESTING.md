# BizFlow Voucher Hunt Testing Guide

Use this document to validate the MVP locally after changes. It covers automated checks, manual browser testing, API checks, and known limitations.

## 1. Test Environment

### Prerequisites
- Node.js 20+
- npm
- Project dependencies installed with `npm install`

### Start the App
```bash
npm run dev
```

Default local URL:

```text
http://127.0.0.1:3000
```

Seeded routes:

| Area | URL |
|---|---|
| Home | http://127.0.0.1:3000 |
| Step 1 - Campaign Landing | http://127.0.0.1:3000/campaign/july-dinner |
| Step 2 - Select Date | http://127.0.0.1:3000/campaign/july-dinner/date |
| Step 3 - Select Time | http://127.0.0.1:3000/campaign/july-dinner/time |
| Step 4 - Hunt Intro | http://127.0.0.1:3000/campaign/july-dinner/hunt |
| Step 5 - Voucher Results | http://127.0.0.1:3000/campaign/july-dinner/results |
| Step 6 - Share Extra Chance | http://127.0.0.1:3000/campaign/july-dinner/share |
| Step 7 - Confirm Details | http://127.0.0.1:3000/campaign/july-dinner/confirm |
| Step 8 - Confirmation SMS/QR | http://127.0.0.1:3000/campaign/july-dinner/confirmation |
| Online shop landing | http://127.0.0.1:3000/campaign/8pm-drop |
| Admin dashboard | http://127.0.0.1:3000/dashboard |
| Staff validation | http://127.0.0.1:3000/staff |
| Health API | http://127.0.0.1:3000/api/health |

## 2. Reset Test Data

The MVP uses local JSON persistence at:

```text
data/db.json
```

To reset the app to seeded data, stop the dev server and delete `data/db.json`. The next app/API load recreates it from seed data.

## 3. Automated Validation

Run these before handoff:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected result:

| Command | Expected |
|---|---|
| `npm run typecheck` | TypeScript exits with code 0 |
| `npm run lint` | No ESLint warnings or errors |
| `npm test` | Unit and integration tests pass |
| `npm run build` | Next.js production build succeeds |

Current automated test coverage:

| Test File | Coverage |
|---|---|
| `tests/unit/voucher-engine.test.ts` | attempts, final issue, duplicate prevention, staff redemption |
| `tests/integration/voucher-flow.test.ts` | date/time flow, final voucher issue, dashboard metrics, CSV export |

## 4. Public Customer Flow Test

Open:

```text
http://127.0.0.1:3000/campaign/july-dinner
```

### Happy Path
1. Confirm the page shows the BizFlow header, rule strip, and 8-step flow labels.
2. Click `Let's Hunt!` and confirm you are routed to `/date`.
3. Select an available date and click `Continue`.
4. Select an available time slot and click `Continue`.
5. On Hunt Intro, enter a unique mobile number, for example `+639170001111`.
6. Click `Start Hunting` and confirm you are routed to `/results`.
7. Confirm 3 voucher candidate cards appear.
8. Select one candidate and continue to `/share`.
9. Click `Skip for Now` or `Share Now`.
10. On Confirm & Details, enter:
   - Name: `Jane Doe`
   - Email: optional
   - Guests: `2`
11. Click `Confirm & Reserve`.
12. Confirm the confirmation page appears with:
   - voucher benefit
   - voucher code
   - mock QR block
   - selected date/time
   - confirmed status

Expected result:

```text
One final voucher is issued and unselected candidates are released.
```

### Duplicate Prevention
1. Complete the happy path with a phone number.
2. Refresh the campaign page.
3. Use the same phone number again.
4. Try to start or select a final voucher.

Expected result:

```text
The app blocks another final voucher for the same phone number in the same campaign.
```

### Sold-Out Slot Behavior
1. Open the restaurant campaign.
2. Look for a date/time marked `Sold Out`.
3. Try to select it.

Expected result:

```text
Sold-out dates or time slots are disabled and cannot be used to start a hunt.
```

## 5. Online Shop Flow Test

Open:

```text
http://127.0.0.1:3000/campaign/8pm-drop
```

Repeat the customer happy path with a different phone number.

Expected differences:

| Area | Expected |
|---|---|
| Campaign mode | Online shop tab is active |
| Guest count | Not required |
| Voucher | Issued against selected shopping window |

## 6. Staff Validation and Redemption Test

First issue a voucher from the customer flow and copy the voucher code.

Open:

```text
http://127.0.0.1:3000/staff
```

### Validate
1. Paste the voucher code into `Enter Voucher Code`.
2. Click `Validate`.

Expected result:

```text
Reservation details and validation result appear. Status should be Issued or valid.
```

### Redeem
1. Enter staff name.
2. Optionally enter purchase amount and note.
3. Click `Mark as Used`.

Expected result:

```text
Voucher status changes to Redeemed.
```

### Redeem Twice
1. Try to redeem the same code again.

Expected result:

```text
The app blocks the second redemption and shows an already-used message.
```

## 7. Admin Dashboard Test

Open:

```text
http://127.0.0.1:3000/dashboard
```

Validate:

| Area | Expected |
|---|---|
| Sidebar | Dark BizFlow admin navigation is visible |
| Metrics | Campaign, slot, voucher, redemption, booking, and share cards render |
| Charts | Trend, donut, funnel, and bar chart visual sections render |
| Campaign table | Seeded restaurant and online shop rows render |
| Slot table | Slot inventory rows render with status chips |
| Export button | CSV export link is available |

After issuing a voucher, refresh the dashboard.

Expected result:

```text
Issued voucher and attempt metrics increase.
```

## 8. CSV Export Test

Open:

```text
http://127.0.0.1:3000/api/export/campaigns/camp_july_dinner
```

Expected result:

```text
A CSV response downloads or displays with voucher_code, phone, name, benefit, status, issue time, expiry, and slot details.
```

## 9. API Smoke Tests

### Health
```bash
curl http://127.0.0.1:3000/api/health
```

Expected:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Public Campaign Data
```bash
curl http://127.0.0.1:3000/api/public/campaigns/july-dinner
```

Expected:

```text
Response includes campaign, business, and slots.
```

### Staff Validation Error
```bash
curl -X POST http://127.0.0.1:3000/api/staff/vouchers/validate \
  -H "Content-Type: application/json" \
  -d "{\"codeOrToken\":\"NOT-A-CODE\"}"
```

Expected:

```text
404-style error response with code E-VOUCHER-404.
```

## 10. Visual QA Checklist

Use desktop and mobile viewport sizes.

| Screen | Checks |
|---|---|
| `/campaign/july-dinner` | mobile app frame, campaign landing, product rules, primary CTA |
| `/campaign/july-dinner/date` | mobile date list, availability pills, progress indicator on step 2 |
| `/campaign/july-dinner/time` | time slots, low-stock/sold-out chips, progress indicator on step 3 |
| `/campaign/july-dinner/hunt` | hunt intro summary, mobile phone field, start hunting CTA |
| `/campaign/july-dinner/results` | 3 voucher candidate cards and selected state |
| `/campaign/july-dinner/share` | extra chance panel and share/skip actions |
| `/campaign/july-dinner/confirm` | selected voucher, user details, reservation summary |
| `/campaign/july-dinner/confirmation` | confirmation status, voucher code, QR block |
| `/campaign/8pm-drop` | online shop tab active, no guest-count dependency, shopping campaign copy |
| `/dashboard` | dark sidebar, dense admin tables, metric cards, charts, status chips |
| `/staff` | validation tabs, form fields, reservation details, result card, redeem button states |

Responsive checks:

- No text overlaps cards or buttons.
- Tables scroll horizontally on small screens.
- Primary actions remain visible and tappable.
- Disabled states are visually distinct.
- Status chips use correct colors: active/confirmed green, low stock orange, sold out/error red.

## 11. Known Testing Notes

- `npm run test:e2e` was attempted on 2026-07-01, but Playwright workers failed and the process hung without producing a useful report. Unit, integration, typecheck, lint, and build passed.
- `npm install` reported dependency vulnerabilities, including a Next.js security warning. Run a dependency security review before production use.
- `npm audit --json` requires explicit approval because it submits dependency inventory to the external npm audit service.
- The MVP datastore is local JSON, not a production concurrency-safe database. Production stock-control testing should be repeated after moving to PostgreSQL/Supabase transactions.

## 12. Release Readiness Gate

Before a demo or handoff, confirm:

| Gate | Required Result |
|---|---|
| Typecheck | Passed |
| Lint | Passed |
| Unit/integration tests | Passed |
| Production build | Passed |
| Manual public flow | Passed |
| Manual staff redemption | Passed |
| Manual dashboard/export | Passed |
| Security audit | Reviewed or explicitly deferred |
| E2E | Passed or explicitly deferred with reason |
