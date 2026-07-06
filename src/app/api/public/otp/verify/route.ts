import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { verifyOtp } from "@/server/otp";
import { enforceRateLimit } from "@/server/rate-limit";

const schema = z.object({
  campaignSlug: z.string().min(1),
  phone: z.string().min(7),
  code: z.string().regex(/^\d{6}$/, "code must be 6 digits")
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "otp/verify", { limit: 10, windowMs: 5 * 60_000 });
    const input = schema.parse(await request.json());
    return ok(verifyOtp(input));
  } catch (error) {
    return fail(error);
  }
}
