import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { listRewardSettlementRows } from "@/server/rewards-network";

const settlementStatus = z.enum(["Pending", "Processed", "Completed", "Adjusted"]).optional();

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
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
