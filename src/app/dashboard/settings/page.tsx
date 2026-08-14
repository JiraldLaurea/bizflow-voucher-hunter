import { LiveSmsToggle } from "../_components/LiveSmsToggle";
import { ResetDataButton } from "../_components/ResetDataButton";
import { redirect } from "next/navigation";
import { isDevLiveSmsEnabled } from "@/server/runtime-settings";
import { currentSession } from "@/server/dashboard-data";

export default async function SettingsPage() {
  const session = await currentSession();
  if (session?.role !== "super_admin") redirect("/dashboard");
  const liveSmsEnabled = await isDevLiveSmsEnabled();
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Settings</h1>
          <p className="muted">Platform-level configuration and maintenance actions.</p>
        </div>
      </header>

      <section className="panel">
        <h2>SMS delivery</h2>
        <p className="muted">
          Development servers use a mock provider by default: messages are logged
          rather than sent, and the sign-in code is shown on screen. Turn this on
          to exercise real delivery — only useful from a machine whose IP the SMS
          provider has whitelisted.
        </p>
        <LiveSmsToggle
          configuredProvider={process.env.SMS_PROVIDER ?? "mock"}
          enabled={liveSmsEnabled}
          isDevelopment={process.env.NODE_ENV === "development"}
        />
      </section>

      <section className="panel settings-danger-zone">
        <h2>Danger Zone</h2>
        <div className="settings-danger-action">
          <h3>Reset &amp; reseed</h3>
          <p className="muted">
            Wipes all campaigns, businesses, slots, voucher pools, and hunt logs, then
            reloads the demo seed data. This cannot be undone.
          </p>
          <ResetDataButton mode="reseed" />
        </div>
        <div className="settings-danger-action">
          <h3>Wipe everything</h3>
          <p className="muted">
            Same wipe, but nothing is reloaded: no demo businesses, campaigns,
            products or customers. Super-admin logins are kept so you can sign back
            in and build the real data; staff and admin logins are removed with the
            businesses they belonged to. This cannot be undone.
          </p>
          <ResetDataButton mode="wipe" />
        </div>
      </section>
    </>
  );
}
