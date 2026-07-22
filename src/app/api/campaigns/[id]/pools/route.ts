import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { createPool, getCampaign, listPools } from "@/server/admin";
import { requestCampaignChange } from "@/server/change-requests";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  benefitType: z.enum(["discount_percent", "fixed_amount", "free_item", "free_shipping"]),
  benefitValue: z.string().min(1),
  displayLabel: z.string().min(1),
  totalQuantity: z.number().int().min(1),
  probabilityWeight: z.number().int().min(1),
  expiryType: z.enum(["hours", "days", "selected_slot_only", "custom"]),
  expiryValue: z.number().int().min(0),
  minimumSpend: z.number().int().min(0).optional(),
  restriction: z.string().optional(),
  status: z.enum(["active", "paused", "depleted"]).optional(),
  slotIds: z.array(z.string()).optional()
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    assertBusinessAccess(session, (await getCampaign(params.id)).businessId);
    return ok(await listPools(params.id));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    const campaign = await getCampaign(params.id);
    assertBusinessAccess(session, campaign.businessId);
    const input = schema.parse(await request.json());
    if (session.role === "staff") return ok(await requestCampaignChange({ campaignId: campaign.id, requestedBy: session.email, requestType: "pool_create", payload: input }), { status: 202 });
    return ok(await createPool(params.id, input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
