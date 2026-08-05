import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { AppError, fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { grantDevLoyaltyPoints } from "@/server/rewards-network";

const schema = z.object({
  amount: z.union([z.string().trim().min(1), z.number()]),
});

/**
 * Development-only helper behind the More tab's dev tools: tops the signed-in
 * wallet up with LP so the storefront and settlement flows can be exercised
 * without scanning purchases at a partner till.
 *
 * Guarded here and again in `grantDevLoyaltyPoints`: this mints spendable
 * balance that no partner has been billed for.
 */
export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "E-DEV-ONLY",
        "Granting Loyalty Points is a development-only tool",
        403,
      );
    }
    await enforceRateLimit(request, "rewards/dev-credit", {
      limit: 30,
      windowMs: 60_000,
    });
    const phone = await requireSignedInCustomerPhone(request);
    const input = schema.parse(await request.json());
    return ok(await grantDevLoyaltyPoints({ phone, amount: input.amount }));
  } catch (error) {
    return fail(error);
  }
}
