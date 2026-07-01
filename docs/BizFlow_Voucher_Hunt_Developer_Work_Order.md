# BizFlow Voucher Hunt Engine

_Developer Work Order and Functional Specification_

> **Document Purpose** This document translates the revised voucher hunting concept into a clear development work order. It is intended for developers, technical operators, product managers, and QA reviewers who need to implement the MVP and later expansion phases.

| Item | Description |
| --- | --- |
| Project | BizFlow Voucher Hunt Engine |
| Product Type | Reservation-based voucher hunting and customer acquisition platform for SMEs |
| Initial Industries | Restaurants, cafes, online shops, beauty/skincare clinics, pet clinics, local retailers |
| Primary Market | Philippines SMEs |
| Main Mechanic | User selects date/time first, sees remaining voucher slots, performs voucher hunt attempts, and selects 1 final voucher |
| Prepared For | Development team / technical implementation team |
| Version | v1.0 - Revised flow specification |

# 1. Executive Summary

The revised BizFlow Voucher Engine should be implemented as a reservation-based voucher hunting system. Instead of issuing a random voucher immediately after the user submits a form, the system must first show available dates and times, display the remaining voucher quantity for the selected slot, ask whether the user wants to challenge for a voucher, generate multiple voucher candidates, and allow the user to select only one final voucher.

This new flow simplifies the user journey, improves booking clarity for restaurants, and makes the same mechanic usable for online shopping campaigns where voucher availability is controlled by date and time.

> **Core Rule** One person can receive only one final voucher per campaign. The user may perform 3 base voucher hunt attempts, receive 3 voucher candidates, and select only 1 final voucher. Sharing the campaign may grant 1 additional attempt, up to 5 additional attempts per day.

# 2. Product Concept

## 2.1 Working Product Name

- Product: BizFlow Voucher Hunt Engine
- Feature name: Smart Voucher Hunt
- Positioning: A reservation-based voucher hunting marketing platform for SMEs
- Internal short name: Voucher Hunt Flow

## 2.2 Key Change from Previous Flow

| Area | Previous Flow | Revised Flow |
| --- | --- | --- |
| Voucher timing | Voucher is issued after a user submits a form | User selects date/time first, then challenges for voucher candidates |
| User experience | Simple claim form | Game-like voucher hunting experience |
| Business control | Voucher quantity can be controlled globally or daily | Voucher quantity can be controlled by date, time, branch, and campaign slot |
| Restaurant use case | Voucher first, reservation later | Reservation slot first, voucher confirmation after selection |
| Online shop use case | General discount code campaign | Time-based voucher drop or discount hunt campaign |
| Viral growth | Limited or no sharing mechanic | Share campaign to receive extra hunt chances |

# 3. User Roles

| Role | Description | Core Permissions |
| --- | --- | --- |
| End User | Consumer who participates in a voucher campaign | View slots, hunt vouchers, share campaign, select final voucher, receive code |
| Business Owner | SME client using the platform | View campaign performance, configure offers, export results |
| Campaign Admin | BizFlow/QROAD operator or client admin | Create campaigns, configure slots, voucher pools, rules, and reports |
| Store Staff | Restaurant/store employee | Validate voucher, mark redeemed, add order value and notes |
| System Admin | Platform-level technical admin | Manage businesses, users, integrations, SMS, and system settings |

# 4. High-Level User Flow

```
Ad / Social Link / QR
  -> Campaign Landing Page
  -> User selects date
  -> User selects time or event slot
  -> System displays remaining voucher slots
  -> User starts voucher hunt
  -> System generates 3 voucher candidates
  -> User may share to earn extra attempts, up to daily limit
  -> User selects 1 final voucher
  -> User identity and duplicate rules are verified
  -> Final voucher code or QR is issued
  -> SMS / email / confirmation page is sent
  -> User redeems at restaurant or online shop
  -> Staff / ecommerce webhook marks voucher as redeemed
  -> Dashboard updates campaign metrics
```

> **Implementation Note** For anti-abuse control, the recommended MVP should request phone number verification before generating voucher candidates. If the product owner wants a lighter user experience, phone verification may happen at final selection, but this increases duplicate-claim risk.

# 5. Restaurant Flow Requirements

Restaurant campaigns use date/time slots as actual visit or table reservation slots. A voucher should be valid only for the selected date/time unless the campaign admin enables rescheduling.

