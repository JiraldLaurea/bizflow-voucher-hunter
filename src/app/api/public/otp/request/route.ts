import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { requestOtp } from "@/server/otp";
import { enforceRateLimit } from "@/server/rate-limit";

const schema = z.object({
  campaignSlug: z.string().min(1),
  phone: z.string().min(7)
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "otp/request", { limit: 5, windowMs: 5 * 60_000 });
    const input = schema.parse(await request.json());
    return ok(await requestOtp(input));
  } catch (error) {
    return fail(error);
  }
}
