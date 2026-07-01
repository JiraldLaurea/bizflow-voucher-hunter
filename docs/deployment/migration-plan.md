# Migration Plan

MVP uses local JSON persistence for prototype speed. Production migration should create PostgreSQL tables matching `src/types/voucher.ts`, seed campaign data, and replace `src/server/db.ts` with transactional repository functions.

Critical transaction paths:
- candidate generation
- final voucher selection
- staff redemption
- expired candidate release
