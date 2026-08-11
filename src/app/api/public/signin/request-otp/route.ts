import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { requestSignInOtp } from "@/server/otp";
import { normalizePhone } from "@/server/phone";
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
    // Also budget by the number being texted. The address limit above cannot
    // stop an SMS flood — the attacker picks the address, the victim owns the
    // number — and every send costs real SMPP credit. Normalized, so the same
    // number spelled three ways shares one budget rather than getting three.
    await enforceRateLimit(request, "signin/request-otp", {
      limit: 5,
      windowMs: 15 * 60_000,
      subject: normalizePhone(input.phone) ?? input.phone,
    });
    return ok(await requestSignInOtp(input));
  } catch (error) {
    return fail(error);
  }
}
