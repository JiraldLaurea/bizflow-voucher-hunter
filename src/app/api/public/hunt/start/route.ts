import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { startHunt } from "@/server/voucher-engine";

// The phone comes from the OTP-verified session cookie, never the body, so a
// caller cannot act as a number they do not own.
const schema = z.object({
  campaignSlug: z.string().min(1),
  sessionId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "hunt/start", { limit: 15, windowMs: 60_000 });
    const phone = await requireSignedInCustomerPhone();
    const input = schema.parse(await request.json());
    return ok(await startHunt({ ...input, phone }));
  } catch (error) {
    return fail(error);
  }
}
