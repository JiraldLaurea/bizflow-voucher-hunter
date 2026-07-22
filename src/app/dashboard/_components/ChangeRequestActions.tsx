"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
export function ChangeRequestActions({ id }: { id: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  async function decide(approved: boolean) { setBusy(true); try { await api(`/api/admin/change-requests/${id}`, { method: "PATCH", body: JSON.stringify({ approved }) }); router.refresh(); } finally { setBusy(false); } }
  return <div className="status-actions"><button className="button compact-button" disabled={busy} onClick={() => decide(true)} type="button">Approve</button><button className="button secondary compact-button" disabled={busy} onClick={() => decide(false)} type="button">Reject</button></div>;
}
