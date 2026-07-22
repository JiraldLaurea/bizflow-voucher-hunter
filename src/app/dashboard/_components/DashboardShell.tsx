"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <main className="admin-shell">
      {children}
      {!hydrated ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="dashboard-hydration-gate"
          role="status"
        >
          <span className="dashboard-hydration-spinner" aria-hidden="true" />
          <strong>Preparing dashboard</strong>
          <span>Loading interactive controls...</span>
        </div>
      ) : null}
    </main>
  );
}
