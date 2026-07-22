import { redirect } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { VoucherDetail } from "./VoucherDetail";

export const dynamic = "force-dynamic";

export default async function VoucherDetailPage({
  params,
}: {
  params: { voucherId: string };
}) {
  if (!(await getSignedInCustomerPhone())) {
    redirect(
      `/signin?next=${encodeURIComponent(`/vouchers/${params.voucherId}`)}`,
    );
  }
  return <VoucherDetail voucherId={params.voucherId} />;
}
