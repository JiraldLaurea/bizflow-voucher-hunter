import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { transferBusinessLpToGlobal } from "@/server/rewards-network";

const schema = z.object({
  walletSecret: z.string().min(16),
  businessId: z.string().min(1),
  amount: z.union([z.string().min(1), z.number().positive()]),
});

export async function POST(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    // Same budget and reasoning as the conversion route: this moves LP between
    // pots, the balances are per phone, and a burst is either a retry storm or
    // someone probing the conditional-balance guard for a race.
    await enforceRateLimit(request, "rewards/transfer", {
      limit: 15,
      windowMs: 60_000,
      subject: phone,
    });
    const input = schema.parse(await request.json());
    return ok(
      await transferBusinessLpToGlobal({
        phone,
        walletSecret: input.walletSecret,
        businessId: input.businessId,
        amount: input.amount,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
