# Database Design

MVP persistence is `data/db.json` with the same logical entities required by the work order:
Business, Campaign, CampaignSlot, VoucherPool, EndUser, VoucherAttempt, Voucher, Reservation, SmsLog, RedemptionLog, and AnalyticsEvent.

## Production Migration
Move each collection to a PostgreSQL table. Use transactions and row-level locks for:
- candidate generation pool quantity decrement
- final voucher issue
- slot capacity decrement
- candidate release on selection or timeout

## Key Indexes
- Campaign.slug unique
- CampaignSlot.campaignId + date + startTime
- Voucher.campaignId + userId unique
- Voucher.voucherCode unique
- VoucherAttempt.campaignId + userId
