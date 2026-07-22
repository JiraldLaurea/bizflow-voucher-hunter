import { redirect } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { listPublicCampaignCards } from "@/server/voucher-engine";
import { CampaignDirectory } from "./_components/CampaignDirectory";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The directory is a post-sign-in page; signed-out (or reset-revoked) visitors
  // go to sign-in and return here.
  if (!(await getSignedInCustomerPhone())) {
    redirect(`/signin?next=${encodeURIComponent("/")}`);
  }
  const cards = await listPublicCampaignCards();
  return <CampaignDirectory cards={cards} />;
}
