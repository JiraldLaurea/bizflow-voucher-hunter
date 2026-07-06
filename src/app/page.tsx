import { getPublicCampaign, listActiveCampaigns } from "@/server/voucher-engine";
import { PublicStepClient } from "./campaign/[slug]/_components/PublicStepClient";

export default async function HomePage() {
  const campaigns = await listActiveCampaigns();
  const featured = campaigns[0];

  if (!featured) {
    return (
      <main className="mobile-flow-shell landing-flow-shell">
        <div className="mobile-app-frame landing-app-frame">
          <section className="landing-app-bar">
            <strong>BizFlow Voucher Hunt</strong>
          </section>
          <section className="landing-screen">
            <p className="muted" style={{ padding: 24, textAlign: "center" }}>
              No active campaigns yet. Create one from the Admin Dashboard.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const data = await getPublicCampaign(featured.slug);
  if (!data.business) {
    return null;
  }

  return (
    <PublicStepClient
      step="landing"
      campaign={data.campaign}
      businessName={data.business.name}
      businessLogo={data.business.logoText}
      slots={data.slots}
      campaigns={campaigns}
    />
  );
}
