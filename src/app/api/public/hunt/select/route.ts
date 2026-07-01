import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { selectFinalVoucher } from "@/server/voucher-engine";

const schema = z.object({
  campaignSlug: z.string().min(1),
  attemptId: z.string().min(1),
  phone: z.string().min(7),
  sessionId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(1).max(20).optional()
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return ok(selectFinalVoucher(input));
  } catch (error) {
    return fail(error);
  }
}
