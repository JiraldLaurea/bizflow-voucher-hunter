import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { AppError, fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { resetHuntForPhone } from "@/server/voucher-engine";

const schema = z.object({ campaignSlug: z.string().min(1) });

// Development-only helper behind the More page's dev tools: clears one phone's
// hunt for a campaign (attempts, voucher, reservation) and returns the held
// stock, so the flow can be replayed without reseeding the database.
export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("E-DEV-ONLY", "Hunt reset is a development-only tool", 403);
    }
    await enforceRateLimit(request, "hunt/reset", { limit: 30, windowMs: 60_000 });
    const phone = await requireSignedInCustomerPhone();
    const input = schema.parse(await request.json());
    return ok(await resetHuntForPhone({ ...input, phone }));
  } catch (error) {
    return fail(error);
  }
}
