"use client";

import { useEffect, useState } from "react";

const RELOAD_KEY = "dashboard-chunk-error-reload-at";

function isChunkLoadError(error: Error) {
  return (
    error.name === "ChunkLoadError" ||
    /Loading (chunk|CSS chunk) [\w.-]+ failed/i.test(error.message)
  );
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkLoadError = isChunkLoadError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!chunkLoadError) return;
    // A stale chunk means this tab's asset manifest is out of date (e.g. a new
    // deploy landed while it was open). One retry gets a fresh manifest; if it
    // keeps failing, stop and let the user retry manually instead of looping.
    const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - lastReload > 10_000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      setReloading(true);
      window.location.reload();
    }
  }, [chunkLoadError]);

  if (reloading) {
    return (
      <section className="panel dashboard-route-error" aria-busy="true" aria-live="polite">
        <h2>Updating…</h2>
        <p className="muted">This page changed since it was loaded. Reloading now.</p>
      </section>
    );
  }

  return (
    <section className="panel dashboard-route-error">
      <h2>Something went wrong loading this page</h2>
      <p className="muted">{error.message || "An unexpected error occurred."}</p>
      <button
        className="button secondary"
        onClick={() => (chunkLoadError ? window.location.reload() : reset())}
        type="button"
      >
        {chunkLoadError ? "Reload page" : "Try again"}
      </button>
    </section>
  );
}
