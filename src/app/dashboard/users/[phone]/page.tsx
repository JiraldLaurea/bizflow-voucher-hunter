import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { toDisplayPhone } from "@/lib/phone-display";
import { AppError } from "@/server/errors";
import { getCustomer } from "@/server/customers";

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

/** Redeemed reads as success; terminal-but-unused reads as a problem. */
function statusBadge(status: string) {
  if (status === "Redeemed") return "badge";
  if (status === "Expired" || status === "Cancelled" || status === "NoShow") {
    return "badge danger";
  }
  return "badge warning";
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { phone: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const phone = decodeURIComponent(params.phone);

  let customer;
  try {
    customer = await getCustomer(session, phone);
  } catch (error) {
    // Out of scope for this session reads as "not found", so staff cannot probe
    // for customers belonging to other businesses.
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const { summary, campaigns, vouchers } = customer;
  const loyalty =
    summary.loyaltyBalanceCentavos === undefined
      ? null
      : `${(summary.loyaltyBalanceCentavos / 100).toLocaleString("en-PH", {
          maximumFractionDigits: 2,
        })} LP`;

  return (
    <>
      <header className="admin-topbar">
        <div>
          <Link className="form-page-back" href="/dashboard/users">
            <FiArrowLeft aria-hidden="true" />
            All users
          </Link>
          <h1>{summary.name || toDisplayPhone(summary.phone)}</h1>
          <p className="muted">
            {summary.name ? `${toDisplayPhone(summary.phone)} · ` : ""}
            First seen {formatDate(summary.firstSeenAt)}
          </p>
        </div>
      </header>

      <section className="customer-summary">
        <div className="customer-stats">
          <div className="customer-stat">
            <span className="muted">Mobile number</span>
            <strong>{toDisplayPhone(summary.phone)}</strong>
          </div>
          <div className="customer-stat">
            <span className="muted">Email</span>
            <strong>{summary.email || "—"}</strong>
          </div>
          <div className="customer-stat">
            <span className="muted">Campaigns joined</span>
            <strong>{summary.campaignCount}</strong>
          </div>
          <div className="customer-stat">
            <span className="muted">Vouchers issued</span>
            <strong>{summary.voucherCount}</strong>
          </div>
          <div className="customer-stat">
            <span className="muted">Redeemed</span>
            <strong>{summary.redeemedCount}</strong>
          </div>
          <div className="customer-stat">
            <span className="muted">Loyalty Points</span>
            <strong>{loyalty ?? "No wallet"}</strong>
          </div>
        </div>
      </section>

      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Campaigns joined</h2>
            <p className="muted">Every campaign this number has started a hunt on.</p>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Business</th>
              <th>Joined</th>
              <th>Attempts</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td className="muted" colSpan={5}>
                  No campaign activity.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.campaignId}>
                  <td>
                    <strong>{campaign.campaignTitle}</strong>
                    <div className="muted customer-phone">/{campaign.campaignSlug}</div>
                  </td>
                  <td>{campaign.businessName}</td>
                  <td>{formatDate(campaign.joinedAt)}</td>
                  <td>{campaign.attemptCount}</td>
                  <td>
                    {campaign.hasVoucher ? (
                      <span className="badge">Voucher issued</span>
                    ) : (
                      <span className="badge warning">Hunting</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Vouchers</h2>
            <p className="muted">Issued vouchers and where each one ended up.</p>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Campaign</th>
              <th>Reserved slot</th>
              <th>Issued</th>
              <th>Redeemed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 ? (
              <tr>
                <td className="muted" colSpan={6}>
                  No vouchers issued to this customer.
                </td>
              </tr>
            ) : (
              vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>
                    <strong>{voucher.displayLabel}</strong>
                    <div className="muted customer-phone">{voucher.code}</div>
                  </td>
                  <td>
                    {voucher.campaignTitle}
                    <div className="muted customer-phone">{voucher.businessName}</div>
                  </td>
                  <td>
                    {voucher.slotDate
                      ? `${formatDate(voucher.slotDate)}${voucher.slotStartTime ? ` · ${voucher.slotStartTime}` : ""}`
                      : "—"}
                  </td>
                  <td>{formatDate(voucher.issuedAt)}</td>
                  <td>{formatDateTime(voucher.redeemedAt)}</td>
                  <td>
                    <span className={statusBadge(voucher.status)}>{voucher.status}</span>
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
