"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

/** Per-campaign toggles that PATCH the requireOtp / allowReschedule flags. */
export function CampaignFlagToggles({
  campaignId,
  requireOtp,
  allowReschedule,
}: {
  campaignId: string;
  requireOtp: boolean;
  allowReschedule: boolean;
}) {
  const router = useRouter();
  const [otp, setOtp] = useState(requireOtp);
  const [reschedule, setReschedule] = useState(allowReschedule);
  const [busy, setBusy] = useState(false);

  async function update(patch: { requireOtp?: boolean; allowReschedule?: boolean }) {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(patch) });
      router.refresh();
    } catch {
      // Revert optimistic UI if the request fails.
      setOtp(requireOtp);
      setReschedule(allowReschedule);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="campaign-flag-toggles">
      <label>
        <input
          type="checkbox"
          checked={otp}
          disabled={busy}
          onChange={(event) => {
            setOtp(event.target.checked);
            void update({ requireOtp: event.target.checked });
          }}
        />
        Require OTP
      </label>
      <label>
        <input
          type="checkbox"
          checked={reschedule}
          disabled={busy}
          onChange={(event) => {
            setReschedule(event.target.checked);
            void update({ allowReschedule: event.target.checked });
          }}
        />
        Allow reschedule
      </label>
    </div>
  );
}
