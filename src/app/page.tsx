import { redirect } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { getOrCreateRewardWallet } from "@/server/rewards-network";
import { listPublicCampaignCards } from "@/server/voucher-engine";
import { CampaignDirectory } from "./_components/CampaignDirectory";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The directory is a post-sign-in page; signed-out (or reset-revoked) visitors
  // go to sign-in and return here.
  const phone = await getSignedInCustomerPhone();
  if (!phone) {
    redirect(`/signin?next=${encodeURIComponent("/")}`);
  }
  // Opening the signed-in app awards the once-daily app-use LP. The database
  // uniqueness guard makes repeated page loads safe and idempotent.
  await getOrCreateRewardWallet({ phone });
  const cards = await listPublicCampaignCards();
  return <CampaignDirectory cards={cards} />;
}
