import { listCampaigns, listPools } from "@/server/admin";
import { dashboardMetrics } from "@/server/voucher-engine";
import { CampaignSwitcher } from "../_components/CampaignSwitcher";
import { NewPoolForm } from "../_components/NewPoolForm";
import { RedemptionImport } from "../_components/RedemptionImport";
import { selectCampaign } from "../_components/selectCampaign";

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  const campaigns = await listCampaigns();
  const selectedCampaign = selectCampaign(campaigns, searchParams.campaign);

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
      {selectedCampaign ? (
        <CampaignSwitcher campaigns={campaigns} selectedSlug={selectedCampaign.slug} action="/dashboard/vouchers" />
      ) : null}
      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Voucher Benefit Tiers</h2>
            <p className="muted">Campaign-wide benefit tiers and the date/time slots each is offered at.</p>
          </div>
        </div>
        {selectedCampaign ? (
          <div className="admin-form-actions">
            <NewPoolForm campaignId={selectedCampaign.id} slots={slotRows.map((row) => row.slot)} />
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
                <td colSpan={6}>No benefit tiers yet. Add one above.</td>
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
    </>
  );
}
