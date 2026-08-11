import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { assertDevToolsEnabledFor } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { devRefreshIssuedVouchers } from "@/server/voucher-engine";

/**
 * Dev-tools helper behind the More tab's dev tools: moves this phone's expired
 * bookings to the next slot with room and re-dates their vouchers, so the
 * redemption flow stays testable as demo data ages.
 *
 * Open to the production developer account for its own bookings only — see the
 * ordering note in ../reset/route.ts.
 */
export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "hunt/dev-refresh-vouchers", {
      limit: 30,
      windowMs: 60_000,
    });
    const phone = await requireSignedInCustomerPhone(request);
    assertDevToolsEnabledFor(phone, "Refreshing vouchers");
    return ok(await devRefreshIssuedVouchers({ phone }));
  } catch (error) {
    return fail(error);
  }
}
