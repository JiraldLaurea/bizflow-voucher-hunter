import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { listSlotsForAttempt } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignSlug: z.string().min(1),
  phone: z.string().min(7),
  attemptId: z.string().min(1)
});

// Returns the date/time slots at which the chosen candidate's benefit tier is offered.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = schema.parse({
      campaignSlug: searchParams.get("campaignSlug"),
      phone: searchParams.get("phone"),
      attemptId: searchParams.get("attemptId")
    });
    return ok(await listSlotsForAttempt(input));
  } catch (error) {
    return fail(error);
  }
}
