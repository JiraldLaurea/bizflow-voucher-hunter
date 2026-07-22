"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiInfo } from "react-icons/fi";
import { api } from "@/lib/api-client";
import type { CampaignSlot } from "@/types/voucher";
import { AdminModal } from "./AdminModal";
import { AdminChangeRequestNotice } from "./AdminChangeRequestNotice";

const emptyPool = {
  benefitType: "discount_percent",
  benefitValue: "",
  displayLabel: "",
  totalQuantity: "10",
  probabilityWeight: "10",
  expiryType: "days",
  expiryValue: "7",
  minimumSpend: "",
};

export type PoolRequestDraft = {
  benefitType: string;
  benefitValue: string;
  displayLabel: string;
  totalQuantity: number;
  probabilityWeight: number;
  expiryType: string;
  expiryValue: number;
  minimumSpend?: number;
  slotIds?: string[];
};

function poolState(initialValues?: PoolRequestDraft) {
  return initialValues
    ? {
        benefitType: initialValues.benefitType,
        benefitValue: initialValues.benefitValue,
        displayLabel: initialValues.displayLabel,
        totalQuantity: String(initialValues.totalQuantity),
        probabilityWeight: String(initialValues.probabilityWeight),
        expiryType: initialValues.expiryType,
        expiryValue: String(initialValues.expiryValue),
        minimumSpend:
          initialValues.minimumSpend === undefined
            ? ""
            : String(initialValues.minimumSpend),
      }
    : emptyPool;
}

function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="field-label-with-tooltip">
      {label}
      <span
        aria-label={`${label}: ${hint}`}
        className="field-tooltip"
        data-tooltip={hint}
        tabIndex={0}
      >
        <FiInfo aria-hidden="true" />
      </span>
    </span>
  );
}

