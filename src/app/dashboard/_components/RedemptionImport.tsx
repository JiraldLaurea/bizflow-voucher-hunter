"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

type ImportRow = { code: string; status: string };
type ImportResult = { total: number; redeemed: number; skipped: number; results: ImportRow[] };

export function RedemptionImport({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const data = await api<ImportResult>(`/api/campaigns/${campaignId}/redemptions/import`, {
        method: "POST",
        body: JSON.stringify({ csv, staffName: "CSV Import" }),
      });
      setResult(data);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import redemptions.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="button admin-form-toggle" onClick={() => setOpen(true)} type="button">
        Import Redeemed Codes (CSV)
      </button>
    );
  }

  return (
    <form className="admin-inline-form" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <strong>Import Redeemed Codes</strong>
        <button className="button tertiary" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
      <p className="muted">
        Paste a CSV export of used codes (e.g. from Shopify). One code per line; an optional second column is the
        purchase amount. A <code>voucher_code</code> header row is ignored.
      </p>
      <label className="field">
        <span>CSV content</span>
        <textarea
          className="staff-note"
          rows={6}
          placeholder={"voucher_code,purchase_amount\nBIZ-ABC123,1500"}
          required
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
        />
      </label>
      {error ? <p className="alert">{error}</p> : null}
      {result ? (
        <div className="import-summary">
          <p>
            <strong>{result.redeemed}</strong> redeemed · {result.skipped} skipped of {result.total} row(s)
          </p>
          <ul className="import-result-list">
            {result.results.map((row) => (
              <li key={row.code}>
                <code>{row.code}</code> — <span className="badge">{row.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button className="button" disabled={busy || !csv.trim()} type="submit">
        {busy ? "Importing..." : "Import & Redeem"}
      </button>
    </form>
  );
}
