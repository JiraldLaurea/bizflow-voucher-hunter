# BizFlow Voucher Hunt Engine PRD

## 1. Project Overview
- **Service Name**: BizFlow Voucher Hunt Engine
- **Core Concept**: A reservation-first voucher hunting platform where users choose a date/time slot, reveal voucher candidates, and select one final voucher.
- **Project Type**: Full-stack responsive web app.
- **Primary Target Users**: End users, business owners, campaign admins, store staff, and system admins.
- **Service Scope**: MVP for Philippine SMEs, initially restaurants and online shops.
- **Core Value Proposition**: Better slot control for businesses, clearer booking flow for customers, and a game-like acquisition mechanic.

## 2. Module Definitions
| Module ID | Module Name | Description | Included Features | Dependent Modules |
|---|---|---|---|---|
| public-hunt | Public Voucher Hunt | Customer campaign journey | campaign page, date/time selection, hunt attempts, final issue | voucher-core |
| voucher-core | Voucher Core | Shared campaign, slot, pool, attempt, voucher logic | stock checks, weighted draws, duplicate prevention | - |
| staff-redemption | Staff Redemption | Staff validation and manual redemption | validate code, redeem, redemption logs | voucher-core |
| admin-dashboard | Admin Dashboard | Campaign performance and export | metrics, slot performance, CSV export | voucher-core |

## 3. User Roles and Permission Matrix
| Feature | End User | Store Staff | Campaign Admin | Business Owner | System Admin |
|---|---|---|---|---|---|
| View campaign | Allowed | Read-only | Allowed | Allowed | Allowed |
| Hunt vouchers | Allowed | Forbidden | Forbidden | Forbidden | Forbidden |
| Select final voucher | Own data only | Forbidden | Forbidden | Forbidden | Forbidden |
| Redeem voucher | Forbidden | Allowed | Allowed | Allowed | Allowed |
| View dashboard | Forbidden | Read-only | Allowed | Allowed | Allowed |
| Export CSV | Forbidden | Forbidden | Allowed | Allowed | Allowed |

## 4. Screen/Page/View List
| Screen ID | Screen Name | Path | Roles | Module |
|---|---|---|---|---|
| SCR-PUBLIC-01 | Campaign Landing and Hunt Flow | /campaign/[slug] | End User | public-hunt |
| SCR-STAFF-01 | Reservation / Order Validation | /staff | Store Staff, Admin | staff-redemption |
| SCR-ADMIN-01 | Admin Dashboard | /dashboard | Admin, Business Owner | admin-dashboard |

## 5. Functional Requirements
| Feature ID | Feature Name | Module | Priority | Description |
|---|---|---|---|---|
| F-PUBLIC-01 | Date/time-first flow | public-hunt | P0 | Users cannot hunt without an active slot. |
| F-PUBLIC-02 | Remaining quantity display | public-hunt | P0 | Slots display remaining final voucher capacity and disable sold-out windows. |
| F-PUBLIC-03 | Three base candidates | voucher-core | P0 | Eligible users receive exactly three base voucher candidates. |
| F-PUBLIC-04 | One final voucher | voucher-core | P0 | User selects one candidate; all other candidates are released. |
| F-PUBLIC-05 | Duplicate prevention | voucher-core | P0 | One final voucher per phone number per campaign. |
| F-STAFF-01 | Manual redemption | staff-redemption | P0 | Staff can validate and redeem issued vouchers. |
| F-ADMIN-01 | Metrics dashboard | admin-dashboard | P0 | Admin sees visits, hunts, attempts, issues, redemptions, and slot performance. |
| F-ADMIN-02 | CSV export | admin-dashboard | P0 | Admin exports issued vouchers for operations or ecommerce import. |

## 6. Data Model
Business, Campaign, CampaignSlot, VoucherPool, EndUser, VoucherAttempt, Voucher, Reservation, SmsLog, RedemptionLog, and AnalyticsEvent are implemented as typed local JSON records for MVP. The same fields map directly to PostgreSQL tables for production.

