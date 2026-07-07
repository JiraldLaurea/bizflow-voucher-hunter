import { rewardsNetworkOverview } from "@/server/rewards-network";

export default async function RewardsNetworkPage() {
  const overview = await rewardsNetworkOverview();

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Rewards Network</h1>
          <p className="muted">
            Customer QR wallets, 5% reward credits, voucher conversions, and partner settlement monitoring.
          </p>
        </div>
      </header>

      <section className="admin-rule-strip rewards-security-strip" aria-label="Rewards network controls">
        <span>Server-calculated 5% rewards</span>
        <span>Centavo ledger accounting</span>
        <span>Opaque QR tokens</span>
        <span>Staff/admin protected redemptions</span>
        <span>Audit logs for money actions</span>
      </section>

      <div className="admin-grid rewards-dashboard-grid">
        {[
          ["Wallets", overview.summary.wallets],
          ["Outstanding Credit", overview.summary.outstandingCredit],
          ["Lifetime Earned", overview.summary.lifetimeEarned],
          ["Converted to Vouchers", overview.summary.lifetimeConverted],
          ["Pending Settlement", overview.summary.pendingSettlement],
          ["Pending Redemptions", overview.summary.pendingSettlementCount],
        ].map(([label, value]) => (
          <article className="card metric span-4" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </article>
        ))}

        <section className="panel span-12 table-wrap">
          <div className="admin-topbar">
            <div>
              <h2>Recent Reward Credits</h2>
              <p className="muted">Credits issued when staff scan a customer wallet QR and enter the paid amount.</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Business</th>
                <th>Purchase</th>
                <th>5% Credit</th>
                <th>Staff</th>
                <th>Fraud Monitor</th>
              </tr>
            </thead>
            <tbody>
              {overview.purchases.length === 0 ? (
                <tr>
                  <td colSpan={7}>No reward credits yet.</td>
                </tr>
              ) : (
                overview.purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{new Date(purchase.createdAt).toLocaleString()}</td>
                    <td>{purchase.maskedPhone}</td>
                    <td>{purchase.businessName}</td>
                    <td>{purchase.purchaseAmount}</td>
                    <td>{purchase.rewardAmount}</td>
                    <td>{purchase.staffName}</td>
                    <td>
                      {purchase.fraudFlag ? (
                        <span className="badge warning">{purchase.fraudFlag.replace(/_/g, " ")}</span>
                      ) : (
                        <span className="badge success">Clear</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="panel span-12 table-wrap">
          <div className="admin-topbar">
            <div>
              <h2>Voucher Usage & GCash Settlement</h2>
              <p className="muted">Partner-store voucher payments awaiting month-end verification and settlement.</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Voucher Payment Date</th>
                <th>Customer Ref</th>
                <th>Voucher</th>
                <th>Store / Branch</th>
                <th>Settlement Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.redemptions.length === 0 ? (
                <tr>
                  <td colSpan={6}>No reward voucher payments yet.</td>
                </tr>
              ) : (
                overview.redemptions.map((redemption) => (
                  <tr key={redemption.id}>
                    <td>{new Date(redemption.createdAt).toLocaleString()}</td>
                    <td>{redemption.maskedPhone}</td>
                    <td>{redemption.voucherCode}</td>
                    <td>{redemption.businessName}</td>
                    <td>{redemption.amount}</td>
                    <td><span className="badge warning">{redemption.settlementStatus}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
