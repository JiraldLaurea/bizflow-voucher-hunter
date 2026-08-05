import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { toDisplayPhone } from "@/lib/phone-display";
import { listCustomers } from "@/server/customers";
import { CustomerSearch } from "../_components/CustomerSearch";
import { ClickableCustomerRow } from "./ClickableCustomerRow";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatLoyalty(centavos?: number) {
  if (centavos === undefined) return null;
  return `${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 2 })} LP`;
}

/**
 * People, rather than campaign rows.
 *
 * `users` is keyed per campaign, so someone who joins three campaigns has three
 * rows. This page groups by phone — the stable identity across campaigns, and
 * the one the loyalty wallet is keyed by too.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const customers = await listCustomers(session, searchParams.q);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Users</h1>
          <p className="muted">
            {session.role === "staff"
              ? "Customers who joined your campaigns."
              : "Customers across every campaign, with their vouchers and activity."}
          </p>
        </div>
      </header>

      <section className="panel table-wrap">
        <CustomerSearch initialQuery={searchParams.q ?? ""} />

        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Campaigns</th>
              <th>Vouchers</th>
              <th>Redeemed</th>
              <th>Loyalty Points</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td className="muted" colSpan={6}>
                  {searchParams.q
                    ? "No customers match that search."
                    : "No customers yet. They appear here once someone starts a hunt."}
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const href = `/dashboard/users/${encodeURIComponent(customer.phone)}`;
                return (
                <ClickableCustomerRow key={customer.phone} href={href}>
                  <td>
                    <span className="customer-link">
                      {customer.name || toDisplayPhone(customer.phone)}
                    </span>
                    {customer.name ? (
                      <div className="muted customer-phone">{toDisplayPhone(customer.phone)}</div>
                    ) : null}
                  </td>
                  <td>{customer.campaignCount}</td>
                  <td>{customer.voucherCount}</td>
                  <td>{customer.redeemedCount}</td>
                  <td>
                    {formatLoyalty(customer.loyaltyBalanceCentavos) ?? (
                      <span className="muted">No wallet</span>
                    )}
                  </td>
                  <td>{formatDate(customer.lastActivityAt)}</td>
                </ClickableCustomerRow>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
