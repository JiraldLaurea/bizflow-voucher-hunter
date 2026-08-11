import { notFound } from "next/navigation";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { devToolsEnabledFor, devToolsPossible } from "@/server/dev-tools";
import { getPublicCampaign } from "@/server/voucher-engine";
import { PublicStepClient } from "../_components/PublicStepClient";

export default async function VoucherRoulettePage({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const data = await getPublicCampaign(params.slug);
    if (!data.business) notFound();
    // The draw happens on this step alone, so this is the only step that needs
    // to know whether the visitor may force its outcome. The server decides:
    // the production developer account may, and a `NODE_ENV` check in the
    // client bundle could never see it. Reading the session costs a query, so
    // it is skipped where no account on this deployment could qualify.
    const phone = devToolsPossible() ? await getSignedInCustomerPhone() : null;
    return (
      <PublicStepClient
        step="roulette"
        campaign={data.campaign}
        businessName={data.business.name}
        businessLogo={data.business.logoText}
        devToolsEnabled={devToolsEnabledFor(phone)}
        slots={data.slots}
      />
    );
  } catch {
    notFound();
  }
}
