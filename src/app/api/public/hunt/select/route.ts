import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { selectFinalVoucher, sendVoucherConfirmationSms } from "@/server/voucher-engine";

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
    const result = selectFinalVoucher(input);
    // Voucher issuance already succeeded; an SMS delivery failure is logged
    // in sms_logs and must not fail this request.
    await sendVoucherConfirmationSms(result.voucher.id).catch(() => undefined);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
