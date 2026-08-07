import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { resendVoucherSms } from "@/server/voucher-engine";

const schema = z.object({ codeOrToken: z.string().min(3) });

/**
 * Re-sends a voucher's confirmation SMS to the number that owns it.
 *
 * Every send costs SMPP credit and lands on a real handset, so this is gated
 * three ways: the caller must be signed in, the voucher must belong to their
 * verified number (enforced in `resendVoucherSms`), and the number is budgeted
 * separately from the address so neither a rotating proxy nor a shared NAT can
 * turn it into a message pump.
 */
export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "voucher/resend", {
      limit: 10,
      windowMs: 10 * 60_000,
    });
    const phone = await requireSignedInCustomerPhone(request);
    await enforceRateLimit(request, "voucher/resend", {
      limit: 5,
      windowMs: 10 * 60_000,
      subject: phone,
    });
    const input = schema.parse(await request.json());
    return ok(await resendVoucherSms({ ...input, phone }));
  } catch (error) {
    return fail(error);
  }
}
