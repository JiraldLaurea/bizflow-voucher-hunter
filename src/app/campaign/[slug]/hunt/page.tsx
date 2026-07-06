import { notFound } from "next/navigation";
import { getPublicCampaign } from "@/server/voucher-engine";
import { PublicStepClient } from "../_components/PublicStepClient";

export default async function HuntIntroPage({ params }: { params: { slug: string } }) {
  try {
    const data = await getPublicCampaign(params.slug);
    if (!data.business) notFound();
    return <PublicStepClient step="hunt" campaign={data.campaign} businessName={data.business.name} businessLogo={data.business.logoText} slots={data.slots} />;
  } catch {
    notFound();
  }
}
