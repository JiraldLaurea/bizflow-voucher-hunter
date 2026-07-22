import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { getHuntSnapshot } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({ campaignSlug: z.string().min(1) });

export async function GET(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone();
    const { searchParams } = new URL(request.url);
    const input = schema.parse({ campaignSlug: searchParams.get("campaignSlug") });
    return ok(await getHuntSnapshot({ ...input, phone }));
  } catch (error) {
    return fail(error);
  }
}
