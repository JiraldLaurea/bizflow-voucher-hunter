import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { generateCandidate } from "@/server/voucher-engine";

const schema = z.object({
  campaignSlug: z.string().min(1),
  slotId: z.string().min(1),
  phone: z.string().min(7),
  sessionId: z.string().min(1),
  sourceType: z.enum(["base", "referral_bonus"]).optional()
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "hunt/attempt", { limit: 20, windowMs: 60_000 });
    const input = schema.parse(await request.json());
    return ok(await generateCandidate(input));
  } catch (error) {
    return fail(error);
  }
}