## 7. State Transition Rules
| Entity | Current | Action | Next | Error |
|---|---|---|---|---|
| VoucherAttempt | Candidate | select | Selected | E-ATTEMPT-STATE |
| VoucherAttempt | Candidate | final selected elsewhere | Released | - |
| VoucherAttempt | Candidate | timeout | Expired | E-ATTEMPT-EXPIRED |
| Voucher | Issued | staff redeem | Redeemed | E-VOUCHER-REDEEMED |
| CampaignSlot | active | capacity reaches zero | sold_out | E-SLOT-SOLD-OUT |

## 8. Business Logic and Policies
| Policy ID | Rule | Error Code |
|---|---|---|
| VH-P-01 | User must select an active slot before hunting. | E-SLOT-404 / E-SLOT-SOLD-OUT |
| VH-P-02 | Base attempts are limited to 3 per campaign user. | E-ATTEMPT-LIMIT |
| VH-P-03 | One phone number can issue one final voucher per campaign. | E-DUPLICATE-FINAL |
| VH-P-04 | Candidate timeout is 10 minutes by default. | E-ATTEMPT-EXPIRED |
| VH-P-05 | Final issue rechecks slot and pool state server-side. | E-SLOT-SOLD-OUT / E-POOL-EMPTY |

## 9. API Endpoint List
| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/public/campaigns/[slug] | Public campaign data |
| GET | /api/public/campaigns/[slug]/slots | Public slot availability |
| POST | /api/public/hunt/start | Start or resume hunt |
| POST | /api/public/hunt/attempt | Generate one candidate |
| POST | /api/public/hunt/select | Select final voucher |
| POST | /api/public/voucher/resend | Mock resend confirmation |
| POST | /api/staff/vouchers/validate | Validate code or QR token |
| POST | /api/staff/vouchers/redeem | Mark voucher redeemed |
| GET | /api/dashboard/campaigns/[id] | Campaign metrics |
| GET | /api/export/campaigns/[id] | CSV export |

## 10. External Service Integrations
SMS is implemented as a mock `SmsLog` record in MVP. Production can swap in Twilio, Vonage, Infobip, or a Philippine SMS aggregator behind the same confirmation event.

## 11. Error Codes and Messages
E-CAMPAIGN-404, E-SLOT-404, E-SLOT-SOLD-OUT, E-USER-PHONE, E-DUPLICATE-FINAL, E-ATTEMPT-LIMIT, E-POOL-EMPTY, E-ATTEMPT-404, E-ATTEMPT-STATE, E-ATTEMPT-EXPIRED, E-VOUCHER-404, E-VOUCHER-REDEEMED, E-VOUCHER-EXPIRED, E-VALIDATION-400.

## 12. Notification/Event System
Analytics events are stored for campaign page view, hunt started, voucher candidate generated, voucher final selected, voucher issued, sms sent, and voucher redeemed. SMS confirmation is recorded in `SmsLog`.

## 13. Non-Functional Requirements
- Public flow is mobile-first and responsive.
- Server APIs validate input with Zod.
- Stock and duplicate checks are server-side.
- MVP uses local JSON persistence; production should use database transactions and row-level locks.

## 14. MVP / Phase Definition
MVP includes public flow, slot-level pools, 3 attempts, one final voucher, mock SMS, staff redemption, dashboard, and CSV export. Referral reward validation, OTP, QR scanner camera integration, Shopify API, and advanced fraud scoring are Phase 2+.

## 15. Technology Stack
Next.js, React, TypeScript, Zod, Vitest, Playwright, local JSON persistence for MVP. PostgreSQL/Supabase is the production database target.

## 16. Glossary
Candidate: a temporary voucher result. Final voucher: the selected candidate that receives a real code. Slot: selected date/time window. Pool: benefit stock and probability configuration.
