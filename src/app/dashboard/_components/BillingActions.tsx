"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

/**
 * The three manual moves in the LP money loop: take a deposit in, close a
 * finished month, and record a payout we have actually sent. Everything else
 * is derived from transactions, so these are the only buttons.
 */
export function BillingActions({
  businessId,
  closablePeriod,
  closed,
  isDev,
  payableStatementId,
}: {
  businessId: string;
  closablePeriod?: string;
  closed?: boolean;
  /** Shows the backdating helper. Never true in production. */
  isDev?: boolean;
  payableStatementId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api(url, { method: "POST", body: JSON.stringify(body) });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordDeposit() {
    const amount = window.prompt("Deposit amount in pesos (e.g. 5000)");
    if (!amount) return;
    const reference = window.prompt("Bank or GCash reference") ?? "";
    await post("/api/dashboard/rewards/deposits", {
      businessId,
      amount,
      reference,
      note: "Partner deposit top-up",
    });
  }

  async function closeMonth() {
    if (
      !window.confirm(
        `Close ${closablePeriod} for this partner? LP issued and LP redeemed are netted, and the deposit is drawn down if they owe us.`,
      )
    ) {
      return;
    }
    await post("/api/dashboard/rewards/settlements", {
      action: "close",
      businessId,
      period: closablePeriod,
    });
  }

  async function backdate() {
    if (
      !window.confirm(
        `Move this month's LP activity for this partner into ${closablePeriod}? Testing only — it rewrites transaction dates.`,
      )
    ) {
      return;
    }
    await post("/api/dashboard/rewards/settlements", {
      action: "backdate",
      businessId,
    });
  }

  async function recordPayment() {
    const reference = window.prompt("Payment reference for the transfer you sent");
    if (!reference) return;
    await post("/api/dashboard/rewards/settlements", {
      action: "pay",
      statementId: payableStatementId,
      reference,
    });
  }

  if (payableStatementId) {
    return (
      <div className="reward-row-actions">
        <button
          className="button compact-button"
          disabled={busy}
          onClick={() => void recordPayment()}
          type="button"
        >
          Record payment
        </button>
        {error ? <span className="alert" role="alert">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="reward-row-actions">
      <button
        className="button"
        disabled={busy}
        onClick={() => void recordDeposit()}
        type="button"
      >
        Record deposit
      </button>
      {isDev && !closed ? (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void backdate()}
          type="button"
          title="Development only: moves this month's purchases and redemptions into last month so the close has something to net."
        >
          Backdate to {closablePeriod}
        </button>
      ) : null}
      {closed ? (
        <small className="muted">{closablePeriod} is closed.</small>
      ) : (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void closeMonth()}
          type="button"
        >
          Close {closablePeriod}
        </button>
      )}
      {error ? <span className="alert" role="alert">{error}</span> : null}
    </div>
  );
}
