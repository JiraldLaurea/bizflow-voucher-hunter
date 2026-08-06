import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listCampaigns } from "@/server/admin";
import { EditCampaignImageForm } from "../../../_components/EditCampaignImageForm";
import { FormPage } from "../../../_components/FormPage";

export const dynamic = "force-dynamic";

export default async function EditCampaignImagePage({
  params,
}: {
  params: { campaignId: string };
}) {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  // Staff validate vouchers for a campaign; they do not change its artwork.
  if (session?.role === "staff") redirect("/dashboard");

  const campaign = (await listCampaigns()).find(
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
