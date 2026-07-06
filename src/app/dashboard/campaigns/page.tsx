import Link from "next/link";
import { listBusinesses, listCampaigns } from "@/server/admin";
import { CampaignFlagToggles } from "../_components/CampaignFlagToggles";
import { NewCampaignForm } from "../_components/NewCampaignForm";
import { selectCampaign } from "../_components/selectCampaign";

export default function CampaignsPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const businesses = listBusinesses();
  const campaigns = listCampaigns();
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);

  return (
    <section className="panel table-wrap">
      <div className="admin-topbar">
        <div>
          <h2>Campaign Management</h2>
          <p className="muted">Configured campaigns and current operational status.</p>
        </div>
      </div>
      <NewCampaignForm businesses={businesses} />
      <table>
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Business</th>
            <th>Category</th>
            <th>Status</th>
            <th>Date Range</th>
            <th>Verification / Reschedule</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={7}>No campaigns yet. Create one above.</td>
            </tr>
          ) : (
            campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>{campaign.title}</td>
                <td>{businesses.find((b) => b.id === campaign.businessId)?.name ?? "-"}</td>
                <td>{campaign.mode}</td>
                <td><span className="badge">{campaign.status}</span></td>
                <td>{campaign.startDate} - {campaign.endDate}</td>
                <td>
                  <CampaignFlagToggles
                    campaignId={campaign.id}
                    requireOtp={campaign.requireOtp}
                    allowReschedule={campaign.allowReschedule}
                  />
                </td>
                <td>
                  <Link href={`/dashboard/slots?campaign=${campaign.slug}`}>
                    {campaign.id === selectedCampaign?.id ? "Viewing" : "View"}
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
