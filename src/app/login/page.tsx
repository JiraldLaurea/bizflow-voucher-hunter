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
        <LoginForm adminEmail={adminEmail} nextPath={nextPath} />
      </section>
    </main>
  );
}