1. User opens restaurant voucher campaign page.
1. User selects visit date.
1. System displays available visit times and remaining voucher slots for each time.
1. User selects visit time and optionally number of guests.
1. System displays a message such as: "Only 2 voucher slots left for July 5, 7:00 PM."
1. User starts voucher hunt.
1. System generates 3 voucher candidates according to slot-level voucher pool rules.
1. User selects 1 final voucher, or shares the campaign to receive additional attempts before selecting.
1. System confirms identity and duplicate eligibility.
1. System issues final voucher code or QR code and confirms the reservation.
1. SMS confirmation is sent with restaurant name, code, date/time, benefit, rules, and redemption instruction.
1. Store staff validates code when the customer visits and marks it as redeemed.

| Restaurant Setting | Requirement |
| --- | --- |
| Branch | Support single branch in MVP; multi-branch should be supported in Phase 2 or configured manually. |
| Date availability | Admin can enable or disable campaign dates. |
| Time slots | Admin can define available times such as 12:00, 18:00, 19:00, 20:00. |
| Slot capacity | Admin can define total voucher seats/tables per time slot. |
| Guest count | Optional in MVP; recommended for restaurant campaigns. |
| Minimum spend | Admin can configure minimum spend for voucher validity. |
| Peak-time rules | High-value vouchers may be disabled for peak hours. |
| No-show policy | No-show users can be blocked from future campaigns or flagged for review. |

# 6. Online Shopping Flow Requirements

Online shopping campaigns use date/time slots as voucher drop windows or valid shopping windows. The user still selects date and time first, then hunts for voucher candidates.

1. User opens online shop voucher campaign page.
1. User selects voucher use date or campaign drop date.
1. User selects time window, for example 10:00 AM, 8:00 PM, or 10:00 PM.
1. System displays remaining code quantity for that date/time window.
1. User starts voucher hunt.
1. System generates 3 voucher candidates.
1. User may share to earn additional attempts before final selection.
1. User selects 1 final voucher.
1. System collects or verifies name, phone number, and optionally email.
1. Final voucher code is issued and sent by SMS and/or email.
1. User applies code during checkout within the allowed time window.
1. System marks code as redeemed through manual import, Shopify discount-code export, or ecommerce webhook integration.

| Online Shop Setting | Requirement |
| --- | --- |
| Event date | Admin can define voucher drop dates. |
| Event time | Admin can define time windows for code availability or validity. |
| Code quantity | Admin can define total codes by date/time slot. |
| Product restriction | Optional category or product-specific usage rule. |
| Minimum order value | Optional minimum checkout amount. |
| Validity window | Code may be valid for selected time only, a few hours, 24 hours, or custom expiry. |
| Shopify mode | MVP can export selected codes for manual Shopify upload; API integration can be Phase 2. |
| Redemption sync | MVP can support manual redemption upload; webhook/API should be Phase 2. |

# 7. Voucher Hunt Mechanics

## 7.1 Base Attempt Rules

| Rule | Default Requirement |
| --- | --- |
| Base attempts | 3 attempts per user per campaign before final selection. |
| Candidate count | Each attempt generates one candidate; base session therefore shows 3 candidates. |
| Final voucher | User can select only 1 candidate as the final voucher. |
| After final selection | No further attempts are allowed for that campaign. |
| Unselected candidates | Must be released back to the pool after final selection or timeout. |
| Candidate timeout | Recommended: 10 minutes. Configurable by campaign. |
| Duplicate candidates | By default, do not show duplicate benefit types in the first 3 attempts unless pool limitations require it. |

## 7.2 Extra Attempts by Sharing

| Rule | Default Requirement |
| --- | --- |
| Share reward | 1 verified share referral grants 1 additional attempt. |
| Daily limit | Maximum 5 additional attempts per user per day per campaign. |
| Total daily candidates | 3 base attempts + up to 5 extra attempts = up to 8 candidates before final selection. |
| Reward trigger | Do not grant reward only because the user tapped the share button. Reward should require a valid referral event. |
| Valid referral event | Recommended: referred visitor opens unique link and passes basic duplicate checks. |
| Reward timing | Reward can be granted immediately after valid referral event, or queued as pending until rules pass. |
| After user selects final voucher | User cannot earn or use more attempts for that campaign. |

## 7.3 Voucher Candidate Generation Logic

