import { listBusinesses, listCampaignsWithIndustry } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { selectCampaign } from "./_components/selectCampaign";
import { CampaignSelector } from "./_components/CampaignSelector";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { filterCampaignsForSession } from "@/server/auth";
import { listStaffChangeRequests } from "@/server/change-requests";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  const campaigns = filterCampaignsForSession(session!, await listCampaignsWithIndustry());
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);
  const isStaff = session?.role === "staff";
  const staffBusinessName =
    isStaff && selectedCampaign
      ? (await listBusinesses()).find(
          (business) => business.id === selectedCampaign.businessId,
        )?.name
      : undefined;
  const staffRequests =
    isStaff && selectedCampaign && session
      ? await Promise.all([
          listStaffChangeRequests(selectedCampaign.id, session.email, "slot_create"),
          listStaffChangeRequests(selectedCampaign.id, session.email, "pool_create"),
        ])
      : [[], []];
  const pendingStaffRequestCount = staffRequests
    .flat()
    .filter((request) => request.status === "Pending").length;

  let metrics: Awaited<ReturnType<typeof dashboardMetrics>> | null = null;
  if (selectedCampaign) {
    try {
      metrics = await dashboardMetrics(selectedCampaign.id);
    } catch {
      metrics = null;
    }
  }
  const slotRows = metrics?.slotPerformance ?? [];
  const metricCards = isStaff
    ? [
        ["Active Slots", slotRows.length],
        ["Vouchers Issued", metrics?.summary.finalVouchersIssued ?? 0],
        ["Vouchers Redeemed", metrics?.summary.redemptions ?? 0],
        ["Pending Change Requests", pendingStaffRequestCount],
      ]
    : [
        ["Total Campaigns", campaigns.length],
        ["Active Slots", slotRows.length],
        ["Vouchers Issued", metrics?.summary.finalVouchersIssued ?? 0],
        [
          "Redemption Rate",
          `${metrics?.summary.finalVouchersIssued ? Math.round((metrics.summary.redemptions / metrics.summary.finalVouchersIssued) * 100) : 0}%`,
        ],
        ["Bookings Confirmed", metrics?.summary.finalVouchersIssued ?? 0],
        ["Share Attempts", 0],
      ];

  return (
    <>
      <CampaignSelector campaigns={campaigns} selected={selectedCampaign?.slug} />
      <header className="admin-topbar">
        <div>
          <h1>
            {isStaff
              ? `${staffBusinessName ?? selectedCampaign?.title ?? "Campaign"} Staff Dashboard`
              : "BizFlow Voucher Hunt - Admin Dashboard"}
          </h1>
          <p className="muted">
            {isStaff
              ? `${selectedCampaign?.title ?? "Your campaign"} performance and pending change requests.`
              : "Campaign, Slot, Voucher, and Analytics Management"}
          </p>
        </div>
      </header>

      <div className="admin-grid">
        {metricCards.map(([label, value]) => (
          <article className="card metric span-3" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
            {!isStaff ? <span className="trend">+4.8% vs last 7 days</span> : null}
          </article>
        ))}

        <section className="panel span-12">
          <h2>Voucher Benefit Distribution</h2>
          <div className="summary-list">
            {!metrics || metrics.benefitPerformance.length === 0 ? (
              <div className="summary-row">
                <span className="icon-box">0</span>
                <p className="muted">No benefit data yet</p>
              </div>
            ) : (
              metrics.benefitPerformance.map((benefit) => (
                <div className="summary-row" key={benefit.label}>
                  <span className="icon-box">{benefit.selected}</span>
                  <div>
                    <strong>{benefit.label}</strong>
                    <p className="muted">{benefit.generated} generated</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel span-12 table-wrap" id="attempts">
          <div className="admin-topbar">
            <h2>User Attempts / Voucher Hunt Logs</h2>
            {selectedCampaign ? (
              <a className="button secondary" href={`/api/export/campaigns/${selectedCampaign.id}`}>
                Export
              </a>
            ) : null}
          </div>
          <table>
            <thead>
              <tr>
                <th>User / Phone</th>
                <th>Campaign</th>
                <th>Slot</th>
                <th>Attempts Used</th>
                <th>Selected Voucher</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!metrics ? (
                <tr>
                  <td colSpan={6}>No activity yet.</td>
                </tr>
              ) : (
                <tr>
                  <td>Demo User</td>
                  <td>{metrics.campaign.title}</td>
                  <td>{slotRows[0]?.slot.date ?? "Pending"}</td>
                  <td>{metrics.summary.attemptsUsed} / 8</td>
                  <td>{metrics.benefitPerformance.find((row) => row.selected > 0)?.label ?? "-"}</td>
                  <td><span className="badge warning">Hunting</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
