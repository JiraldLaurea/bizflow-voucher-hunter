import {
  clearCustomerAuthCookies,
  revokeCustomerToken,
} from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";

// The auth cookies are httpOnly, so sign-out must clear them server-side.
export async function POST(request: Request) {
  try {
    await revokeCustomerToken(request);
    clearCustomerAuthCookies();
    return ok({ signedOut: true });
  } catch (error) {
    return fail(error);
  }
}
