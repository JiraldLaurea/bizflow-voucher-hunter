import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { generateCandidate } from "@/server/voucher-engine";

const schema = z.object({
  campaignSlug: z.string().min(1),
  sessionId: z.string().min(1),
  sourceType: z.enum(["base", "referral_bonus"]).optional(),
  devPoolId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "hunt/attempt", { limit: 20, windowMs: 60_000 });
    const phone = await requireSignedInCustomerPhone();
    const input = schema.parse(await request.json());
    return ok(await generateCandidate({ ...input, phone }));
  } catch (error) {
    return fail(error);
  }
}
