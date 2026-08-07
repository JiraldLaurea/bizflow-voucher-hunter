import { Suspense } from "react";
import { dashboardMetrics } from "@/server/voucher-engine";
import { selectScope } from "./_components/selectCampaign";
import { ScopeSelector } from "./_components/ScopeSelector";
import {
  cachedBusinesses,
  cachedCampaignsWithIndustry,
  currentSession,
} from "@/server/dashboard-data";
import { filterCampaignsForSession } from "@/server/auth";
import { listStaffChangeRequests } from "@/server/change-requests";
import { ReportingIcon } from "@/app/_components/MarketingIcons";
import type { Campaign } from "@/types/voucher";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { business?: string; campaign?: string };
}) {
  const [session, allCampaigns, businesses] = await Promise.all([
    currentSession(),
    cachedCampaignsWithIndustry(),
    cachedBusinesses(),
  ]);
  const campaigns = filterCampaignsForSession(session!, allCampaigns);
  const scope = selectScope(businesses, campaigns, searchParams);
  const selectedCampaign = scope.campaign;
  const isStaff = session?.role === "staff";
  const staffBusinessName =
    isStaff && selectedCampaign
      ? businesses.find(
          (business) => business.id === selectedCampaign.businessId,
        )?.name
      : undefined;

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>
            {isStaff
              ? `${staffBusinessName ?? selectedCampaign?.title ?? "Campaign"} Dashboard`
              : "Dashboard"}
          </h1>
          <p className="muted">
            {isStaff
              ? `${selectedCampaign?.title ?? "Your campaign"} performance and pending change requests.`
              : "Campaign, Slot, Voucher, and Analytics Management"}
          </p>
        </div>
      </header>
      <ScopeSelector
        businesses={businesses}
        campaigns={campaigns}
        selectedBusinessId={scope.business?.id}
        selectedCampaignSlug={selectedCampaign?.slug}
        showBusiness={session?.role !== "staff"}
      />

      {/*
        The heading and the scope picker depend only on the campaign list, which
        is one cheap read. The figures below need the campaign's whole rollup, so
        they stream in behind their own boundary rather than holding back the
        part of the page an operator uses to navigate.
      */}
      <Suspense
        fallback={
          <div className="admin-grid" aria-busy="true">
            {Array.from({ length: isStaff ? 4 : 6 }, (_, index) => (
              <span
                aria-hidden="true"
                className="dashboard-loading-card span-3"
                key={index}
              />
            ))}
            <span className="dashboard-loading-panel span-12" aria-hidden="true" />
          </div>
        }
        key={selectedCampaign?.id ?? "none"}
      >
        <MetricsGrid
          campaignCount={campaigns.length}
          isStaff={isStaff}
          selectedCampaign={selectedCampaign}
          staffEmail={session?.email}
        />
      </Suspense>
    </>
  );
}

async function MetricsGrid({
  campaignCount,
  isStaff,
  selectedCampaign,
  staffEmail,
}: {
  campaignCount: number;
  isStaff: boolean;
  selectedCampaign?: Campaign;
  staffEmail?: string;
}) {
  // The staff change requests and the campaign metrics are unrelated reads, so
  // they go out together rather than one after the other.
  const [staffRequests, metrics] = await Promise.all([
    isStaff && selectedCampaign && staffEmail
      ? Promise.all([
          listStaffChangeRequests(selectedCampaign.id, staffEmail, "slot_create"),
          listStaffChangeRequests(selectedCampaign.id, staffEmail, "pool_create"),
        ])
      : Promise.resolve([[], []]),
    selectedCampaign
      ? dashboardMetrics(selectedCampaign.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const pendingStaffRequestCount = staffRequests
    .flat()
    .filter((request) => request.status === "Pending").length;
  const slotRows = metrics?.slotPerformance ?? [];
  const metricCards = isStaff
    ? [
        ["Active Slots", slotRows.length],
        ["Vouchers Issued", metrics?.summary.finalVouchersIssued ?? 0],
        ["Vouchers Redeemed", metrics?.summary.redemptions ?? 0],
        ["Pending Change Requests", pendingStaffRequestCount],
      ]
    : [
        ["Total Campaigns", campaignCount],
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
    <div className="admin-grid">
      {metricCards.map(([label, value]) => (
        <article className="card metric span-3" key={label}>
          <span className="muted">{label}</span>
          <strong>{value}</strong>
          {!isStaff ? (
            <span className="trend">+4.8% vs last 7 days</span>
          ) : null}
        </article>
      ))}

      <section className="panel span-12 dashboard-benefits-panel">
        <h2>Voucher Benefit Distribution</h2>
        <div className="summary-list">
          {!metrics || metrics.benefitPerformance.length === 0 ? (
            <div className="summary-row dashboard-benefit-empty">
              <span className="icon-box" aria-hidden="true">
                <ReportingIcon />
              </span>
              <strong>No benefit data yet</strong>
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

      <section
        className="panel span-12 table-wrap"
        id="attempts"
      >
        <div className="admin-topbar">
          <h2>User Attempts / Voucher Hunt Logs</h2>
          {selectedCampaign ? (
            <a
              className="button secondary"
              href={`/api/export/campaigns/${selectedCampaign.id}`}
            >
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
                <td>
                  {metrics.benefitPerformance.find((row) => row.selected > 0)
                    ?.label ?? "-"}
                </td>
                <td>
                  <span className="badge warning">Hunting</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
