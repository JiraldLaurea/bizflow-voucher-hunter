import { ResetDataButton } from "../_components/ResetDataButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";

export default async function SettingsPage() {
  const session = await verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value);
  if (session?.role !== "super_admin") redirect("/dashboard");
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Settings</h1>
          <p className="muted">Platform-level configuration and maintenance actions.</p>
        </div>
      </header>

      <section className="panel settings-danger-zone">
        <h2>Danger Zone</h2>
        <p className="muted">
          Wipes all campaigns, businesses, slots, voucher pools, and hunt logs, then
          reloads the demo seed data. This cannot be undone.
        </p>
        <ResetDataButton />
      </section>
    </>
  );
}
