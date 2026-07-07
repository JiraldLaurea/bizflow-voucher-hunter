import { z } from "zod";
import { requireAdmin } from "@/server/auth";
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
    await requireAdmin(request);
    return ok(await redeemRewardVoucher(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
