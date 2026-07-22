import { z } from "zod";
import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { reviewHeldRewardPurchase } from "@/server/rewards-network";

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
    return ok(
      await reviewHeldRewardPurchase({
        purchaseId: input.purchaseId,
        decision: input.decision,
        reviewer: session.email,
        note: input.note,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
