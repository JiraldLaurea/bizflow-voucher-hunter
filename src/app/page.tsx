import type { Metadata } from "next";
import { listPublicCampaignCards } from "@/server/voucher-engine";
import { translator } from "@/i18n/marketing";
import { resolveLanguage } from "@/lib/locale";
import { MarketingHome } from "./_components/MarketingHome";

export const dynamic = "force-dynamic";

/**
 * The tab title and the link preview follow the same language as the page, so a
 * Korean visitor sharing the URL does not paste an English description of a
 * Korean page.
 */
export function generateMetadata(): Metadata {
  const t = translator(resolveLanguage());
  return { title: t("meta.title"), description: t("meta.description") };
}

/**
 * The root route is always the business landing page. Customer traffic has a
 * separate `/client` landing page for the mobile app, while direct campaign
 * links stay reachable for existing QR codes and deep links.
 */
export default async function HomePage() {
  const cards = await listPublicCampaignCards();
  // Already `force-dynamic` for the campaign list, so reading the language
  // cookie and Accept-Language here costs nothing extra.
  return <MarketingHome campaigns={cards} language={resolveLanguage()} />;
}
