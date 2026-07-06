"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

const emptySlot = { date: "", startTime: "", endTime: "", totalCapacity: "20", branchId: "" };

export function NewSlotForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState(emptySlot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaignId}/slots`, {
        method: "POST",
        body: JSON.stringify({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          totalCapacity: Number(slot.totalCapacity),
          branchId: slot.branchId || undefined,
        }),
      });
      router.refresh();
      setOpen(false);
      setSlot(emptySlot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create slot.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="button admin-form-toggle" onClick={() => setOpen(true)} type="button">
        + New Slot
      </button>
    );
  }

  return (
    <form className="admin-inline-form" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <strong>New Slot</strong>
        <button className="button tertiary" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
      <div className="admin-form-grid">
        <label className="field">
          <span>Date</span>
          <input
            required
            type="date"
            value={slot.date}
            onChange={(event) => setSlot({ ...slot, date: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Start Time</span>
          <input
            required
            type="time"
            value={slot.startTime}
            onChange={(event) => setSlot({ ...slot, startTime: event.target.value })}
          />
        </label>
        <label className="field">
          <span>End Time</span>
          <input
            required
            type="time"
            value={slot.endTime}
            onChange={(event) => setSlot({ ...slot, endTime: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Total Capacity</span>
          <input
            min={1}
            required
            type="number"
            value={slot.totalCapacity}
            onChange={(event) => setSlot({ ...slot, totalCapacity: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Branch (optional)</span>
          <input
            value={slot.branchId}
            onChange={(event) => setSlot({ ...slot, branchId: event.target.value })}
          />
        </label>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Creating..." : "Create Slot"}
      </button>
    </form>
  );
}
