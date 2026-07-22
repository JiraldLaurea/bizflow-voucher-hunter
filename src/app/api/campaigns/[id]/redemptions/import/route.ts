import { z } from "zod";
import { assertAdminRole, assertBusinessAccess, requireAdmin } from "@/server/auth";
import { getCampaign } from "@/server/admin";
import { fail, ok } from "@/server/errors";
import { importRedemptions } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  csv: z.string().min(1)
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    const input = schema.parse(await request.json());
    const campaign = await getCampaign(params.id);
    assertAdminRole(session);
    assertBusinessAccess(session, campaign.businessId);
    return ok(await importRedemptions({ campaignId: campaign.id, csv: input.csv, staffName: session.email }));
  } catch (error) {
    return fail(error);
  }
}
