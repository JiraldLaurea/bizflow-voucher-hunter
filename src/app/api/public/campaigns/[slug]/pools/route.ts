import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { devToolsPossible } from "@/server/dev-tools";
import { fail, ok } from "@/server/errors";
import { listPublicVoucherPools } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    // Signed in is optional — the reel's labels and odds are public. The phone
    // only decides whether pool ids are included, which the developer account's
    // forced-draw picker needs and nobody else may have. Skipped entirely where
    // no caller could qualify: this runs on every spin, and resolving a session
    // costs a database read.
    const phone = devToolsPossible()
      ? await getSignedInCustomerPhone(request)
      : null;
    return ok(await listPublicVoucherPools(params.slug, phone));
  } catch (error) {
    return fail(error);
  }
}
