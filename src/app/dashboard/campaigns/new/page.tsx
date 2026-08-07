import { redirect } from "next/navigation";
import { FormPage } from "../../_components/FormPage";
import { NewCampaignForm } from "../../_components/NewCampaignForm";
import { cachedBusinesses, currentSession } from "@/server/dashboard-data";

export default async function NewCampaignPage() {
  const session = await currentSession();
  if (session?.role === "staff") redirect("/dashboard");

  const businesses = await cachedBusinesses();

  return (
    <FormPage
      backHref="/dashboard/campaigns"
      backLabel="Campaigns"
      description="Choose a business, then configure the campaign schedule, voucher hunt rules, and customer-facing content."
      title="Create a campaign"
    >
      <NewCampaignForm businesses={businesses} />
    </FormPage>
  );
}
