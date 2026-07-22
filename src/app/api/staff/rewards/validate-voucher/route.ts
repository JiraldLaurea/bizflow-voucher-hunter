import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { validateRewardVoucher } from "@/server/rewards-network";

const schema = z.object({
  codeOrToken: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const result = await validateRewardVoucher(schema.parse(await request.json()));
    return ok({
      voucher: {
        voucherCode: result.voucher.voucherCode,
        remainingCentavos: result.voucher.remainingCentavos,
        status: result.voucher.status,
        expiresAt: result.voucher.expiresAt,
      },
      wallet: {
        maskedPhone: result.wallet.maskedPhone,
        status: result.wallet.status,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
