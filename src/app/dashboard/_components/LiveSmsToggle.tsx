"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

/**
 * Opts a non-production server into sending real SMS.
 *
 * Development defaults to the mock provider, which prints the code and returns
 * it to the sign-in screen. That is convenient but never exercises delivery, so
 * this switch routes dev sends through the configured SMS_PROVIDER instead.
 */
export function LiveSmsToggle({
  enabled,
  configuredProvider,
  isDevelopment,
}: {
  enabled: boolean;
  configuredProvider: string;
  isDevelopment: boolean;
}) {
  const [live, setLive] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // With SMS_PROVIDER=mock there is no real provider to switch to, so flipping
  // this would change nothing. Say so rather than letting it silently no-op.
  const providerIsMock = configuredProvider === "mock";
  const disabled = busy || !isDevelopment || providerIsMock;

  async function update(next: boolean) {
    setError("");
    setBusy(true);
    setLive(next);
    try {
      await api("/api/dashboard/settings/live-sms", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
      });
    } catch (caught) {
      setLive(!next);
      setError(caught instanceof Error ? caught.message : "Unable to update the setting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="live-sms-toggle">
      <label className="switch-row">
        <span className="switch">
          <input
            checked={live}
            disabled={disabled}
            onChange={(event) => void update(event.target.checked)}
            type="checkbox"
          />
          <span className="switch-track" aria-hidden="true" />
        </span>
        Send real SMS on this server
      </label>

      <p className="muted live-sms-status">
        {!isDevelopment ? (
          <>
            This server always uses the configured provider
            (<code>{configuredProvider}</code>). The switch applies only to a
            server started with <code>npm run dev</code>.
          </>
        ) : providerIsMock ? (
          <>
            <code>SMS_PROVIDER</code> is <code>mock</code>, so there is no real
            provider to switch to. Set it to <code>smpp</code> (or another
            provider) in <code>.env</code> and restart to enable this.
          </>
        ) : live ? (
          <>
            Sign-in codes and voucher confirmations are sent for real via{" "}
            <code>{configuredProvider}</code>. They cost aggregator credit, and
            the demo code is no longer shown on the sign-in screen.
          </>
        ) : (
          <>
            Messages are printed to the server log instead of being sent, and the
            code is shown on the sign-in screen. Turn on to send via{" "}
            <code>{configuredProvider}</code> for real.
          </>
        )}
      </p>

      {error ? <p className="alert">{error}</p> : null}
    </div>
  );
}
