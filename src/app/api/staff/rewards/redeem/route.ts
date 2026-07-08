import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { redeemRewardVoucher } from "@/server/rewards-network";

const schema = z.object({
  codeOrToken: z.string().min(3),
  businessId: z.string().min(3),
  amount: z.union([z.string().min(1), z.number().positive()]),
  staffName: z.string().trim().min(2),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const input = schema.parse(await request.json());
    assertBusinessAccess(session, input.businessId);
    return ok(await redeemRewardVoucher(input));
  } catch (error) {
    return fail(error);
  }
}
