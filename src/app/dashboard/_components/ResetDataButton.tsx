"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { api } from "@/lib/api-client";
import {
  forgetCustomerSession,
  forgetIdentity,
} from "@/lib/customer-identity";

const CLAIMED_VOUCHERS_STORAGE_KEY = "bizflow-claimed-vouchers";
const PUBLIC_FLOW_STORAGE_PREFIX = "bizflow-flow-";
const PUBLIC_REFERRAL_STORAGE_PREFIX = "bizflow-ref-processed-";

type ResetMode = "reseed" | "wipe";

// A distinct phrase per action on purpose: the two buttons sit in the same
// panel and leave the database in very different states, so a typed "RESET"
// must not be able to trigger the empty-everything one.
const ACTIONS: Record<
  ResetMode,
  { confirmPhrase: string; label: string; busyLabel: string; icon: typeof FiRefreshCw }
> = {
  reseed: {
    confirmPhrase: "RESET",
    label: "Reset & Reseed Data",
    busyLabel: "Resetting...",
    icon: FiRefreshCw,
  },
  wipe: {
    confirmPhrase: "WIPE",
    label: "Wipe Data (No Reseed)",
    busyLabel: "Wiping...",
    icon: FiTrash2,
  },
};

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

export function ResetDataButton({ mode = "reseed" }: { mode?: ResetMode }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const action = ACTIONS[mode];
  const Icon = action.icon;
  const canReset = confirmation.trim().toUpperCase() === action.confirmPhrase;

  async function handleReset() {
    if (!canReset) return;
    setError("");

    setBusy(true);
    try {
      await api("/api/dashboard/reset", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      clearPublicVoucherStorage();
      // Either mode wipes the users the browser was signed in as, so also drop
      // the customer sign-in (identity cookie + wallet session). Otherwise the
      // public flow keeps a phone that no longer exists; clearing it returns to
      // sign-in.
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
        <span>Type {action.confirmPhrase} to confirm</span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={action.confirmPhrase}
        />
      </label>
      <button
        className="button secondary danger"
        disabled={!canReset || busy}
        onClick={handleReset}
        type="button"
      >
        <Icon aria-hidden="true" />
        {busy ? action.busyLabel : action.label}
      </button>
      {error ? <p className="alert reset-data-error">{error}</p> : null}
    </div>
  );
}
