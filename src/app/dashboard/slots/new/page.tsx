import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listBusinesses, listCampaignsWithIndustry } from "@/server/admin";
import { filterCampaignsForSession } from "@/server/auth";
import { listChangeRequests } from "@/server/change-requests";
import { FormPage } from "../../_components/FormPage";
import { scopedHref, selectScope } from "../../_components/selectCampaign";
import { SlotForm, type SlotRequestDraft } from "../../_components/SlotForm";

/**
 * The scope the operator came from travels in the query string, so the form
 * knows which campaign it is adding to and where to send them back to.
 */
export default async function NewSlotPage({
  searchParams,
}: {
  searchParams: { business?: string; campaign?: string; revise?: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  const campaigns = filterCampaignsForSession(
    session!,
    await listCampaignsWithIndustry(),
  );
  const businesses = await listBusinesses();
  const scope = selectScope(businesses, campaigns, searchParams);
  const campaign = scope.campaign;
  if (!campaign) redirect("/dashboard/slots");

  const returnHref = scopedHref("/dashboard/slots", scope.business?.id, campaign.slug);
  const isBusinessScoped = session?.role === "staff";

  // A revision reopens a decided request with its original values. Staff cannot
  // revise: the admin request queue is where those are reviewed.
  let initialValues: SlotRequestDraft | undefined;
  if (searchParams.revise && !isBusinessScoped) {
    const request = (await listChangeRequests(campaign.id, "slot_create")).find(
      (item) => item.id === searchParams.revise,
    );
    if (!request) redirect(returnHref);
    initialValues = request.payload as SlotRequestDraft;
  }

  const revising = initialValues !== undefined;

  return (
    <FormPage
      backHref={returnHref}
      backLabel="Slots"
      description={
        revising
          ? "Review the previous values and submit a new pending request. The original decision stays in request history."
          : isBusinessScoped
            ? `Submit a date/time window on ${campaign.title} for admin approval.`
            : `Add a date/time window to ${campaign.title} and set how many vouchers it can take.`
      }
      title={revising ? "Revise slot request" : isBusinessScoped ? "Request a slot" : "New slot"}
    >
      <SlotForm
        campaignId={campaign.id}
        initialValues={initialValues}
        requestMode={isBusinessScoped}
        returnHref={returnHref}
        revisionRequestId={revising ? searchParams.revise : undefined}
      />
    </FormPage>
  );
}
