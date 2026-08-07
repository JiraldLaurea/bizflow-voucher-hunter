import { redirect } from "next/navigation";
import { BusinessManager } from "../_components/BusinessManager";
import { FlashNotice } from "../_components/FlashNotice";
import { cachedBusinesses, cachedCampaigns, currentSession } from "@/server/dashboard-data";

/**
 * Businesses have their own page because they outlive any one campaign: the
 * address and contact number a customer sees belong to the venue, and are shown
 * on every campaign it runs. Editing them from inside Campaigns implied they
 * were per-campaign, which is exactly the confusion this avoids.
 */
export default async function BusinessesPage() {
  const session = await currentSession();
  // Staff validate vouchers for a business; they do not edit its public details.
  if (session?.role === "staff") redirect("/dashboard");

  const [businesses, campaigns] = await Promise.all([
    cachedBusinesses(),
    cachedCampaigns(),
  ]);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Businesses</h1>
          <p className="muted">
            The venues behind your campaigns. Address and contact number are
            shown to customers on every campaign the business runs.
          </p>
        </div>
      </header>

      <FlashNotice />
      <BusinessManager businesses={businesses} campaigns={campaigns} />
    </>
  );
}
