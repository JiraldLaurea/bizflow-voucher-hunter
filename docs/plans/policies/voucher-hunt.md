# Voucher Hunt Policy

## Rules
| Policy | Backend Enforcement | User Feedback |
|---|---|---|
| Active slot required | `getSlotOrThrow` checks campaign and slot status | Disable sold-out slot buttons and show API error |
| 3 base attempts | attempt count is checked before draw | Start button shows remaining chances |
| One final voucher | voucher lookup by campaign and user phone | Duplicate final issue is blocked |
| Candidate release | unselected candidates are released after final selection | Confirmation explains only one final voucher |
| Staff redemption state | redeemed and expired vouchers cannot be reused | Staff page shows status and disables redeem |
