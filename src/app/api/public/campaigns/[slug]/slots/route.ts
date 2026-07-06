import { fail, ok } from "@/server/errors";
import { listCampaignSlots } from "@/server/voucher-engine";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    return ok(await listCampaignSlots(params.slug));
  } catch (error) {
    return fail(error);
  }
}
