import { notFound } from "next/navigation";
import { getPublicCampaign } from "@/server/voucher-engine";
import { PublicStepClient } from "../../_components/PublicStepClient";

export default async function VoucherDetailsPage({
  params,
}: {
  params: { slug: string; voucherId: string };
}) {
  try {
    const data = await getPublicCampaign(params.slug);
    if (!data.business) notFound();

    return (
      <PublicStepClient
        step="voucher"
        voucherId={params.voucherId}
        campaign={data.campaign}
        businessName={data.business.name}
        businessLogo={data.business.logoText}
        slots={data.slots}
      />
    );
  } catch {
    notFound();
  }
}
