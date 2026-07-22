import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { listSlotsForAttempt } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignSlug: z.string().min(1),
  attemptId: z.string().min(1)
});

// Returns the date/time slots at which the chosen candidate's benefit tier is offered.
export async function GET(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone();
    const { searchParams } = new URL(request.url);
    const input = schema.parse({
      campaignSlug: searchParams.get("campaignSlug"),
      attemptId: searchParams.get("attemptId")
    });
    return ok(await listSlotsForAttempt({ ...input, phone }));
  } catch (error) {
    return fail(error);
  }
}
