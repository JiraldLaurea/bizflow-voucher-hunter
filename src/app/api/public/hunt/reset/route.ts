import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { assertDevToolsEnabled } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { resetHuntForPhone } from "@/server/voucher-engine";

// Development-only helper behind the More page's dev tools: clears one phone's
// hunt (attempts, voucher, reservation) across every campaign it has hunted and
// returns the held stock, so the flow can be replayed without reseeding the
// database.
//
// Takes no body — the phone comes from the signed-in session and the reset is
// deliberately not scoped to a campaign. Callers may still post one; it is
// ignored rather than rejected so an older mobile build keeps working.
export async function POST(request: Request) {
  try {
    assertDevToolsEnabled("Hunt reset");
    await enforceRateLimit(request, "hunt/reset", { limit: 30, windowMs: 60_000 });
    const phone = await requireSignedInCustomerPhone(request);
    return ok(await resetHuntForPhone({ phone }));
  } catch (error) {
    return fail(error);
  }
}
