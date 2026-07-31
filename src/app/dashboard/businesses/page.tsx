import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listBusinesses, listCampaigns } from "@/server/admin";
import { BusinessManager } from "../_components/BusinessManager";

/**
 * Businesses have their own page because they outlive any one campaign: the
 * address and contact number a customer sees belong to the venue, and are shown
 * on every campaign it runs. Editing them from inside Campaigns implied they
 * were per-campaign, which is exactly the confusion this avoids.
 */
export default async function BusinessesPage() {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  // Staff validate vouchers for a business; they do not edit its public details.
  if (session?.role === "staff") redirect("/dashboard");

  const [businesses, campaigns] = await Promise.all([
    listBusinesses(),
    listCampaigns(),
  ]);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Businesses</h1>
          <p className="muted">
            Venue details customers see on the campaign page.
          </p>
        </div>
      </header>

      <BusinessManager businesses={businesses} campaigns={campaigns} />
    </>
  );
}