```
Input:
- campaign_id
- selected_slot_id
- user_id or verified phone
- remaining_attempt_count

Process:
1. Validate campaign is active.
2. Validate selected slot is active and not sold out.
3. Validate user has not already issued a final voucher in this campaign.
4. Load voucher pools for selected slot.
5. Exclude pools with remaining_quantity <= 0.
6. Exclude pools blocked by business rules, such as peak-time restrictions.
7. Randomly select one benefit using probability_weight and remaining_quantity.
8. Create VoucherAttempt record with status = Candidate.
9. Temporarily reduce or hold pool quantity depending on implementation mode.
10. Return candidate benefit to the user interface.
```

## 7.4 Final Selection Logic

```
Input:
- user_id or verified phone
- campaign_id
- selected_attempt_id

Process:
1. Confirm selected_attempt_id belongs to this user and campaign.
2. Confirm attempt status is Candidate or Held.
3. Confirm candidate has not expired.
4. Confirm user has not already issued a final voucher in this campaign.
5. Confirm selected slot still has capacity.
6. Mark selected attempt as Selected.
7. Release all other unselected candidates for this user and campaign.
8. Generate final unique voucher code and QR token.
9. Create Reservation or VoucherIssuance record.
10. Mark voucher status as Issued.
11. Send SMS/email confirmation.
12. Update slot and pool quantities.
13. Emit analytics event: voucher_final_selected.
```

# 8. Voucher Pool and Expiry Rules

Voucher pools are configured per campaign slot. A slot is one date/time window. Each slot can contain multiple benefit pools with separate quantity, probability, and expiry rules.

| Benefit | Example Quantity | Example Probability Weight | Recommended Expiry |
| --- | --- | --- | --- |
| 90% OFF | 1 | 1 | 24 to 48 hours |
| 50% OFF | 5 | 5 | 3 to 7 days |
| 30% OFF | 14 | 14 | 7 to 14 days |
| 20% OFF | 50 | 50 | 14 to 30 days |
| Free Item / Free Dessert | 30 | 30 | 7 to 30 days |

> **Important** The system must support both quantity-based and probability-weighted random selection. If a benefit pool reaches zero remaining quantity, it must be automatically excluded from future draws.

# 9. Voucher and Reservation State Model

| State | Applies To | Meaning |
| --- | --- | --- |
| Available | VoucherPool / Slot | Quantity is available for users. |
| Candidate | VoucherAttempt | Benefit shown as a candidate but not selected yet. |
| Held | VoucherAttempt / Pool | Candidate is temporarily reserved during selection window. |
| Selected | VoucherAttempt | User selected this candidate as final benefit. |
| Released | VoucherAttempt | Candidate was not selected or timed out and is returned to available pool. |
| Issued | Voucher | Final voucher code has been generated and delivered or is ready to deliver. |
| Reserved | Reservation | Restaurant slot is confirmed with selected voucher. |
| Redeemed | Voucher | Voucher was used in store or online checkout. |
| Expired | Voucher / Attempt | Voucher or candidate passed its allowed time. |
| Cancelled | Voucher / Reservation | User, business, or system cancelled it. |
| No-show | Reservation | Restaurant user did not visit for confirmed reservation. |

# 10. Duplicate Prevention and Abuse Control

| Control | MVP Requirement | Later Enhancement |
| --- | --- | --- |
| Phone number uniqueness | One final voucher per phone number per campaign. | Cross-campaign fraud scoring. |
| OTP verification | Recommended for MVP if SMS budget allows. | Mandatory for high-value campaigns. |
| Email uniqueness | Optional secondary check. | Email domain and disposable email detection. |
| Device/session check | Store browser fingerprint or session ID with privacy-safe approach. | Risk score using multiple signals. |
| IP rate limiting | Limit repeated attempts from same IP. | Adaptive rate limiting and bot detection. |
| Referral abuse | Reward only verified referrals, not share-button clicks. | Fraud review dashboard. |
| Candidate timeout | Release unselected candidates after timeout. | Real-time queue and reservation lock system. |

> **Do Not Implement** Do not issue 3 real discount codes to the same user. The first 3 results are candidates only. The final selected candidate becomes the real voucher code.

# 11. Admin Configuration Requirements

## 11.1 Campaign Setup

