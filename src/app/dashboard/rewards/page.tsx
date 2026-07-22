import { rewardsNetworkOverview } from "@/server/rewards-network";
import { HeldPurchaseActions, SettlementRowActions } from "../_components/RewardsAdminActions";
import { RewardsStaffTools } from "../_components/RewardsStaffTools";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listBusinesses } from "@/server/admin";

export default async function RewardsNetworkPage() {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  if (session?.role === "staff") {
    const business = (await listBusinesses()).find((item) =>
      session.businessIds.includes(item.id),
    );
    if (!business) {
      return (
        <section className="panel">
          <h2>Business access is not configured</h2>
          <p className="muted">Ask an administrator to assign this staff account to a business.</p>
        </section>
      );
    }
    return <RewardsStaffTools business={business} />;
  }
  const overview = await rewardsNetworkOverview();
  const settlementBadgeClass = (status: string) =>
    status === "Completed"
      ? "badge success"
      : status === "Adjusted"
        ? "badge"
        : "badge warning";

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Rewards Network</h1>
          <p className="muted">
            Customer QR wallets, 5% reward credits, voucher conversions, and partner settlement monitoring.
          </p>
        </div>
        <a className="button secondary rewards-audit-export" href="/api/dashboard/rewards/audit/export">
          Export audit CSV
        </a>
      </header>

      <div className="admin-grid rewards-dashboard-grid">
        {[
          ["Wallets", overview.summary.wallets],
          ["Outstanding Credit", overview.summary.outstandingCredit],
          ["Lifetime Earned", overview.summary.lifetimeEarned],
          ["Converted to Vouchers", overview.summary.lifetimeConverted],
          ["Pending Settlement", overview.summary.pendingSettlement],
          ["Pending Redemptions", overview.summary.pendingSettlementCount],
          ["Held Reviews", overview.summary.heldReviewCount],
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
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {overview.purchases.length === 0 ? (
                <tr>
                  <td colSpan={8}>No reward credits yet.</td>
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
                    <td>
                      {purchase.status === "Held" ? <HeldPurchaseActions purchaseId={purchase.id} /> : purchase.status}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.redemptions.length === 0 ? (
                <tr>
                  <td colSpan={7}>No reward voucher payments yet.</td>
                </tr>
              ) : (
                overview.redemptions.map((redemption) => (
                  <tr key={redemption.id}>
                    <td>{new Date(redemption.createdAt).toLocaleString()}</td>
                    <td>{redemption.maskedPhone}</td>
                    <td>{redemption.voucherCode}</td>
                    <td>{redemption.businessName}</td>
                    <td>{redemption.amount}</td>
                    <td><span className={settlementBadgeClass(redemption.settlementStatus)}>{redemption.settlementStatus}</span></td>
                    <td>
                      <SettlementRowActions
                        redemptionId={redemption.id}
                        settlementId={redemption.settlementId}
                        status={redemption.settlementStatus}
                      />
                    </td>
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
