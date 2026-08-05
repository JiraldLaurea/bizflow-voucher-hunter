"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function HeldPurchaseActions({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function review(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const note = decision === "reject" ? window.prompt("Reason for rejection?") || "Rejected during fraud review" : undefined;
      await api("/api/dashboard/rewards/purchases/review", {
        method: "POST",
        body: JSON.stringify({ purchaseId, decision, note }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reward-row-actions">
      <button className="button compact-button" disabled={busy} onClick={() => void review("approve")} type="button">
        Approve
      </button>
      <button className="button secondary compact-button" disabled={busy} onClick={() => void review("reject")} type="button">
        Reject
      </button>
    </div>
  );
}

export function SettlementRowActions({
  redemptionId,
  settlementId,
  settlementEligible,
  settlementWindow,
  status,
}: {
  redemptionId: string;
  settlementId?: string;
  settlementEligible?: boolean;
  settlementWindow?: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api("/api/dashboard/rewards/settlements", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function adjust() {
    const note = window.prompt("Adjustment note");
    if (!note) return;
    await post({ action: "adjust", redemptionId, note });
  }

  // Redemptions are no longer settled one at a time. A month is closed for a
  // whole partner on the Billing page, where LP they issued is netted against
  // LP their customers spent — settling a single row here would bill the
  // service fee on gross spend and ignore the other side of the ledger.
  return (
    <div className="reward-row-actions">
      {status === "Pending" ? (
        settlementEligible ? (
          <a className="button compact-button" href="/dashboard/billing">
            Close month
          </a>
        ) : (
          <small className="muted">Scheduled {settlementWindow}</small>
        )
      ) : null}
      {status !== "Completed" && status !== "Adjusted" ? (
        <button className="button secondary compact-button" disabled={busy} onClick={() => void adjust()} type="button">
          Adjust
        </button>
      ) : null}
    </div>
  );
}
