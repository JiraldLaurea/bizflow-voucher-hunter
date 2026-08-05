import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { purchaseRewardProduct } from "@/server/rewards-network";

const schema = z.object({
  walletSecret: z.string().min(16),
  productId: z.string().min(3),
});

/**
 * Spends LP on a storefront item. The points leave the wallet here; the partner
 * is credited only once their staff scans the resulting voucher at handover.
 */
export async function POST(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    const input = schema.parse(await request.json());
    return ok(
      await purchaseRewardProduct({
        phone,
        walletSecret: input.walletSecret,
        productId: input.productId,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
