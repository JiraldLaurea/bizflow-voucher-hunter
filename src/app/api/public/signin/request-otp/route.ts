import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { requestSignInOtp } from "@/server/otp";
import { enforceRateLimit } from "@/server/rate-limit";

/**
 * Sign-in blocks on SMS delivery — unlike the voucher confirm, there is nothing
 * useful to return until the code is actually away — and an SMPP send starts
 * with a bind that costs seconds on a cold instance. Vercel's default 10s
 * ceiling cuts that off mid-bind and returns an opaque 504.
 *
 * 30s leaves room for the worst realistic case (a cold bind plus a submit, see
 * the timeout budget in src/server/sms.ts) while still failing well short of a
 * customer giving up on the sign-in screen.
 */
export const maxDuration = 30;

const schema = z.object({ phone: z.string().min(7) });

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "signin/request-otp", {
      limit: 5,
      windowMs: 5 * 60_000,
    });
    const input = schema.parse(await request.json());
    return ok(await requestSignInOtp(input));
  } catch (error) {
    return fail(error);
  }
}
