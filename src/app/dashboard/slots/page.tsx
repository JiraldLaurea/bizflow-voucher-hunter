import { listCampaignsWithIndustry } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { NewSlotForm } from "../_components/NewSlotForm";
import { ChangeRequestActions } from "../_components/ChangeRequestActions";
import { selectCampaign } from "../_components/selectCampaign";
import { CampaignSelector } from "../_components/CampaignSelector";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { filterCampaignsForSession } from "@/server/auth";
import {
  listChangeRequests,
  listStaffChangeRequests,
} from "@/server/change-requests";

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  const campaigns = filterCampaignsForSession(session!, await listCampaignsWithIndustry());
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);
  const isBusinessScoped = session?.role === "staff";
  const slotRequests =
    isBusinessScoped && selectedCampaign && session
      ? await listStaffChangeRequests(
          selectedCampaign.id,
          session.email,
          "slot_create",
        )
      : [];
  const adminSlotRequests =
    !isBusinessScoped && selectedCampaign
      ? await listChangeRequests(selectedCampaign.id, "slot_create")
      : [];

  let slotRows: Awaited<ReturnType<typeof dashboardMetrics>>["slotPerformance"] = [];
  if (selectedCampaign) {
    try {
      slotRows = (await dashboardMetrics(selectedCampaign.id)).slotPerformance;
    } catch {
      slotRows = [];
    }
  }

  return (
    <>
      <CampaignSelector campaigns={campaigns} selected={selectedCampaign?.slug} />
      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Slot Inventory Management</h2>
            <p className="muted">Date/time slots and remaining capacity.</p>
          </div>
        </div>
        {selectedCampaign ? (
          <NewSlotForm
            campaignId={selectedCampaign.id}
            requestMode={isBusinessScoped}
          />
        ) : null}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Capacity</th>
              <th>Remaining</th>
              <th>Booked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {slotRows.length === 0 ? (
              <tr>
                  <td colSpan={7}>
                    {isBusinessScoped
                      ? "No live slots yet. Request one above for admin approval."
                      : "No slots yet. Add one above."}
                  </td>
              </tr>
            ) : (
              slotRows.map((row) => (
                <tr key={row.slot.id}>
                  <td>{row.slot.date}</td>
                  <td>{row.slot.startTime}</td>
                  <td>{row.slot.endTime}</td>
                  <td>{row.slot.totalCapacity}</td>
                  <td>{row.slot.remainingCapacity}</td>
                  <td>{row.issued}</td>
                  <td>
                    <span className={`badge ${row.slot.remainingCapacity === 0 ? "danger" : row.slot.remainingCapacity < 5 ? "warning" : ""}`}>
                      {row.slot.remainingCapacity === 0 ? "Sold Out" : row.slot.remainingCapacity < 5 ? "Low Stock" : "Active"}
                    </span>
                  </td>
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
              <h2>Your Slot Requests</h2>
              <p className="muted">
                Requested changes remain here until an admin approves or rejects them.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Date</th>
                <th>Time</th>
                <th>Capacity</th>
                <th>Branch</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {slotRequests.length === 0 ? (
                <tr>
                  <td colSpan={6}>No slot requests yet.</td>
                </tr>
              ) : (
                slotRequests.map((request) => {
                  const slot = request.payload as {
                    date: string;
                    startTime: string;
                    endTime: string;
                    totalCapacity: number;
                    branchId?: string;
                  };
                  return (
                    <tr key={request.id}>
                      <td>{request.createdAt.replace("T", " ").slice(0, 16)}</td>
                      <td>{slot.date}</td>
                      <td>{slot.startTime}–{slot.endTime}</td>
                      <td>{slot.totalCapacity}</td>
                      <td>{slot.branchId || "—"}</td>
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
              <h2>Staff Slot Requests</h2>
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
                <th>Date</th>
                <th>Time</th>
                <th>Capacity</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Review / Action</th>
              </tr>
            </thead>
            <tbody>
              {adminSlotRequests.length === 0 ? (
                <tr>
                  <td colSpan={8}>No slot requests for this campaign.</td>
                </tr>
              ) : (
                adminSlotRequests.map((request) => {
                  const slot = request.payload as {
                    date: string;
                    startTime: string;
                    endTime: string;
                    totalCapacity: number;
                    branchId?: string;
                  };
                  return (
                    <tr key={request.id}>
                      <td>{request.createdAt.replace("T", " ").slice(0, 16)}</td>
                      <td>{request.requestedBy}</td>
                      <td>{slot.date}</td>
                      <td>{slot.startTime}–{slot.endTime}</td>
                      <td>{slot.totalCapacity}</td>
                      <td>{slot.branchId || "—"}</td>
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
                            <NewSlotForm
                              campaignId={selectedCampaign!.id}
                              initialValues={slot}
                              revisionMode
                              revisionRequestId={request.id}
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
