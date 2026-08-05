import type { Metadata } from "next";
import { listPublicCampaignCards } from "@/server/voucher-engine";
import { MarketingHome } from "./_components/MarketingHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Voucher Hunt — fill quiet hours and build loyalty",
  description:
    "Customers win a voucher, book a time you choose and earn Loyalty Points they can spend with participating partner shops.",
};

/**
 * The root route is always the business landing page. Customer traffic has a
 * separate `/client` landing page for the mobile app, while direct campaign
 * links stay reachable for existing QR codes and deep links.
 */
export default async function HomePage() {
  const cards = await listPublicCampaignCards();
  return <MarketingHome campaigns={cards} />;
}
