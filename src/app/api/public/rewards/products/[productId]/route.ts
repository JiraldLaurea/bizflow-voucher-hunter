import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { getRewardProduct } from "@/server/rewards-network";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * One storefront item. The detail screen reads this rather than filtering the
 * catalogue: a list that comes back without the item is indistinguishable from
 * a request that failed, so the customer got "no longer available" for what was
 * really a network problem.
 */
export async function GET(
  _request: Request,
  { params }: { params: { productId: string } },
) {
  try {
    await requireSignedInCustomerPhone(_request);
    return ok(await getRewardProduct(params.productId));
  } catch (error) {
    return fail(error);
  }
}
