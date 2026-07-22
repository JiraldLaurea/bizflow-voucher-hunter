import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { getCampaign } from "@/server/admin";
import { fail, ok } from "@/server/errors";
import { dashboardMetrics } from "@/server/voucher-engine";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    const campaign = await getCampaign(params.id);
    assertBusinessAccess(session, campaign.businessId);
    return ok(await dashboardMetrics(campaign.id));
  } catch (error) {
    return fail(error);
  }
}
