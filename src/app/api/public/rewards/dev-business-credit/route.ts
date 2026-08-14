import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { assertDevToolsEnabled } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { grantDevBusinessLoyaltyPoints } from "@/server/rewards-network";

const schema = z.object({
  businessId: z.string().min(3),
  amount: z.union([z.string().trim().min(1), z.number()]),
});

/**
 * Development-only helper: tops one partner's bucket up directly.
 *
 * The bucket counterpart to `dev-credit`, which funds the global pot. Neither
 * bills the partner — use `dev-purchase` when the statement side matters.
 *
 * Guarded here and again in `grantDevBusinessLoyaltyPoints`: this mints
 * spendable balance that no partner has been billed for.
 */
export async function POST(request: Request) {
  try {
    assertDevToolsEnabled("Granting Loyalty Points");
    await enforceRateLimit(request, "rewards/dev-business-credit", {
      limit: 30,
      windowMs: 60_000,
    });
    const phone = await requireSignedInCustomerPhone(request);
    const input = schema.parse(await request.json());
    return ok(
      await grantDevBusinessLoyaltyPoints({
        phone,
        businessId: input.businessId,
        amount: input.amount,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
