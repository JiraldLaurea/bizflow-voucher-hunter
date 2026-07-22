import { redirect } from "next/navigation";
import { CustomerBottomNav } from "../_components/CustomerBottomNav";
import { getSignedInCustomerPhone } from "@/server/customer-auth";
import { listActiveCampaigns } from "@/server/voucher-engine";
import { MoreScreen } from "./MoreScreen";

export const dynamic = "force-dynamic";

// The global Account/More page. It needs one campaign to anchor the OTP session,
// the dev pool list, and the hunt reset to — the rewards wallet itself is
// per-phone and network-wide, so any active campaign works. MoreScreen treats
// that anchor purely as an API scope and never navigates to it.
export default async function MorePage() {
  const phone = await getSignedInCustomerPhone();
  if (!phone) {
    redirect(`/signin?next=${encodeURIComponent("/more")}`);
  }

  const campaigns = await listActiveCampaigns();
  const anchor = campaigns[0];
  if (anchor) {
    return <MoreScreen campaignSlug={anchor.slug} initialPhone={phone} />;
  }

  // No active campaign to anchor to — show a minimal signed-in shell.
  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="mobile-step-header">
          <div className="step-app-bar">
            <span className="step-back-link" aria-hidden="true" />
            <strong>More</strong>
            <span className="step-bar-spacer" />
          </div>
        </section>
        <section className="mobile-screen-card">
          <div className="more-tab-content">
            <div className="info-card">
              <h2>Account</h2>
              <p className="muted">Signed in as {phone}</p>
            </div>
            <div className="info-card">
              <h2>Rewards Wallet</h2>
              <p className="muted">
                No active campaigns yet. Your rewards wallet unlocks once a
                campaign is live and you verify your phone number.
              </p>
            </div>
          </div>
        </section>
        <CustomerBottomNav active="more" homeHref="/" vouchersHref="/vouchers" moreHref="/more" />
      </div>
    </main>
  );
}
