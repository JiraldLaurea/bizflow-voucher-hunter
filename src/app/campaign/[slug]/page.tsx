import { notFound, redirect } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { getPublicCampaign } from "@/server/voucher-engine";
import { PublicStepClient } from "./_components/PublicStepClient";

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  // Signed-out visitors go to the single global sign-in and return here. Kept
  // outside the try/catch below so Next's redirect isn't swallowed.
  const phone = await getSignedInCustomerPhone();
  if (!phone) {
    redirect(`/signin?next=${encodeURIComponent(`/campaign/${params.slug}`)}`);
  }

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
        initialPhone={phone}
      />
    );
  } catch {
    notFound();
  }
}
