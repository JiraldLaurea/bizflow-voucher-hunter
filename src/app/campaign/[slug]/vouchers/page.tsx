import { redirect } from "next/navigation";

// Vouchers are a single global wallet now; redirect the old campaign-scoped list.
export default function CampaignVouchersPage() {
  redirect("/vouchers");
}
