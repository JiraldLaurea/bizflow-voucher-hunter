# Smoke Test Checklist

| Check | Expected |
|---|---|
| GET /api/health | success true |
| /campaign/july-dinner | customer UI loads |
| Start hunt | 3 candidates appear |
| Select candidate | voucher code issued |
| /staff validation | issued code validates |
| Redeem | status becomes Redeemed |
| /dashboard | metrics load |
| CSV export | CSV downloads |
