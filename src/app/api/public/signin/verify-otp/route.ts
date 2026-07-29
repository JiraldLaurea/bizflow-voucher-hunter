import { z } from "zod";
import { issueCustomerToken, setCustomerAuthCookies } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { verifySignInOtp } from "@/server/otp";
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
