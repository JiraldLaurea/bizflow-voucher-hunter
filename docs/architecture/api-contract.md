# API Contract

All JSON endpoints return:

```ts
type SuccessResponse<T> = { success: true; data: T };
type ErrorResponse = { success: false; error: { code: string; message: string; details?: unknown } };
```

## Endpoints
- `GET /api/health`
- `GET /api/public/campaigns/[slug]`
- `GET /api/public/campaigns/[slug]/slots`
- `POST /api/public/hunt/start`
- `POST /api/public/hunt/attempt`
- `POST /api/public/hunt/select`
- `POST /api/public/voucher/resend`
- `POST /api/staff/vouchers/validate`
- `POST /api/staff/vouchers/redeem`
- `GET /api/dashboard/campaigns/[id]`
- `GET /api/export/campaigns/[id]`
