import { notFound } from "next/navigation";
import { getPublicCampaign } from "@/server/voucher-engine";
import { PublicStepClient } from "../_components/PublicStepClient";

export default function ConfirmPage({ params }: { params: { slug: string } }) {
  try {
    const data = getPublicCampaign(params.slug);
    if (!data.business) notFound();
    return <PublicStepClient step="confirm" campaign={data.campaign} businessName={data.business.name} businessLogo={data.business.logoText} slots={data.slots} />;
  } catch {
    notFound();
  }
}
