import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { AppError, fail, ok } from "@/server/errors";
import { validateVoucher } from "@/server/voucher-engine";

const schema = z.object({ codeOrToken: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const result = await validateVoucher(schema.parse(await request.json()));
    if (!result.campaign) {
      throw new AppError("E-VOUCHER-CAMPAIGN", "Voucher campaign was not found", 404);
    }
    assertBusinessAccess(session, result.campaign.businessId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
