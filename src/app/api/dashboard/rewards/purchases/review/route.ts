import { z } from "zod";
import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { notifyHeldPurchaseApproved } from "@/server/notifications";
import { centavosToLoyaltyPoints, reviewHeldRewardPurchase } from "@/server/rewards-network";

const schema = z.object({
  purchaseId: z.string().min(3),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const input = schema.parse(await request.json());
    const result = await reviewHeldRewardPurchase({
      purchaseId: input.purchaseId,
      decision: input.decision,
      reviewer: session.email,
      note: input.note,
    });
    // Approval is the moment the customer's held LP actually lands. Notify after
    // the transaction has committed; a failed push must not fail the review.
    if (input.decision === "approve") {
      void notifyHeldPurchaseApproved({
        phone: result.wallet.phone,
        rewardAmount: centavosToLoyaltyPoints(result.purchase.rewardAmountCentavos),
        balance: result.balance,
      });
    }
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