- Create business profile and campaign profile.
- Set industry type: restaurant, online shop, beauty, pet, retail, other.
- Set campaign period: start date and end date.
- Set landing page title, offer message, image/banner, and terms.
- Set customer information fields: name, phone, email, guest count, service, branch, consent fields.
- Set SMS and email templates.
- Enable or disable referral rewards.
- Set campaign-level duplicate policy.

## 11.2 Slot Setup

| Field | Description |
| --- | --- |
| slot_id | Unique slot ID. |
| campaign_id | Parent campaign. |
| date | Date when voucher can be used or claimed. |
| start_time | Slot start time. |
| end_time | Slot end time. |
| branch_id | Optional branch reference. |
| total_capacity | Maximum number of final vouchers or reservations for this slot. |
| remaining_capacity | Remaining available final voucher capacity. |
| status | Active, Sold Out, Closed, Paused. |

## 11.3 Voucher Pool Setup

| Field | Description |
| --- | --- |
| pool_id | Unique voucher pool ID. |
| slot_id | Parent date/time slot. |
| benefit_type | Discount percent, fixed amount, free item, free shipping, etc. |
| benefit_value | Example: 20%, 50%, PHP 300, Free Dessert. |
| total_quantity | Total quantity available in this pool. |
| remaining_quantity | Remaining quantity available. |
| probability_weight | Weighted random draw value. |
| expiry_rule | 48 hours, 7 days, selected slot only, custom. |
| minimum_spend | Optional minimum spend requirement. |
| restriction_json | Optional rule object: branch, product category, peak time, first-time user, etc. |

# 12. User Interface Requirements

| Screen | Core Elements | Notes |
| --- | --- | --- |
| Campaign Landing Page | Campaign title, offer summary, business logo, Start Voucher Hunt button | Mobile-first design. |
| Date Selection | Available dates and total remaining vouchers per date | Sold-out dates should be disabled. |
| Time Selection | Time windows and remaining voucher count per slot | Use urgency text such as "2 slots left". |
| Pre-Hunt Confirmation | Selected date/time, remaining quantity, base attempt count, rules | Confirm before consuming attempts. |
| Voucher Hunt Results | Candidate cards showing benefit, expiry, conditions, Select button | Candidate cards must not reveal internal pool IDs. |
| Share for Extra Try | Share link/button, progress count, daily limit display | Show reward only when referral is verified. |
| Final Selection Form | Name, phone, OTP, email, consent, guest count if restaurant | Final issue occurs only after validation. |
| Confirmation Page | Voucher code, QR, selected slot, benefit, expiry, instructions | Include SMS resend if available. |
| Error / Sold Out Page | Clear sold-out or expired message and alternate slot suggestion | Avoid dead-end user experience. |

# 13. Staff and Business Owner Interface Requirements

## 13.1 Staff Redemption Page

- Mobile-friendly page for store staff.
- Search by voucher code, QR scan, or customer phone number.
- Display only necessary information: customer name, selected slot, benefit, expiry, status, and redemption rules.
- Allow staff to mark voucher as redeemed.
- Allow optional purchase amount and internal note entry.
- Show clear errors: already used, expired, wrong branch, wrong time, cancelled, not found.

## 13.2 Business Dashboard

| Metric | Description |
| --- | --- |
| Landing page visits | Number of users who opened the campaign page. |
| Date/time selections | Number of users who selected each slot. |
| Hunt starts | Number of users who started voucher hunt. |
| Attempts used | Total base and referral attempts used. |
| Candidates generated | Candidate benefits generated by type. |
| Final vouchers issued | Final selected vouchers. |
| Redemptions | Used vouchers in restaurant or online shop. |
| No-shows | Confirmed restaurant reservations without visit. |
| Referral activity | Shares, valid referrals, extra attempts granted. |
| Slot performance | Performance by date/time slot. |
| Estimated revenue | Optional from staff order value or ecommerce sync. |

# 14. Data Model Requirements

The following database tables or equivalent models are required for MVP. Field names may be adjusted by the developer, but the business meaning must be preserved.

| Table | Purpose |
| --- | --- |
| Business | Stores client business information. |
| Campaign | Stores campaign-level settings and status. |
| CampaignSlot | Stores date/time availability and remaining capacity. |
| VoucherPool | Stores benefit pools for each slot. |
| EndUser | Stores campaign participant identity and contact fields. |
| VoucherAttempt | Stores each voucher hunt attempt and candidate result. |
| Voucher | Stores final issued voucher code or QR voucher. |
| Reservation | Stores restaurant booking information linked to final voucher. |
| ReferralLink | Stores unique referral links by user and campaign. |
| ReferralReward | Stores extra-attempt rewards and validation status. |
| SmsLog | Stores outbound SMS body, status, timestamp, and failure reason. |
| RedemptionLog | Stores staff or ecommerce redemption events. |
| AnalyticsEvent | Stores important funnel events for reporting. |

