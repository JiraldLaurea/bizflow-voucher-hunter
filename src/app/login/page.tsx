import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "@/lib/admin-session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (session) redirect("/dashboard");

  const nextPath = searchParams.next?.startsWith("/dashboard")
    ? searchParams.next
    : "/dashboard";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@bizflow.local";
  // Dev convenience only: expose the admin password to the login form so it can
  // offer a one-click fill. Mirrors the login route's dev fallback to
  // ADMIN_ACCESS_TOKEN. Never sent to the client in production.
  const devPassword =
    process.env.NODE_ENV !== "production"
      ? process.env.ADMIN_PASSWORD || process.env.ADMIN_ACCESS_TOKEN
      : undefined;
  const staffEmail =
    process.env.STAFF_EMAIL ||
    (process.env.NODE_ENV !== "production" ? "staff@bizflow.local" : undefined);
  const devStaffPassword =
    process.env.NODE_ENV !== "production"
      ? process.env.STAFF_PASSWORD || "staff-password"
      : undefined;

  return (
    <main className="admin-login-page">
      <section className="admin-login-shell">
        <aside className="admin-login-brand">
          <div className="admin-login-logo">
            <span>%</span>
            <div>
              <strong>BizFlow</strong>
              <small>Voucher Hunt Admin</small>
            </div>
          </div>
          <div className="admin-login-brand-copy">
            <span className="admin-login-eyebrow">Operations console</span>
            <h2>Campaign control, without the clutter.</h2>
            <p>
              Monitor voucher inventory, validate redemptions, and keep every
              campaign moving from one secure workspace.
            </p>
          </div>
          <p className="admin-login-brand-footer">BizFlow Admin Portal</p>
        </aside>
        <LoginForm adminEmail={adminEmail} staffEmail={staffEmail} nextPath={nextPath} devPassword={devPassword} devStaffPassword={devStaffPassword} />
      </section>
    </main>
  );
}
