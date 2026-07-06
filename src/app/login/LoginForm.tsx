"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiLock, FiMail } from "react-icons/fi";
import { api } from "@/lib/api-client";

export function LoginForm({
  adminEmail,
  nextPath,
}: {
  adminEmail: string;
  nextPath: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace(nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to log in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <div className="admin-login-heading">
        <span>Secure admin access</span>
        <h1>Welcome back</h1>
        <p>Sign in to manage campaigns, vouchers, and redemptions.</p>
        <p className="admin-login-account-hint">
          Admin account: <strong>{adminEmail}</strong>
        </p>
      </div>
      <label className="admin-login-field">
        <span>Email address</span>
        <div>
          <FiMail aria-hidden="true" />
          <input
            autoComplete="username"
            autoFocus
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@bizflow.local"
            required
            type="email"
            value={email}
          />
        </div>
      </label>
      <label className="admin-login-field">
        <span>Password</span>
        <div>
          <FiLock aria-hidden="true" />
          <input
            autoComplete="current-password"
            minLength={1}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            type="password"
            value={password}
          />
        </div>
      </label>
      {error ? <p className="admin-login-error" role="alert">{error}</p> : null}
      <button className="button full admin-login-submit" disabled={busy} type="submit">
        {busy ? "Signing in..." : "Sign in to Dashboard"}
        {!busy ? <FiArrowRight aria-hidden="true" /> : null}
      </button>
      <p className="admin-login-security">
        Protected with a signed, HTTP-only admin session.
      </p>
    </form>
  );
}