## 14.1 Suggested Core Fields

```
CampaignSlot
- id
- campaign_id
- date
- start_time
- end_time
- timezone
- branch_id nullable
- total_capacity
- remaining_capacity
- status
- created_at
- updated_at

VoucherPool
- id
- slot_id
- benefit_type
- benefit_value
- display_label
- total_quantity
- remaining_quantity
- probability_weight
- expiry_type
- expiry_value
- minimum_spend nullable
- restriction_json nullable
- status

VoucherAttempt
- id
- campaign_id
- slot_id
- user_id
- attempt_number
- source_type: base | referral_bonus | admin_bonus
- benefit_type
- benefit_value
- pool_id
- status: Candidate | Held | Selected | Released | Expired
- expires_at
- created_at

Voucher
- id
- campaign_id
- slot_id
- user_id
- selected_attempt_id
- voucher_code
- qr_token
- benefit_type
- benefit_value
- status: Issued | Delivered | Redeemed | Expired | Cancelled | NoShow
- issued_at
- expires_at
- redeemed_at nullable
```

# 15. API Requirements

| Endpoint | Method | Purpose |
| --- | --- | --- |
| /api/campaigns | POST | Create campaign. |
| /api/campaigns/{id} | GET/PATCH | Read or update campaign. |
| /api/campaigns/{id}/slots | GET/POST | List or create date/time slots. |
| /api/slots/{slotId}/pools | GET/POST | List or create voucher pools for a slot. |
| /api/public/campaigns/{slug} | GET | Public campaign page data. |
| /api/public/campaigns/{slug}/slots | GET | Public available dates/times and remaining counts. |
| /api/public/hunt/start | POST | Start or resume voucher hunt session. |
| /api/public/hunt/attempt | POST | Generate one voucher candidate. |
| /api/public/hunt/select | POST | Select final voucher and issue code. |
| /api/public/referral/open | POST/GET | Track referral link opening. |
| /api/public/referral/reward | POST | Validate and grant extra attempt. |
| /api/public/voucher/resend | POST | Resend voucher confirmation. |
| /api/staff/vouchers/validate | POST | Validate code or QR token. |
| /api/staff/vouchers/redeem | POST | Mark voucher as redeemed. |
| /api/dashboard/campaigns/{id} | GET | Campaign dashboard metrics. |
| /api/export/campaigns/{id} | GET | CSV export for leads, vouchers, attempts, redemptions. |

# 16. Event Tracking Requirements

| Event Name | Trigger |
| --- | --- |
| campaign_page_view | User opens campaign landing page. |
| date_selected | User selects campaign date. |
| time_selected | User selects campaign time slot. |
| hunt_started | User starts voucher hunt. |
| voucher_candidate_generated | System returns one candidate. |
| share_link_created | User creates share link. |
| share_link_opened | Another visitor opens referral link. |
| extra_attempt_granted | System grants referral bonus attempt. |
| voucher_final_selected | User selects final voucher. |
| voucher_issued | Final voucher code is created. |
| sms_sent | SMS sent to user. |
| voucher_redeemed | Voucher used in store or online. |
| reservation_no_show | Restaurant marks reservation as no-show. |

# 17. SMS and Message Templates

## 17.1 Restaurant Confirmation SMS

```
[{{business_name}}] Your voucher is confirmed.
Code: {{voucher_code}}
Benefit: {{benefit_label}}
Date/Time: {{selected_date}} {{selected_time}}
Guests: {{guest_count}}
Show this SMS or QR at the restaurant. Valid until {{expiry_date}}.
Terms: {{short_terms}}
```

## 17.2 Online Shop Confirmation SMS

```
[{{business_name}}] Your shopping voucher is confirmed.
Code: {{voucher_code}}
Benefit: {{benefit_label}}
Use window: {{selected_date}} {{selected_time_window}}
Shop here: {{shop_url}}
Valid until {{expiry_date}}. Terms: {{short_terms}}
```

## 17.3 Share Reward Message

