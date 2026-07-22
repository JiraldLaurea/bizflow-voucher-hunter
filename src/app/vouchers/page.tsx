import { redirect } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { VouchersWallet } from "./VouchersWallet";

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  // Signed-out (or reset-revoked) visitors go to sign-in, same as the campaign
  // and More pages. The wallet itself is device-local; this just gates access.
  if (!(await getSignedInCustomerPhone())) {
    redirect(`/signin?next=${encodeURIComponent("/vouchers")}`);
  }
  return <VouchersWallet />;
}
