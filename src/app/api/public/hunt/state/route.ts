import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { getHuntSnapshot } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignSlug: z.string().min(1),
  slotId: z.string().min(1),
  phone: z.string().min(7)
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = schema.parse({
      campaignSlug: searchParams.get("campaignSlug"),
      slotId: searchParams.get("slotId"),
      phone: searchParams.get("phone")
    });
    return ok(await getHuntSnapshot(input));
  } catch (error) {
    return fail(error);
  }
}
