"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";

export function AdminChangeRequestNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setExiting(false);
    const fade = window.setTimeout(() => setExiting(true), 3400);
    const dismiss = window.setTimeout(onDismiss, 4000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(dismiss);
    };
  }, [message, onDismiss]);

  return (
    <div
      className={`snackbar admin-snackbar success${exiting ? " snackbar-exit" : ""}`}
      role="status"
      aria-live="polite"
    >
      <FiCheck aria-hidden="true" />
      <span>{message}</span>
      <button
        aria-label="Dismiss notification"
        className="admin-snackbar-close"
        onClick={onDismiss}
        type="button"
      >
        <FiX aria-hidden="true" />
      </button>
    </div>
  );
}
