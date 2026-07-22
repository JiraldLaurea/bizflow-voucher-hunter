import { listCampaignsWithIndustry, listPools } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { NewPoolForm } from "../_components/NewPoolForm";
import { ChangeRequestActions } from "../_components/ChangeRequestActions";
import { RedemptionImport } from "../_components/RedemptionImport";
import { selectCampaign } from "../_components/selectCampaign";
import { CampaignSelector } from "../_components/CampaignSelector";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { filterCampaignsForSession } from "@/server/auth";
import {
  listChangeRequests,
  listStaffChangeRequests,
} from "@/server/change-requests";

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  const campaigns = filterCampaignsForSession(session!, await listCampaignsWithIndustry());
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);
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
  const slotLabel = (slotId: string) => {
    const slot = slotRows.find((row) => row.slot.id === slotId)?.slot;
    return slot ? `${slot.date} ${slot.startTime}` : slotId;
  };

  return (
    <>
      <CampaignSelector campaigns={campaigns} selected={selectedCampaign?.slug} />
      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Voucher Benefit Tiers</h2>
            <p className="muted">Voucher benefit tiers and the date/time slots each is offered at.</p>
          </div>
        </div>
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
              pools.map((pool) => (
                <tr key={pool.id}>
                  <td>{pool.displayLabel}</td>
                  <td>{pool.totalQuantity}</td>
                  <td>{pool.remainingQuantity}</td>
                  <td>{pool.probabilityWeight}</td>
                  <td>{pool.slotIds.length === 0 ? "—" : pool.slotIds.map(slotLabel).join(", ")}</td>
                  <td><span className="badge">{pool.status}</span></td>
                </tr>
              ))
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
