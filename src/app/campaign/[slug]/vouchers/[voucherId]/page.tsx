import { redirect } from "next/navigation";

// Voucher details are a single global page now (a claimed voucher is read from
// this device's wallet and needs no campaign context); redirect the old
// campaign-scoped route so existing links keep working.
export default function CampaignVoucherDetailsPage({
  params,
}: {
  params: { voucherId: string };
}) {
  redirect(`/vouchers/${params.voucherId}`);
}