```
Share this campaign with a friend and get 1 extra voucher hunt chance.
Daily limit: 5 bonus chances.
Your link: {{referral_url}}
```

# 18. MVP Scope

| MVP Feature | Required |
| --- | --- |
| Business and campaign creation | Yes |
| Date/time slot creation | Yes |
| Slot-level voucher pool setup | Yes |
| Public campaign landing page | Yes |
| Date/time selection before voucher hunt | Yes |
| Remaining slot quantity display | Yes |
| 3 base voucher hunt attempts | Yes |
| Final selection of 1 voucher | Yes |
| One person, one final voucher rule | Yes |
| SMS confirmation | Yes |
| Staff validation page | Yes |
| Manual redemption | Yes |
| Basic dashboard | Yes |
| CSV export | Yes |
| Referral extra attempt | Recommended Phase 2 unless MVP timeline allows |
| Shopify API integration | Phase 2 |
| Meta comment-to-DM integration | Phase 2 |
| AI offer optimization | Later stage |

# 19. Exclusions from MVP

- Full Meta API comment automation, unless already available through a third-party chatbot tool.
- Full Shopify real-time discount code sync. MVP may use export/import.
- Advanced fraud detection beyond basic duplicate prevention and rate limits.
- POS integration.
- Multi-branch advanced dashboard if not required for first pilot.
- AI-driven automatic campaign recommendation.
- Payment or deposit feature for restaurant reservations.
- Mobile app. MVP should be responsive web first.

# 20. Recommended Development Phases

| Phase | Goal | Main Deliverables |
| --- | --- | --- |
| Phase 1: Core MVP | Validate revised user flow | Campaign setup, slots, pools, public page, 3 attempts, final voucher, SMS, staff validation, basic dashboard |
| Phase 2: Growth Features | Improve viral and operational performance | Referral rewards, OTP, QR code, reminders, no-show tagging, Shopify export/API, GA4/Meta Pixel |
| Phase 3: Automation | Scale managed service operations | Meta DM automation, retargeting, AI offer recommendation, CRM segmentation, multi-branch controls |
| Phase 4: Enterprise | Support larger clients | POS integration, franchise dashboard, advanced fraud rules, payment/deposit, custom API integrations |

# 21. Technical Implementation Notes

## 21.1 Recommended Stack

| Layer | Recommendation |
| --- | --- |
| Frontend | Next.js / React / TypeScript, mobile-first UI |
| Backend | Node.js / NestJS or Next.js API Routes for MVP |
| Database | PostgreSQL or Supabase; SQLite acceptable only for local prototype |
| Auth | Admin login, staff login, public session token for campaign participants |
| SMS | Twilio, Vonage, Infobip, or local Philippine SMS aggregator |
| Email | SendGrid, Mailgun, Resend, or existing provider |
| Analytics | Internal AnalyticsEvent table plus GA4/Meta Pixel later |
| Hosting | Vercel + managed DB for MVP, or AWS/GCP/DigitalOcean |

## 21.2 Concurrency and Stock Control

Voucher pool and slot quantities must be protected against race conditions. Multiple users may hunt at the same time, especially when high-value vouchers are available.

- Use database transactions when reducing remaining_quantity or remaining_capacity.
- Use row-level locks or atomic update conditions where possible.
- If using Supabase/PostgreSQL, implement stock update as a transaction or RPC function.
- Never trust remaining quantity shown on the frontend; always re-check on the server before issuing final voucher.
- Release held candidates when candidate expires or when the user selects another final voucher.

# 22. Acceptance Criteria

| Area | Acceptance Criteria |
| --- | --- |
| Date/time first flow | User cannot start voucher hunt without selecting a valid active slot. |
| Remaining quantity | Slot list shows remaining quantity and disables sold-out slots. |
| 3 base attempts | New eligible user can generate exactly 3 base candidates before referral bonus. |
| One final voucher | User can select only one final voucher per campaign. |
| Candidate release | Unselected candidates are released after final selection or timeout. |
| Duplicate prevention | Same phone number cannot issue another final voucher in same campaign. |
| SMS delivery | Final issued voucher sends confirmation SMS with correct details. |
| Restaurant reservation | Restaurant campaign creates reservation linked to selected date/time. |
| Online shop mode | Online shop campaign issues code linked to selected date/time use window. |
| Staff validation | Staff can validate and redeem code; invalid states are clearly displayed. |
| Dashboard | Admin can see counts for visits, hunts, attempts, final vouchers, redemptions, and slot performance. |
| Export | Admin can export leads, vouchers, attempts, and redemptions as CSV. |

