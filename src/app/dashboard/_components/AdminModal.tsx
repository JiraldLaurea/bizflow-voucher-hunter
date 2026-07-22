"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Shared dashboard modal chrome: backdrop + centered dialog with a header.
 * Closes on Escape, backdrop click, or the × button; locks background scroll.
 * Callers provide the body/footer (typically a <form className="modal-form">).
 */
export function AdminModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <strong>{title}</strong>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
