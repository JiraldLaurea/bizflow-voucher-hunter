"use client";

import { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { api } from "@/lib/api-client";
import { isValidPhoneNumber, rememberIdentity } from "@/lib/customer-identity";

/**
 * The single, campaign-agnostic customer sign-in — now OTP-verified.
 *
 * Step 1: enter a mobile number, receive an SMS code.
 * Step 2: enter the code. The server verifies it and sets the httpOnly auth
 * cookies, so a signed-in phone can only be established by someone who received
 * the SMS. `next` is the relative path to return to after signing in.
 */
export function SignInForm({ next }: { next: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPhoneNumber(phone)) {
      setError("Enter a valid Philippine mobile number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ sent: boolean; devCode?: string }>(
        "/api/public/signin/request-otp",
        { method: "POST", body: JSON.stringify({ phone }) },
      );
      setStep("code");
      setNotice(
        result.devCode
          ? `Code sent. Demo code: ${result.devCode}`
          : "We sent a 6-digit code to your number.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send the code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/public/signin/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });
      // Keep the phone locally for the flow's body params (not for auth).
      rememberIdentity({ phone });
      // Full navigation so the destination's server render sees the new cookies.
      window.location.assign(next);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Invalid or expired code.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="customer-signin-screen">
          <div className="customer-signin-emblem" aria-hidden="true">
            🎁
          </div>
          <h1>Sign in to start hunting</h1>
          <p className="muted">
            {step === "phone"
              ? "Enter your mobile number — we'll text you a code to verify it's yours."
              : `Enter the code we sent to ${phone}.`}
          </p>

          {step === "phone" ? (
            <form onSubmit={requestCode}>
              <label className="field">
                <span>Mobile Number</span>
                <input
                  autoFocus
                  inputMode="tel"
                  onChange={(event) => {
                    setError("");
                    setPhone(event.target.value);
                  }}
                  placeholder="09171234567"
                  value={phone}
                />
              </label>
              {error ? <p className="alert">{error}</p> : null}
              <button
                className="button full"
                disabled={busy || !isValidPhoneNumber(phone)}
                type="submit"
              >
                {busy ? "Sending code..." : "Send Code"}
                {!busy ? <FiArrowRight aria-hidden="true" /> : null}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode}>
              <label className="field">
                <span>Verification Code</span>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  className={`otp-code-input ${code ? "has-value" : ""}`}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setError("");
                    setCode(event.target.value.replace(/\D/g, ""));
                  }}
                  pattern="[0-9]*"
                  placeholder="Enter 6-digit code"
                  value={code}
                />
              </label>
              {notice ? <p className="muted otp-message">{notice}</p> : null}
              {error ? <p className="alert">{error}</p> : null}
              <button
                className="button full"
                disabled={busy || code.length !== 6}
                type="submit"
              >
                {busy ? "Verifying..." : "Verify & Continue"}
                {!busy ? <FiArrowRight aria-hidden="true" /> : null}
              </button>
              <button
                className="button secondary full"
                disabled={busy}
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError("");
                  setNotice("");
                }}
                type="button"
              >
                <FiArrowLeft aria-hidden="true" />
                Use a different number
              </button>
            </form>
          )}
          <p className="customer-signin-footnote">
            One sign-in works across all BizFlow voucher campaigns.
          </p>
        </section>
      </div>
    </main>
  );
}
