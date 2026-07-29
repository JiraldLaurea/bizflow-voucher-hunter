import { fail, ok } from "@/server/errors";
import { listPublicCampaignCards } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return ok(await listPublicCampaignCards());
  } catch (error) {
    return fail(error);
  }
}
