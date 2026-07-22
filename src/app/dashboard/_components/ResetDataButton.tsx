"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw } from "react-icons/fi";
import { api } from "@/lib/api-client";
import {
  forgetCustomerSession,
  forgetIdentity,
} from "@/lib/customer-identity";

const CONFIRM_PHRASE = "RESET";
const CLAIMED_VOUCHERS_STORAGE_KEY = "bizflow-claimed-vouchers";
const PUBLIC_FLOW_STORAGE_PREFIX = "bizflow-flow-";
const PUBLIC_REFERRAL_STORAGE_PREFIX = "bizflow-ref-processed-";

function clearPublicVoucherStorage() {
  window.localStorage.removeItem(CLAIMED_VOUCHERS_STORAGE_KEY);
  window.localStorage.removeItem("bizflow-session");

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(PUBLIC_FLOW_STORAGE_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(PUBLIC_REFERRAL_STORAGE_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

export function ResetDataButton() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canReset = confirmation.trim().toUpperCase() === CONFIRM_PHRASE;

  async function handleReset() {
    if (!canReset) return;
    setError("");

    setBusy(true);
    try {
      await api("/api/dashboard/reset", {
        method: "POST",
      });
      clearPublicVoucherStorage();
      // The reseed wipes the users the browser was signed in as, so also drop the
      // customer sign-in (identity cookie + wallet session). Otherwise the public
      // flow keeps a phone that no longer exists; clearing it returns to sign-in.
      forgetIdentity();
      forgetCustomerSession();
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
