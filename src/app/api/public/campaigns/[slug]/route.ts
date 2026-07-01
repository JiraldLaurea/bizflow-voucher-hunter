import { fail, ok } from "@/server/errors";
import { getPublicCampaign } from "@/server/voucher-engine";

export function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    return ok(getPublicCampaign(params.slug));
  } catch (error) {
    return fail(error);
  }
}
