import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { recordReferralOpen } from "@/server/voucher-engine";

const schema = z.object({
  campaignSlug: z.string().min(1),
  ref: z.string().min(1),
  sessionId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return ok(recordReferralOpen({ campaignSlug: input.campaignSlug, ref: input.ref, visitorSessionId: input.sessionId }));
  } catch (error) {
    return fail(error);
  }
}
