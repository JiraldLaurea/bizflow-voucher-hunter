import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { redeemVoucher } from "@/server/voucher-engine";

const schema = z.object({
  codeOrToken: z.string().min(3),
  staffName: z.string().min(2),
  purchaseAmount: z.coerce.number().min(0).optional(),
  note: z.string().optional()
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return ok(await redeemVoucher(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
