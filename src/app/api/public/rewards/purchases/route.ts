import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { listWalletPurchases } from "@/server/rewards-network";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Items this wallet has bought with LP, with the QR staff scan at handover. */
export async function GET(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    return ok(await listWalletPurchases({ phone }));
  } catch (error) {
    return fail(error);
  }
}
