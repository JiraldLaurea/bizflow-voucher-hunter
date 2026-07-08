import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { fail } from "@/server/errors";
import { listRewardAuditRows, rewardAuditRowsToCsv } from "@/server/rewards-network";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const csv = rewardAuditRowsToCsv(await listRewardAuditRows());
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bizflow-rewards-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
