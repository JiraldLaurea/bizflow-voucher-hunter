# System Architecture

Next.js App Router serves both frontend screens and API routes. `src/server/voucher-engine.ts` contains the public voucher-hunt domain logic, `src/server/admin.ts` contains admin configuration CRUD, `src/server/db.ts` provides SQLite persistence (`better-sqlite3`) plus schema/seed and row mappers, and `src/types/voucher.ts` shares contracts across frontend and backend.

## ADRs
- ADR-01: Use Next.js full-stack app for fast MVP delivery.
- ADR-02: Use SQLite (`better-sqlite3`) for runnable, transactional persistence; migrate to PostgreSQL/Supabase for multi-instance production, keeping the same transaction / conditional-update pattern.
- ADR-03: Use Zod for request validation.
- ADR-04: Use mock SMS logs for MVP and keep provider swap isolated.
- ADR-05: Enforce stock control with SQL transactions, conditional `WHERE remaining > 0` updates, and a `UNIQUE(campaign_id, user_id)` voucher constraint.
- ADR-06: Guard admin CRUD endpoints with a shared token (`ADMIN_ACCESS_TOKEN`); replace with a real session/auth layer before production.

## Runtime Flow
Browser -> Next.js page -> Next.js API route -> voucher engine / admin module -> SQLite transaction -> JSON API response.

## Security Notes
All public mutations validate request bodies, re-check campaign/slot state on the server, and enforce one final voucher per campaign user. Admin configuration endpoints require the shared admin token. Stock-changing operations run inside transactions with conditional updates so concurrent requests cannot over-issue.
