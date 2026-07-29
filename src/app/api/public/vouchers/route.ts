import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { listClaimedVouchersForPhone } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    return ok(await listClaimedVouchersForPhone(phone));
  } catch (error) {
    return fail(error);
  }
}
