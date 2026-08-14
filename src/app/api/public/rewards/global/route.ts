import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { listGlobalRewards } from "@/server/rewards-network";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * What Global LP can be converted into. A list, so adding a second denomination
 * is a row in the catalogue rather than another screen in the app.
 *
 * Sign-in guarded like the rest of the storefront: the prices are only useful
 * next to a balance, and the balance needs a session anyway.
 */
export async function GET(request: Request) {
  try {
    await requireSignedInCustomerPhone(request);
    return ok(listGlobalRewards());
  } catch (error) {
    return fail(error);
  }
}
