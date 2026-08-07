import { notFound, redirect } from "next/navigation";
import { EditCampaignImageForm } from "../../../_components/EditCampaignImageForm";
import { FormPage } from "../../../_components/FormPage";
import { cachedCampaigns, currentSession } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function EditCampaignImagePage({
  params,
}: {
  params: { campaignId: string };
}) {
  const session = await currentSession();
  // Staff validate vouchers for a campaign; they do not change its artwork.
  if (session?.role === "staff") redirect("/dashboard");

  const campaign = (await cachedCampaigns()).find(
    (item) => item.id === params.campaignId,
  );
  if (!campaign) notFound();

  return (
    <FormPage
      backHref="/dashboard/campaigns"
      backLabel="Campaigns"
      description={`Replace the artwork shown for ${campaign.title}.`}
      title="Edit campaign image"
    >
      <EditCampaignImageForm campaign={campaign} />
    </FormPage>
  );
}
