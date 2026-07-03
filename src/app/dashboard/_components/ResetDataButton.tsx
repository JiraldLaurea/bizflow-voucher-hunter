"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw } from "react-icons/fi";
import { api } from "@/lib/api-client";

const CONFIRM_PHRASE = "RESET";

export function ResetDataButton() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canReset = confirmation.trim().toUpperCase() === CONFIRM_PHRASE;

  async function handleReset() {
    if (!canReset) return;
    setError("");

    const token = process.env.NEXT_PUBLIC_ADMIN_ACCESS_TOKEN;
    if (!token) {
      setError("NEXT_PUBLIC_ADMIN_ACCESS_TOKEN is not configured.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/dashboard/reset", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      setConfirmation("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reset data.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reset-data-action">
      <label className="field">
        <span>Type RESET to confirm</span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="RESET"
        />
      </label>
      <button
        className="button secondary danger"
        disabled={!canReset || busy}
        onClick={handleReset}
        type="button"
      >
        <FiRefreshCw aria-hidden="true" />
        {busy ? "Resetting..." : "Reset & Reseed Data"}
      </button>
      {error ? <p className="alert reset-data-error">{error}</p> : null}
    </div>
  );
}
