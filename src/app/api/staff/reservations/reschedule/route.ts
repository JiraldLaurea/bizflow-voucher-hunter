import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { AppError, fail, ok } from "@/server/errors";
import { rescheduleReservation, validateVoucher } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  codeOrToken: z.string().min(3),
  newSlotId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const input = schema.parse(await request.json());
    const validation = await validateVoucher({ codeOrToken: input.codeOrToken });
    if (!validation.campaign) throw new AppError("E-VOUCHER-CAMPAIGN", "Voucher campaign was not found", 404);
    assertBusinessAccess(session, validation.campaign.businessId);
    return ok(await rescheduleReservation(input));
  } catch (error) {
    return fail(error);
  }
}
