# Public Hunt Specification

## Overview
Implements the customer voucher hunt journey: landing, date selection, time selection, hunt intro, candidate reveal, share prompt, final details, and confirmation.

## Features
F-PUBLIC-01, F-PUBLIC-02, F-PUBLIC-03, F-PUBLIC-04, F-PUBLIC-05.

## API Mapping
| Feature | API |
|---|---|
| Date/time display | GET /api/public/campaigns/[slug] |
| Start hunt | POST /api/public/hunt/start |
| Generate candidates | POST /api/public/hunt/attempt |
| Select final | POST /api/public/hunt/select |

## Screens
SCR-PUBLIC-01: `/campaign/[slug]` - Campaign Landing
SCR-PUBLIC-02: `/campaign/[slug]/date` - Select Date
SCR-PUBLIC-03: `/campaign/[slug]/time` - Select Time
SCR-PUBLIC-04: `/campaign/[slug]/hunt` - Hunt Intro
SCR-PUBLIC-05: `/campaign/[slug]/results` - Voucher Results
SCR-PUBLIC-06: `/campaign/[slug]/share` - Share for Extra Chance
SCR-PUBLIC-07: `/campaign/[slug]/confirm` - Confirm & Details
SCR-PUBLIC-08: `/campaign/[slug]/confirmation` - Confirmation SMS/QR

## Acceptance
Sold-out slots are disabled, exactly 3 base candidates can be generated, and one selected candidate issues a final voucher code.
