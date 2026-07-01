# Deployment Runbook

## Local
1. `npm install`
2. copy `.env.example` to `.env.local` if needed
3. `npm run dev`

## Validation
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Production Notes
- Provision PostgreSQL/Supabase before real traffic.
- Replace local JSON datastore with transactional database repository.
- Configure real SMS provider credentials.
- Set `NEXT_PUBLIC_APP_URL`, `ADMIN_ACCESS_TOKEN`, and SMS variables in hosting environment.
