import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { assertDevToolsEnabled } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { devRefreshIssuedVouchers } from "@/server/voucher-engine";

/**
 * Development-only helper behind the More tab's dev tools: moves this phone's
 * expired bookings to the next slot with room and re-dates their vouchers, so
 * the redemption flow stays testable as demo data ages.
 */
export async function POST(request: Request) {
  try {
    assertDevToolsEnabled("Refreshing vouchers");
    await enforceRateLimit(request, "hunt/dev-refresh-vouchers", {
      limit: 30,
      windowMs: 60_000,
    });
    const phone = await requireSignedInCustomerPhone(request);
    return ok(await devRefreshIssuedVouchers({ phone }));
  } catch (error) {
    return fail(error);
  }
}
