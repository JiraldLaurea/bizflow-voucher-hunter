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
  status,
}: {
  redemptionId: string;
  settlementId?: string;
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

  async function complete() {
    const gcashReference = window.prompt("GCash settlement reference");
    if (!gcashReference) return;
    await post({ action: "complete", settlementId, gcashReference });
  }

  async function adjust() {
    const note = window.prompt("Adjustment note");
    if (!note) return;
    await post({ action: "adjust", redemptionId, note });
  }

  return (
    <div className="reward-row-actions">
      {status === "Pending" ? (
        <button
          className="button compact-button"
          disabled={busy}
          onClick={() => void post({ action: "process", redemptionIds: [redemptionId] })}
          type="button"
        >
          Process
        </button>
      ) : null}
      {status === "Processed" && settlementId ? (
        <button className="button compact-button" disabled={busy} onClick={() => void complete()} type="button">
          Complete
        </button>
      ) : null}
      {status !== "Completed" && status !== "Adjusted" ? (
        <button className="button secondary compact-button" disabled={busy} onClick={() => void adjust()} type="button">
          Adjust
        </button>
      ) : null}
    </div>
  );
}
