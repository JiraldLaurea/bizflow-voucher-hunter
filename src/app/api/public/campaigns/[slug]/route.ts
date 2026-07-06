import { fail, ok } from "@/server/errors";
import { getPublicCampaign } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    return ok(await getPublicCampaign(params.slug));
  } catch (error) {
    return fail(error);
  }
}