export function NewPoolForm({
  campaignId,
  slots,
  requestMode = false,
  revisionMode = false,
  revisionRequestId,
  initialValues,
}: {
  campaignId: string;
  slots: CampaignSlot[];
  requestMode?: boolean;
  revisionMode?: boolean;
  revisionRequestId?: string;
  initialValues?: PoolRequestDraft;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState(() => poolState(initialValues));
  const [slotIds, setSlotIds] = useState<string[]>(() =>
    (initialValues?.slotIds ?? []).filter((slotId) =>
      slots.some((slot) => slot.id === slotId),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function toggleSlot(slotId: string) {
    setSlotIds((current) => (current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (slotIds.length === 0) {
      setError("Select at least one date/time slot this tier is offered at.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        benefitType: pool.benefitType,
        benefitValue: pool.benefitValue,
        displayLabel: pool.displayLabel,
        totalQuantity: Number(pool.totalQuantity),
        probabilityWeight: Number(pool.probabilityWeight),
        expiryType: pool.expiryType,
        expiryValue: Number(pool.expiryValue),
        minimumSpend: pool.minimumSpend ? Number(pool.minimumSpend) : undefined,
        slotIds,
      };
      await api(
        revisionRequestId
          ? `/api/admin/change-requests/${revisionRequestId}`
          : `/api/campaigns/${campaignId}/pools`,
        {
        method: "POST",
          body: JSON.stringify(payload),
        },
      );
      router.refresh();
      setOpen(false);
      setPool(poolState(initialValues));
      setSlotIds(
        (initialValues?.slotIds ?? []).filter((slotId) =>
          slots.some((slot) => slot.id === slotId),
        ),
      );
      if (!revisionMode) {
        setNotice(
          requestMode
            ? "Voucher tier request submitted for admin approval."
            : "Voucher benefit tier created successfully.",
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create benefit tier.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className={revisionMode ? "button secondary compact-button" : "button admin-form-toggle"}
        disabled={slots.length === 0}
        onClick={() => {
          setPool(poolState(initialValues));
          setSlotIds(
            (initialValues?.slotIds ?? []).filter((slotId) =>
              slots.some((slot) => slot.id === slotId),
            ),
          );
          setError("");
          setOpen(true);
        }}
        title={slots.length === 0 ? "Add a slot to this campaign first" : undefined}
        type="button"
      >
        {revisionMode ? "Revise" : requestMode ? "Request Benefit Tier" : "Add Benefit Tier"}
      </button>
      {notice ? (
        <AdminChangeRequestNotice message={notice} onDismiss={() => setNotice("")} />
      ) : null}

      {open ? (
        <AdminModal
          title={revisionMode ? "Revise Voucher Tier Request" : requestMode ? "Request Benefit Tier" : "New Benefit Tier"}
          subtitle={revisionMode
            ? "Review the previous values and submit a new pending request. The original decision remains in request history."
            : requestMode
              ? "Submit a voucher tier for admin approval before it is added to the campaign."
              : "Define a voucher benefit and which slots it can be won at."}
          onClose={() => setOpen(false)}
        >
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-section">
                <span className="form-section-title">Benefit</span>
                <div className="admin-form-grid">
                  <label className="field">
                    <FieldLabel label="Benefit Type" hint="Choose the kind of reward a customer receives." />
                    <select
                      value={pool.benefitType}
                      onChange={(event) => setPool({ ...pool, benefitType: event.target.value })}
                    >
                      <option value="discount_percent">Discount Percent</option>
                      <option value="fixed_amount">Fixed Amount</option>
                      <option value="free_item">Free Item</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </label>
                  <label className="field">
                    <FieldLabel label="Benefit Value" hint="Enter the discount amount or the item included in the reward." />
                    <input
                      placeholder="20 or Free Dessert"
                      required
                      value={pool.benefitValue}
                      onChange={(event) => setPool({ ...pool, benefitValue: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <FieldLabel label="Display Label" hint="This short label is shown to customers on the voucher." />
                    <input
                      placeholder="20% OFF"
                      required
                      value={pool.displayLabel}
                      onChange={(event) => setPool({ ...pool, displayLabel: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <FieldLabel label="Total Quantity" hint="The maximum number of vouchers available in this tier." />
                    <input
                      min={1}
                      required
                      type="number"
                      value={pool.totalQuantity}
                      onChange={(event) => setPool({ ...pool, totalQuantity: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <FieldLabel label="Probability Weight" hint="Higher weights make this tier appear more often in the voucher draw." />
                    <input
                      min={1}
                      required
                      type="number"
                      value={pool.probabilityWeight}
                      onChange={(event) => setPool({ ...pool, probabilityWeight: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <FieldLabel label="Expiry Type" hint="Hours and days start when the voucher is issued. Selected Slot Only ends with the booked slot." />
                    <select
                      value={pool.expiryType}
                      onChange={(event) => {
                        const expiryType = event.target.value;
                        setPool({
                          ...pool,
                          expiryType,
                          expiryValue:
                            expiryType === "selected_slot_only"
                              ? "0"
                              : pool.expiryValue === "0"
                                ? "7"
                                : pool.expiryValue,
                        });
                      }}
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="selected_slot_only">Selected Slot Only</option>
                      <option value="custom">Custom Days</option>
                    </select>
                  </label>
                  {pool.expiryType === "selected_slot_only" ? (
                    <label className="field">
                      <FieldLabel label="Voucher Expiry" hint="This voucher expires automatically when the customer's selected slot ends." />
                      <input disabled value="Ends when the selected slot ends" />
                    </label>
                  ) : (
                    <label className="field">
                      <FieldLabel
                        label={pool.expiryType === "custom" ? "Custom Days" : "Expiry Value"}
                        hint={pool.expiryType === "hours" ? "Set the number of hours after issuance." : "Set the number of calendar days after issuance."}
                      />
                      <input
                        min={pool.expiryType === "custom" ? 1 : 0}
                        required
                        type="number"
                        value={pool.expiryValue}
                        onChange={(event) => setPool({ ...pool, expiryValue: event.target.value })}
                      />
                    </label>
                  )}
                  <label className="field">
                    <FieldLabel label="Minimum Spend (optional)" hint="Leave blank if no purchase amount is required to use this voucher." />
                    <input
                      min={0}
                      type="number"
                      value={pool.minimumSpend}
                      onChange={(event) => setPool({ ...pool, minimumSpend: event.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="form-section">
                <span className="form-section-title">
                  <FieldLabel label="Availability" hint="Select the date/time slots where customers may win this voucher tier." />
                </span>
                <p className="muted admin-form-subtitle">
                  Offered at these date/time slots (rarer tiers = fewer slots).
                </p>
                <div className="pool-slot-options">
                  {slots.map((slot) => (
                    <label key={slot.id} className="pool-slot-option">
                      <input
                        type="checkbox"
                        checked={slotIds.includes(slot.id)}
                        onChange={() => toggleSlot(slot.id)}
                      />
                      {slot.date} {slot.startTime}
                    </label>
                  ))}
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
                    : "Create Benefit Tier"}
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
