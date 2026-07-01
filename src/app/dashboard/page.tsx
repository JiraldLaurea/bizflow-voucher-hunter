import Link from "next/link";
import { dashboardMetrics } from "@/server/voucher-engine";

const nav = ["Dashboard", "Campaigns", "Slots", "Vouchers", "Attempts / Hunt Logs", "Referrals & Shares", "Reservations", "Analytics", "Users", "Settings", "Audit Logs"];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-tile small">%</div>
        <div>
          <strong>BizFlow</strong>
          <div style={{ fontSize: ".72rem", opacity: 0.76 }}>Admin</div>
        </div>
      </div>
      {nav.map((item) => (
        <div className={`nav-item ${item === "Dashboard" ? "active" : ""}`} key={item}>
          <span>▣</span>
          {item}
        </div>
      ))}
      <div style={{ marginTop: 28, padding: 10, borderTop: "1px solid rgba(255,255,255,.14)" }}>
        <strong>Jane Admin</strong>
        <div style={{ fontSize: ".72rem", opacity: 0.72 }}>Super Admin</div>
      </div>
    </aside>
  );
}

export default function DashboardPage() {
  const metrics = dashboardMetrics("camp_july_dinner");
  const slotRows = metrics.slotPerformance;

  return (
    <main className="admin-shell">
      <Sidebar />
      <section className="admin-main">
        <header className="admin-topbar">
          <div className="brand-lockup">
            <div className="logo-tile">%</div>
            <div>
              <h1>BizFlow Voucher Hunt - Admin Dashboard</h1>
              <p className="muted">Campaign, Slot, Voucher, and Analytics Management</p>
            </div>
          </div>
          <div className="admin-rule-strip">
            <div className="rule-chip"><span className="icon-box">3</span> 3 Base Attempts</div>
            <div className="rule-chip"><span className="icon-box">+</span> +1 Attempt per Share</div>
            <div className="rule-chip"><span className="icon-box">5</span> Max 5 Extra per Day</div>
            <div className="rule-chip"><span className="icon-box">1</span> 1 Final Voucher</div>
          </div>
        </header>

        <div className="admin-grid">
          {[
            ["Total Campaigns", 24],
            ["Active Slots", slotRows.length],
            ["Vouchers Issued", metrics.summary.finalVouchersIssued],
            ["Redemption Rate", `${metrics.summary.finalVouchersIssued ? Math.round((metrics.summary.redemptions / metrics.summary.finalVouchersIssued) * 100) : 0}%`],
            ["Bookings Confirmed", metrics.summary.finalVouchersIssued],
            ["Share Attempts", 0]
          ].map(([label, value]) => (
            <article className="card metric span-3" key={label}>
              <span className="muted">{label}</span>
              <strong>{value}</strong>
              <span className="trend">+4.8% vs last 7 days</span>
            </article>
          ))}

          <section className="panel span-8">
            <h2>Overview Trend</h2>
            <div className="chart-line" />
          </section>
          <section className="panel span-4">
            <h2>Voucher Benefit Distribution</h2>
            <div className="donut" />
            <div className="summary-list">
              {metrics.benefitPerformance.length === 0 ? (
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

          <section className="panel span-12 table-wrap">
            <div className="admin-topbar">
              <div>
                <h2>Campaign Management</h2>
                <p className="muted">Configured campaigns and current operational status.</p>
              </div>
              <button className="button">+ New Campaign</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Business Type</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Date Range</th>
                  <th>Slots</th>
                  <th>Issued</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{metrics.campaign.title}</td>
                  <td>Restaurant</td>
                  <td>Restaurant</td>
                  <td><span className="badge">Active</span></td>
                  <td>{metrics.campaign.startDate} - {metrics.campaign.endDate}</td>
                  <td>{slotRows.length}</td>
                  <td>{metrics.summary.finalVouchersIssued}</td>
                  <td>View · Edit · More</td>
                </tr>
                <tr>
                  <td>8PM Shopping Voucher Drop</td>
                  <td>Online Shop</td>
                  <td>Online Shop</td>
                  <td><span className="badge">Active</span></td>
                  <td>2026-07-01 - 2026-07-31</td>
                  <td>2</td>
                  <td>0</td>
                  <td>View · Edit · More</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="panel span-6 table-wrap">
            <h2>Slot Inventory Management</h2>
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
                {slotRows.map((row) => (
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
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel span-6 table-wrap">
            <div className="admin-topbar">
              <h2>Voucher Pool Configuration</h2>
              <button className="button">+ Add Voucher</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Benefit</th>
                  <th>Type</th>
                  <th>Probability</th>
                  <th>Remaining</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.benefitPerformance.length === 0 ? (
                  <tr>
                    <td>90% OFF</td>
                    <td>Percentage</td>
                    <td>1</td>
                    <td>Seeded</td>
                    <td>Same day</td>
                    <td><span className="badge">Active</span></td>
                  </tr>
                ) : (
                  metrics.benefitPerformance.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>Voucher</td>
                      <td>Weighted</td>
                      <td>{row.generated - row.selected}</td>
                      <td>Campaign rule</td>
                      <td><span className="badge">Active</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="panel span-6">
            <h2>Voucher Hunt Funnel</h2>
            <div className="funnel">
              <div style={{ width: "92%" }} />
              <div style={{ width: "74%", background: "#2f6bff" }} />
              <div style={{ width: "52%", background: "#22c55e" }} />
              <div style={{ width: "34%", background: "#f59e0b" }} />
            </div>
          </section>
          <section className="panel span-6">
            <h2>Redemption Rate</h2>
            <div className="bar-chart">
              {[35, 52, 70, 84, 92, 100].map((height) => (
                <div className="bar" key={height} style={{ height: `${height}%` }} />
              ))}
            </div>
          </section>

          <section className="panel span-12 table-wrap">
            <div className="admin-topbar">
              <h2>User Attempts / Voucher Hunt Logs</h2>
              <Link className="button secondary" href="/api/export/campaigns/camp_july_dinner">Export</Link>
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
                <tr>
                  <td>Demo User</td>
                  <td>{metrics.campaign.title}</td>
                  <td>{slotRows[0]?.slot.date ?? "Pending"}</td>
                  <td>{metrics.summary.attemptsUsed} / 8</td>
                  <td>{metrics.benefitPerformance.find((row) => row.selected > 0)?.label ?? "-"}</td>
                  <td><span className="badge warning">Hunting</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </main>
  );
}
