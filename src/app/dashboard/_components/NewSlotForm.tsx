"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AdminModal } from "./AdminModal";
import { AdminChangeRequestNotice } from "./AdminChangeRequestNotice";

const emptySlot = { date: "", startTime: "", endTime: "", totalCapacity: "20", branchId: "" };

export type SlotRequestDraft = {
  date: string;
  startTime: string;
  endTime: string;
  totalCapacity: number;
  branchId?: string;
};

function slotState(initialValues?: SlotRequestDraft) {
  return initialValues
    ? {
        date: initialValues.date,
        startTime: initialValues.startTime,
        endTime: initialValues.endTime,
        totalCapacity: String(initialValues.totalCapacity),
        branchId: initialValues.branchId ?? "",
      }
    : emptySlot;
}

export function NewSlotForm({
  campaignId,
  requestMode = false,
  revisionMode = false,
  revisionRequestId,
  initialValues,
}: {
  campaignId: string;
  requestMode?: boolean;
  revisionMode?: boolean;
  revisionRequestId?: string;
  initialValues?: SlotRequestDraft;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState(() => slotState(initialValues));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalCapacity: Number(slot.totalCapacity),
        branchId: slot.branchId || undefined,
      };
      await api(
        revisionRequestId
          ? `/api/admin/change-requests/${revisionRequestId}`
          : `/api/campaigns/${campaignId}/slots`,
        {
        method: "POST",
          body: JSON.stringify(payload),
        },
      );
      router.refresh();
      setOpen(false);
      setSlot(slotState(initialValues));
      if (!revisionMode) {
        setNotice(
          requestMode
            ? "Slot request submitted for admin approval."
            : "Slot created successfully.",
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create slot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className={revisionMode ? "button secondary compact-button" : "button admin-form-toggle"}
        onClick={() => {
          setSlot(slotState(initialValues));
          setError("");
          setOpen(true);
        }}
        type="button"
      >
        {revisionMode ? "Revise" : requestMode ? "Request Slot" : "New Slot"}
      </button>
      {notice ? (
        <AdminChangeRequestNotice message={notice} onDismiss={() => setNotice("")} />
      ) : null}

      {open ? (
        <AdminModal
          title={revisionMode ? "Revise Slot Request" : requestMode ? "Request New Slot" : "New Slot"}
          subtitle={revisionMode
            ? "Review the previous values and submit a new pending request. The original decision remains in request history."
            : requestMode
              ? "Submit a date/time slot for admin approval before it is added to the campaign."
              : "Add a date/time window and its voucher capacity."}
          onClose={() => setOpen(false)}
        >
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-section">
                <span className="form-section-title">Slot details</span>
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
              </div>
            </div>

            <div className="modal-footer">
              {error ? <p className="alert">{error}</p> : null}
              <button className="button secondary" onClick={() => setOpen(false)} type="button">
                Cancel
              </button>
              <button className="button" disabled={busy} type="submit">
                {busy
                  ? revisionMode
                    ? "Submitting..."
                    : requestMode
                    ? "Submitting..."
                    : "Creating..."
                  : revisionMode
                    ? "Submit Revision"
                    : requestMode
                    ? "Submit Request"
                    : "Create Slot"}
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
