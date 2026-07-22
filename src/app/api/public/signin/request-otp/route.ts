import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { requestSignInOtp } from "@/server/otp";
import { enforceRateLimit } from "@/server/rate-limit";

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