# 23. QA Test Scenarios

| Test Case | Expected Result |
| --- | --- |
| Open active campaign page | Page loads with campaign title, available dates, and CTA. |
| Select sold-out date/time | Slot is disabled or shows sold-out message. |
| Start hunt without selecting slot | System blocks request. |
| Generate 3 candidates | Exactly 3 candidates are shown for base attempts. |
| Try fourth base attempt without referral | System blocks request. |
| Select final voucher | Voucher code is issued and other candidates are released. |
| Same phone tries again | System blocks duplicate final voucher. |
| Candidate timeout | Candidate expires and pool quantity is released. |
| Referral valid open | User receives 1 additional attempt if daily limit not exceeded. |
| Referral abuse: same device/self click | Reward is rejected or marked pending. |
| Staff redeem valid voucher | Voucher status becomes Redeemed. |
| Staff redeem expired voucher | System returns Expired and blocks redemption unless admin override exists. |
| Online shop code export | Export file includes voucher_code, benefit, expiry, selected window. |

# 24. Open Questions for Product Owner

- Should phone/OTP verification happen before voucher hunt or only at final voucher selection?
- Should the 3 base attempts be generated all at once or one by one with animation?
- Should users be allowed to reschedule restaurant reservations after final voucher selection?
- Should high-value vouchers such as 90% OFF require a deposit or stricter verification?
- Should online shopping vouchers be valid only during the selected time window or for a fixed period after issue?
- Should referral rewards be granted after a referral link open, after referred user joins hunt, or after referred user issues final voucher?
- Should the MVP include Shopify API integration or only CSV export/import?
- What is the first pilot client type: restaurant, online shop, skincare clinic, or other?

# 25. Developer Delivery Checklist

| Checklist Item | Required Before Delivery |
| --- | --- |
| Git repository | Project is committed with clear branch and commit history. |
| Environment variables | .env.example is updated; no API keys hardcoded. |
| Database migrations | Migration files are included and tested. |
| Seed data | Sample campaign with restaurant and online shop modes is included. |
| Build | Production build succeeds. |
| Lint/type check | No critical lint or type errors. |
| Responsive UI | Public flow works on mobile screen sizes. |
| Race condition test | Concurrent attempts do not over-issue vouchers. |
| Security | Public APIs validate campaign, slot, user, and attempt ownership. |
| README | Setup, run, and test instructions are documented. |
| QA evidence | Developer provides screenshots or test results for main flows. |

# Appendix A. Sample Campaign Configuration

```
Campaign: July Dinner Voucher Hunt
Business: Sample Restaurant
Mode: Restaurant
Campaign Period: July 1 - July 31
Base Attempts: 3
Referral Bonus: 1 attempt per valid referral
Daily Referral Bonus Limit: 5
Final Voucher Limit: 1 per phone number per campaign
Candidate Timeout: 10 minutes

Slot: July 5, 7:00 PM - 8:30 PM
Total Capacity: 20 final vouchers
Voucher Pools:
- 90% OFF: quantity 1, weight 1, expiry 48 hours, min spend PHP 1,500
- 50% OFF: quantity 3, weight 5, expiry 7 days, min spend PHP 1,200
- 20% OFF: quantity 16, weight 50, expiry 30 days, min spend PHP 800
```

# Appendix B. Sample Online Shop Configuration

```
Campaign: 8PM Shopping Voucher Drop
Business: Sample Shopify Store
Mode: Online Shop
Base Attempts: 3
Referral Bonus Limit: 5 per day
Final Voucher Limit: 1 per phone number per campaign

Slot: July 5, 8:00 PM - 10:00 PM
Total Capacity: 100 final vouchers
Voucher Pools:
- 90% OFF: quantity 1, weight 1, expiry 2 hours, minimum order PHP 2,000
- 50% OFF: quantity 5, weight 5, expiry 24 hours, minimum order PHP 1,500
- 20% OFF: quantity 94, weight 50, expiry 7 days, minimum order PHP 1,000

MVP Redemption Mode:
- Export generated codes as CSV for Shopify discount code import.
- Import redeemed code report manually or mark as redeemed from admin dashboard.
```
