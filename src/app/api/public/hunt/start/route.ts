import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { startHunt } from "@/server/voucher-engine";

const schema = z.object({
  campaignSlug: z.string().min(1),
  slotId: z.string().min(1),
  phone: z.string().min(7),
  sessionId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "hunt/start", { limit: 15, windowMs: 60_000 });
    const input = schema.parse(await request.json());
    return ok(await startHunt(input));
  } catch (error) {
    return fail(error);
  }
}
