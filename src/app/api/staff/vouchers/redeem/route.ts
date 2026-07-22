import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { AppError, fail, ok } from "@/server/errors";
import { redeemVoucher, validateVoucher } from "@/server/voucher-engine";

const schema = z.object({
  codeOrToken: z.string().min(3),
  purchaseAmount: z.coerce.number().min(0).optional(),
  note: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const input = schema.parse(await request.json());
    const validation = await validateVoucher({ codeOrToken: input.codeOrToken });
    if (!validation.campaign) {
      throw new AppError("E-VOUCHER-CAMPAIGN", "Voucher campaign was not found", 404);
    }
    assertBusinessAccess(session, validation.campaign.businessId);
    return ok(await redeemVoucher({ ...input, staffName: session.email }));
  } catch (error) {
    return fail(error);
  }
}
