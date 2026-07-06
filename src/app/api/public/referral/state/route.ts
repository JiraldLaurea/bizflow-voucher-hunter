import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { getReferralSnapshot } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  campaignSlug: z.string().min(1),
  ref: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = schema.parse({
      campaignSlug: searchParams.get("campaignSlug"),
      ref: searchParams.get("ref"),
    });
    return ok(await getReferralSnapshot(input));
  } catch (error) {
    return fail(error);
  }
}
