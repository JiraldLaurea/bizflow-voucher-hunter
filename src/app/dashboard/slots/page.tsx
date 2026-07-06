import { listCampaigns } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { CampaignSwitcher } from "../_components/CampaignSwitcher";
import { NewSlotForm } from "../_components/NewSlotForm";
import { selectCampaign } from "../_components/selectCampaign";

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const campaigns = await listCampaigns();
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);

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
      {selectedCampaign ? (
        <CampaignSwitcher campaigns={campaigns} selectedSlug={selectedCampaign.slug} action="/dashboard/slots" />
      ) : null}
      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Slot Inventory Management</h2>
            <p className="muted">Date/time slots and remaining capacity for the selected campaign.</p>
          </div>
        </div>
        {selectedCampaign ? <NewSlotForm campaignId={selectedCampaign.id} /> : null}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Capacity</th>
              <th>Remaining</th>
              <th>Booked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {slotRows.length === 0 ? (
              <tr>
                <td colSpan={6}>No slots yet. Add one above.</td>
              </tr>
            ) : (
              slotRows.map((row) => (
                <tr key={row.slot.id}>
                  <td>{row.slot.date}</td>
                  <td>{row.slot.startTime}</td>
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
    </>
  );
}
