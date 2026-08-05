import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { listRewardProducts } from "@/server/rewards-network";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The LP storefront a signed-in customer can spend their points in. */
export async function GET(request: Request) {
  try {
    await requireSignedInCustomerPhone(request);
    const businessId = new URL(request.url).searchParams.get("businessId");
    return ok(await listRewardProducts({ businessId: businessId || undefined }));
  } catch (error) {
    return fail(error);
  }
}
