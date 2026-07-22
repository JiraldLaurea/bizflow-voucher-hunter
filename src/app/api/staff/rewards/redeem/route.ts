import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { redeemRewardVoucher } from "@/server/rewards-network";

const schema = z.object({
  codeOrToken: z.string().min(3),
  businessId: z.string().min(3),
  amount: z.union([z.string().min(1), z.number().positive()]),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const input = schema.parse(await request.json());
    assertBusinessAccess(session, input.businessId);
    const result = await redeemRewardVoucher({ ...input, staffName: session.email });
    return ok({
      voucher: {
        voucherCode: result.voucher.voucherCode,
        remainingCentavos: result.voucher.remainingCentavos,
        status: result.voucher.status,
        expiresAt: result.voucher.expiresAt,
      },
      amount: result.amount,
    });
  } catch (error) {
    return fail(error);
  }
}
