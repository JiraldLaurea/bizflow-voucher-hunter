import { z } from "zod";
import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { devToolsEnabled } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import {
  adjustRewardRedemption,
  closeBusinessStatement,
  devBackdateLpActivity,
  listRewardSettlementRows,
  recordStatementPayment,
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
  // Nets a finished month for one partner: LP they issued against LP their
  // customers spent, fee on the net payout, deposit drawn down if they owe us.
  z.object({
    action: z.literal("close"),
    businessId: z.string().min(3),
    period: z.string().regex(/^\d{4}-\d{2}$/, "Period must look like 2026-07"),
  }),
  // The transfer itself happens outside the system, so this only records it.
  z.object({
    action: z.literal("pay"),
    statementId: z.string().min(3),
    reference: z.string().trim().min(4),
  }),
  z.object({
    action: z.literal("adjust"),
    redemptionId: z.string().min(3),
    note: z.string().trim().min(3),
  }),
  // Development-only: shifts this month's activity into last month so the
  // close can be exercised. Refused in production by the server helper.
  z.object({
    action: z.literal("backdate"),
    businessId: z.string().min(3),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const input = postSchema.parse(await request.json());
    const reviewer = session.email;
    if (input.action === "backdate") {
      return ok(await devBackdateLpActivity({ businessId: input.businessId }));
    }
    if (input.action === "close") {
      return ok(
        await closeBusinessStatement({
          businessId: input.businessId,
          period: input.period,
          reviewer,
          // Closing a month early moves real money. Only where dev tooling is
          // recognised — `closeBusinessStatement` re-checks the same gate.
          devIgnoreWindow: devToolsEnabled(),
        }),
      );
    }
    if (input.action === "pay") {
      return ok(
        await recordStatementPayment({
          statementId: input.statementId,
          reference: input.reference,
          recordedBy: reviewer,
        }),
      );
    }
    return ok(await adjustRewardRedemption({ redemptionId: input.redemptionId, note: input.note, reviewer }));
  } catch (error) {
    return fail(error);
  }
}
