import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";

/** Lightweight mobile session check used after foregrounding and admin resets. */
export async function GET(request: Request) {
  try {
    return ok({ phone: await requireSignedInCustomerPhone(request) });
  } catch (error) {
    return fail(error);
  }
}
