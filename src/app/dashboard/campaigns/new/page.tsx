import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listBusinesses } from "@/server/admin";
import { FormPage } from "../../_components/FormPage";
import { NewCampaignForm } from "../../_components/NewCampaignForm";

export default async function NewCampaignPage() {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (session?.role === "staff") redirect("/dashboard");

  const businesses = await listBusinesses();

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
