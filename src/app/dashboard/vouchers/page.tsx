import { listCampaigns, listPools } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { CampaignSwitcher } from "../_components/CampaignSwitcher";
import { NewPoolForm } from "../_components/NewPoolForm";
import { RedemptionImport } from "../_components/RedemptionImport";
import { selectCampaign } from "../_components/selectCampaign";

export default function VouchersPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const campaigns = listCampaigns();
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);

  let slotRows: ReturnType<typeof dashboardMetrics>["slotPerformance"] = [];
  if (selectedCampaign) {
    try {
      slotRows = dashboardMetrics(selectedCampaign.id).slotPerformance;
    } catch {
      slotRows = [];
    }
  }
  const poolRows = slotRows.flatMap((row) =>
    listPools(row.slot.id).map((pool) => ({ slot: row.slot, pool })),
  );

  return (
    <>
      {selectedCampaign ? (
        <CampaignSwitcher campaigns={campaigns} selectedSlug={selectedCampaign.slug} action="/dashboard/vouchers" />
      ) : null}
      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Voucher Pool Configuration</h2>
            <p className="muted">Benefit pools configured per slot for the selected campaign.</p>
          </div>
        </div>
        {selectedCampaign ? (
          <div className="admin-form-actions">
            <NewPoolForm slots={slotRows.map((row) => row.slot)} />
            <RedemptionImport campaignId={selectedCampaign.id} />
          </div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>Slot</th>
              <th>Benefit</th>
              <th>Qty</th>
              <th>Remaining</th>
              <th>Weight</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {poolRows.length === 0 ? (
              <tr>
                <td colSpan={6}>No voucher pools yet. Add one above.</td>
              </tr>
            ) : (
              poolRows.map(({ slot, pool }) => (
                <tr key={pool.id}>
                  <td>{slot.date} {slot.startTime}</td>
                  <td>{pool.displayLabel}</td>
                  <td>{pool.totalQuantity}</td>
                  <td>{pool.remainingQuantity}</td>
                  <td>{pool.probabilityWeight}</td>
                  <td><span className="badge">{pool.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
