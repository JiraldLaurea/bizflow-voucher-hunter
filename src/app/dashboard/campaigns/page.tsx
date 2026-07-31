import { listBusinesses, listCampaigns } from "@/server/admin";
import { CampaignFlagToggles } from "../_components/CampaignFlagToggles";
import { NewCampaignForm } from "../_components/NewCampaignForm";
import { EditCampaignImageForm } from "../_components/EditCampaignImageForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";

const MODE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  online_shop: "Online Shop",
  beauty: "Beauty",
  pet: "Pet",
  retail: "Retail",
  other: "Other",
};

function statusVariant(status: string) {
  if (status === "active") return "";
  if (status === "paused") return "warning";
  return "danger";
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function CampaignsPage() {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  if (session?.role === "staff") redirect("/dashboard");
  const businesses = await listBusinesses();
  const campaigns = await listCampaigns();

  return (
    <section className="panel table-wrap">
      <div className="admin-topbar">
        <div>
          <h2>Campaign Management</h2>
          <p className="muted">Configured campaigns and current operational status.</p>
        </div>
      </div>
      <NewCampaignForm businesses={businesses} />
      <table className="admin-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Business</th>
            <th>Category</th>
            <th>Status</th>
            <th>Date Range</th>
            <th>Reschedule</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={6} className="table-empty">
                No campaigns yet. Create one above.
              </td>
            </tr>
          ) : (
            campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <div className="campaign-table-title">
                      <div>
                        <div className="cell-title">{campaign.title}</div>
                        <div className="cell-sub">/{campaign.slug}</div>
                      </div>
                      <EditCampaignImageForm campaign={campaign} />
                    </div>
                  </td>
                  <td>{businesses.find((b) => b.id === campaign.businessId)?.name ?? "-"}</td>
                  <td>
                    <span className="chip">{MODE_LABELS[campaign.mode] ?? campaign.mode}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusVariant(campaign.status)}`}>{campaign.status}</span>
                  </td>
                  <td className="cell-nowrap">
                    {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                  </td>
                  <td>
                    <CampaignFlagToggles
                      campaignId={campaign.id}
                      allowReschedule={campaign.allowReschedule}
                    />
                  </td>
                </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
