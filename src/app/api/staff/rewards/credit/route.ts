import { z } from "zod";
import { assertBusinessAccess, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { creditRewardFromPurchase } from "@/server/rewards-network";

const schema = z.object({
  walletToken: z.string().min(16),
  businessId: z.string().min(3),
  purchaseAmount: z.union([z.string().min(1), z.number().positive()]),
  staffName: z.string().trim().min(2),
  idempotencyKey: z.string().min(12).max(120),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const input = schema.parse(await request.json());
    assertBusinessAccess(session, input.businessId);
    return ok(await creditRewardFromPurchase(input));
  } catch (error) {
    return fail(error);
  }
}
