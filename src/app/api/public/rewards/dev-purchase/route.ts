import crypto from "node:crypto";
import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { assertDevToolsEnabled } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import {
  creditRewardFromPurchase,
  getOrCreateRewardWallet,
} from "@/server/rewards-network";

const schema = z.object({
  businessId: z.string().min(3),
  /** Pesos spent at the till. LP is 5% of this. */
  purchaseAmount: z.union([z.string().trim().min(1), z.number()]),
});

/**
 * Development-only helper: stands in for a partner's staff scanning the
 * customer's wallet QR at the till.
 *
 * Unlike `dev-credit`, this runs the real earning path — it books a
 * `reward_purchase`, so the partner is billed for the LP issued and the month's
 * statement reflects it. That is what makes the money loop testable end to end
 * from the phone; `dev-credit` only tops a balance up.
 */
export async function POST(request: Request) {
  try {
    assertDevToolsEnabled("Simulated purchases");
    await enforceRateLimit(request, "rewards/dev-purchase", {
      limit: 30,
      windowMs: 60_000,
    });
    const phone = await requireSignedInCustomerPhone(request);
    const input = schema.parse(await request.json());
    const snapshot = await getOrCreateRewardWallet({ phone });
    return ok(
      await creditRewardFromPurchase({
        walletToken: snapshot.wallet.walletToken,
        businessId: input.businessId,
        purchaseAmount: input.purchaseAmount,
        staffName: "Dev Tools Till",
        // Each simulated scan is its own sale.
        idempotencyKey: `dev-purchase-${crypto.randomUUID()}`,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
