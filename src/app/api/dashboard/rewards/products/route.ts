import { z } from "zod";
import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { listRewardProducts, saveRewardProduct } from "@/server/rewards-network";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const businessId = new URL(request.url).searchParams.get("businessId");
    return ok(
      await listRewardProducts({
        businessId: businessId || undefined,
        // Staff manage hidden items too; only customers see the filtered list.
        includeHidden: true,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

const postSchema = z.object({
  id: z.string().min(3).optional(),
  businessId: z.string().min(3),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  // LP, not pesos: this is what the customer's balance is charged.
  price: z.union([z.string().trim().min(1), z.number()]),
  status: z.enum(["Active", "Hidden"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const input = postSchema.parse(await request.json());
    return ok(await saveRewardProduct({ ...input, actor: session.email }));
  } catch (error) {
    return fail(error);
  }
}
