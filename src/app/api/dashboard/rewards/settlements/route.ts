import { z } from "zod";
import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import {
  adjustRewardRedemption,
  completeRewardSettlement,
  listRewardSettlementRows,
  processRewardSettlements,
} from "@/server/rewards-network";

const settlementStatus = z.enum(["Pending", "Processed", "Completed", "Adjusted"]).optional();

export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const url = new URL(request.url);
    return ok(
      await listRewardSettlementRows({
        businessId: url.searchParams.get("businessId") || undefined,
        status: settlementStatus.parse(url.searchParams.get("status") || undefined),
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("process"),
    redemptionIds: z.array(z.string().min(3)).min(1),
    reviewer: z.string().trim().min(2).optional(),
  }),
  z.object({
    action: z.literal("complete"),
    settlementId: z.string().min(3),
    gcashReference: z.string().trim().min(3),
    reviewer: z.string().trim().min(2).optional(),
  }),
  z.object({
    action: z.literal("adjust"),
    redemptionId: z.string().min(3),
    note: z.string().trim().min(3),
    reviewer: z.string().trim().min(2).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const input = postSchema.parse(await request.json());
    const reviewer = "reviewer" in input && input.reviewer ? input.reviewer : session.name;
    if (input.action === "process") return ok(await processRewardSettlements({ redemptionIds: input.redemptionIds, reviewer }));
    if (input.action === "complete") {
      return ok(await completeRewardSettlement({ settlementId: input.settlementId, gcashReference: input.gcashReference, reviewer }));
    }
    return ok(await adjustRewardRedemption({ redemptionId: input.redemptionId, note: input.note, reviewer }));
  } catch (error) {
    return fail(error);
  }
}
