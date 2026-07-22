"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

/** Per-campaign toggle that PATCHes the allowReschedule flag. */
export function CampaignFlagToggles({
  campaignId,
  allowReschedule,
}: {
  campaignId: string;
  allowReschedule: boolean;
}) {
  const router = useRouter();
  const [reschedule, setReschedule] = useState(allowReschedule);
  const [busy, setBusy] = useState(false);

  async function update(patch: { allowReschedule?: boolean }) {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(patch) });
      router.refresh();
    } catch {
      // Revert optimistic UI if the request fails.
      setReschedule(allowReschedule);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="campaign-flag-toggles">
      <label className="switch-row">
        <span className="switch">
          <input
            type="checkbox"
            checked={reschedule}
            disabled={busy}
            onChange={(event) => {
              setReschedule(event.target.checked);
              void update({ allowReschedule: event.target.checked });
            }}
          />
          <span className="switch-track" aria-hidden="true" />
        </span>
        Allow reschedule
      </label>
    </div>
  );
}
