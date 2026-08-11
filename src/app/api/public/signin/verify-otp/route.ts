import { z } from "zod";
import { issueCustomerToken, setCustomerAuthCookies } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { verifySignInOtp } from "@/server/otp";
import { normalizePhone } from "@/server/phone";
import { enforceRateLimit } from "@/server/rate-limit";

const schema = z.object({
  phone: z.string().min(7),
  code: z.string().regex(/^\d{6}$/, "code must be 6 digits"),
  issueToken: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "signin/verify-otp", {
      limit: 10,
      windowMs: 5 * 60_000,
    });
    const input = schema.parse(await request.json());
    // The account under attack is the number, not the address the guesses come
    // from. Without this, spreading the attempts across addresses bought back
    // an unlimited budget against one victim's six-digit code.
    //
    // Keyed on the normalized number, never the raw input: `09171234567`,
    // `+639171234567`, `639171234567` and every spaced/dashed/bracketed spelling
    // of them are one account but were one bucket each, so an attacker could
    // mint fresh budget indefinitely just by re-punctuating the same number.
    // That matters most to the fixed-code accounts in `@/server/otp`, whose
    // codes never expire and are never consumed.
    await enforceRateLimit(request, "signin/verify-otp", {
      limit: 10,
      windowMs: 15 * 60_000,
      subject: normalizePhone(input.phone) ?? input.phone,
    });
    const { phone } = await verifySignInOtp(input);
    // Only now — after proving ownership — are the httpOnly auth cookies set.
    await setCustomerAuthCookies(phone);
    const mobileClient =
      input.issueToken === true ||
      request.headers.get("x-client")?.toLowerCase() === "mobile";
    if (mobileClient) {
      return ok({ phone, token: await issueCustomerToken(phone) });
    }
    return ok({ phone });
  } catch (error) {
    return fail(error);
  }
}
