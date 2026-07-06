import { notFound } from "next/navigation";
import { getPublicCampaign, listActiveCampaigns } from "@/server/voucher-engine";
import { PublicStepClient } from "./_components/PublicStepClient";

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  try {
    const data = await getPublicCampaign(params.slug);
    if (!data.business) notFound();
    return (
      <PublicStepClient
        step="landing"
        campaign={data.campaign}
        businessName={data.business.name}
        businessLogo={data.business.logoText}
        slots={data.slots}
        campaigns={await listActiveCampaigns()}
      />
    );
  } catch {
    notFound();
  }
}
