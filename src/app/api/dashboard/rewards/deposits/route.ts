import { z } from "zod";
import { assertRewardsAdmin, requireAdmin } from "@/server/auth";
import { AppError, fail, ok } from "@/server/errors";
import {
  businessBillingOverview,
  recordBusinessDeposit,
} from "@/server/rewards-network";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) {
      throw new AppError("E-BUSINESS-REQUIRED", "businessId is required", 400);
    }
    return ok(await businessBillingOverview(businessId));
  } catch (error) {
    return fail(error);
  }
}

const postSchema = z.object({
  businessId: z.string().min(3),
  // Pesos, not LP: a deposit is cash the partner sends us.
  amount: z.union([z.string().trim().min(1), z.number()]),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(280).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertRewardsAdmin(session);
    const input = postSchema.parse(await request.json());
    return ok(
      await recordBusinessDeposit({
        businessId: input.businessId,
        amount: input.amount,
        reference: input.reference,
        note: input.note,
        recordedBy: session.email,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
