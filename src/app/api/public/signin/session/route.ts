import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { devToolsEnabledFor } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";

/**
 * Lightweight mobile session check used after foregrounding and admin resets.
 *
 * Also carries `devTools`, because both clients decide at build time whether to
 * render their dev panel (`NODE_ENV`, `__DEV__`) and a production build of
 * either would otherwise have no way to learn that this particular number is the
 * developer account. It is advisory — every tool re-checks the gate server-side.
 */
export async function GET(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    return ok({ phone, devTools: devToolsEnabledFor(phone) });
  } catch (error) {
    return fail(error);
  }
}
