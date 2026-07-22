import { clearCustomerAuthCookies } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";

// The auth cookies are httpOnly, so sign-out must clear them server-side.
export async function POST() {
  try {
    clearCustomerAuthCookies();
    return ok({ signedOut: true });
  } catch (error) {
    return fail(error);
  }
}
