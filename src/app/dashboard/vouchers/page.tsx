import { listBusinesses, listCampaignsWithIndustry, listPools } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { NewPoolForm } from "../_components/NewPoolForm";
import { ChangeRequestActions } from "../_components/ChangeRequestActions";
import { RedemptionImport } from "../_components/RedemptionImport";
import { selectScope } from "../_components/selectCampaign";
import { ScopeSelector } from "../_components/ScopeSelector";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { filterCampaignsForSession } from "@/server/auth";
import {
  listChangeRequests,
  listStaffChangeRequests,
} from "@/server/change-requests";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "2026-07-08" -> "Jul 8". Built from the string's own parts rather than via
 * `new Date(...)`, which would read the slot date as UTC midnight and render
 * the previous day for anyone west of it.
 */
function shortDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return iso;
  return `${MONTHS[month - 1]} ${day}`;
}

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: { business?: string; campaign?: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  const campaigns = filterCampaignsForSession(session!, await listCampaignsWithIndustry());
  const businesses = await listBusinesses();
  const scope = selectScope(businesses, campaigns, searchParams);
  const selectedCampaign = scope.campaign;
  const isBusinessScoped = session?.role === "staff";
  const voucherRequests =
    isBusinessScoped && selectedCampaign && session
      ? await listStaffChangeRequests(
          selectedCampaign.id,
          session.email,
          "pool_create",
        )
      : [];
  const adminVoucherRequests =
    !isBusinessScoped && selectedCampaign
      ? await listChangeRequests(selectedCampaign.id, "pool_create")
      : [];

  let slotRows: Awaited<ReturnType<typeof dashboardMetrics>>["slotPerformance"] = [];
  let pools: Awaited<ReturnType<typeof listPools>> = [];
  if (selectedCampaign) {
    try {
      slotRows = (await dashboardMetrics(selectedCampaign.id)).slotPerformance;
      pools = await listPools(selectedCampaign.id);
    } catch {
      slotRows = [];
      pools = [];
    }
  }
  /**
   * Availability grouped by date rather than one entry per slot. A tier offered
   * at fifteen slots rendered as fifteen full timestamps, which wrapped over
   * three lines and buried every other column.
   */
  const slotsByDate = (slotIds: string[]) => {
    const byDate = new Map<string, string[]>();
    const unknown: string[] = [];
    for (const slotId of slotIds) {
      const slot = slotRows.find((row) => row.slot.id === slotId)?.slot;
      if (!slot) {
        unknown.push(slotId);
        continue;
      }
      byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot.startTime]);
    }
    const groups = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, times]) => ({ date, times: [...times].sort() }));
    return { groups, unknown };
  };

  // Weight is only meaningful next to the others, so it is shown as a share of
  // the campaign's total rather than as a bare number.
  const totalWeight = pools.reduce((sum, pool) => sum + pool.probabilityWeight, 0);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Vouchers</h1>
          <p className="muted">Voucher benefit tiers and the date/time slots each is offered at.</p>
        </div>
      </header>
      <ScopeSelector
        businesses={businesses}
        campaigns={campaigns}
        selectedBusinessId={scope.business?.id}
        selectedCampaignSlug={selectedCampaign?.slug}
        showBusiness={session?.role !== "staff"}
      />
      <section className="panel table-wrap">
        {selectedCampaign ? (
          <div className="admin-form-actions">
            <NewPoolForm
              campaignId={selectedCampaign.id}
              requestMode={isBusinessScoped}
              slots={slotRows.map((row) => row.slot)}
            />
            <RedemptionImport campaignId={selectedCampaign.id} />
          </div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>Benefit</th>
              <th>Qty</th>
              <th>Remaining</th>
              <th>Weight</th>
              <th>Available at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pools.length === 0 ? (
              <tr>
                  <td colSpan={6}>
                    {isBusinessScoped
                      ? "No live benefit tiers yet. Request one above for admin approval."
                      : "No benefit tiers yet. Add one above."}
                  </td>
              </tr>
            ) : (
              pools.map((pool) => {
                const { groups, unknown } = slotsByDate(pool.slotIds);
                const claimed = pool.totalQuantity - pool.remainingQuantity;
                const share = totalWeight
                  ? Math.round((pool.probabilityWeight / totalWeight) * 100)
                  : 0;
                return (
                  <tr key={pool.id}>
                    <td>
                      <div className="cell-title">{pool.displayLabel}</div>
                    </td>
                    <td className="cell-numeric">{pool.totalQuantity}</td>
                    <td className="cell-numeric">
                      <div className="pool-stock">
                        <span>{pool.remainingQuantity}</span>
                        <span
                          aria-hidden="true"
                          className="pool-stock-bar"
                          data-depleted={claimed > 0 ? "true" : undefined}
                        >
                          <span
                            style={{
                              width: `${pool.totalQuantity ? (pool.remainingQuantity / pool.totalQuantity) * 100 : 0}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="cell-numeric">
                      <div className="pool-weight">
                        <span>{pool.probabilityWeight}</span>
                        <small>{share}%</small>
                      </div>
                    </td>
                    <td>
                      {groups.length === 0 && unknown.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="pool-slot-chips">
                          {groups.map((group) => (
                            <span className="pool-slot-chip" key={group.date}>
                              <strong>{shortDate(group.date)}</strong>
                              <span>{group.times.join(" · ")}</span>
                            </span>
                          ))}
                          {unknown.map((slotId) => (
                            <span className="pool-slot-chip is-unknown" key={slotId}>
                              <strong>{slotId}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge">{pool.status}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
      {isBusinessScoped ? (
        <section className="panel table-wrap change-request-table">
          <div className="admin-topbar">
            <div>
              <h2>Your Voucher Tier Requests</h2>
              <p className="muted">
                Requested voucher tiers appear in the live table only after admin approval.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Benefit</th>
                <th>Qty</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {voucherRequests.length === 0 ? (
                <tr>
                  <td colSpan={5}>No voucher tier requests yet.</td>
                </tr>
              ) : (
                voucherRequests.map((request) => {
                  const pool = request.payload as {
                    benefitType: string;
                    benefitValue: string;
                    displayLabel: string;
                    totalQuantity: number;
                    probabilityWeight: number;
                    expiryType: string;
                    expiryValue: number;
                    minimumSpend?: number;
                    slotIds?: string[];
                  };
                  return (
                    <tr key={request.id}>
                      <td>{request.createdAt.replace("T", " ").slice(0, 16)}</td>
                      <td>{pool.displayLabel}</td>
                      <td>{pool.totalQuantity}</td>
                      <td>{pool.probabilityWeight}</td>
                      <td><span className={`badge ${request.status === "Rejected" ? "danger" : request.status === "Pending" ? "warning" : ""}`}>{request.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      ) : null}
      {!isBusinessScoped ? (
        <section className="panel table-wrap change-request-table">
          <div className="admin-topbar">
            <div>
              <h2>Staff Voucher Tier Requests</h2>
              <p className="muted">
                Review pending requests and keep approved or rejected requests for reference.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Staff</th>
                <th>Benefit</th>
                <th>Qty</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Review / Action</th>
              </tr>
            </thead>
            <tbody>
              {adminVoucherRequests.length === 0 ? (
                <tr>
                  <td colSpan={7}>No voucher tier requests for this campaign.</td>
                </tr>
              ) : (
                adminVoucherRequests.map((request) => {
                  const pool = request.payload as {
                    benefitType: string;
                    benefitValue: string;
                    displayLabel: string;
                    totalQuantity: number;
                    probabilityWeight: number;
                    expiryType: string;
                    expiryValue: number;
                    minimumSpend?: number;
                    slotIds?: string[];
                  };
                  return (
                    <tr key={request.id}>
                      <td>{request.createdAt.replace("T", " ").slice(0, 16)}</td>
                      <td>{request.requestedBy}</td>
                      <td>{pool.displayLabel}</td>
                      <td>{pool.totalQuantity}</td>
                      <td>{pool.probabilityWeight}</td>
                      <td>
                        <span className={`badge ${request.status === "Rejected" ? "danger" : request.status === "Pending" ? "warning" : ""}`}>
                          {request.status}
                        </span>
                      </td>
                      <td>
                        {request.status === "Pending" ? (
                          <ChangeRequestActions id={request.id} />
                        ) : (
                          <div className="request-review-actions">
                            <span className="request-review-meta">
                            {request.reviewedBy || "Reviewed"}
                            {request.reviewedAt
                              ? ` · ${request.reviewedAt.replace("T", " ").slice(0, 16)}`
                              : ""}
                            </span>
                            <NewPoolForm
                              campaignId={selectedCampaign!.id}
                              initialValues={pool}
                              revisionMode
                              revisionRequestId={request.id}
                              slots={slotRows.map((row) => row.slot)}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}
