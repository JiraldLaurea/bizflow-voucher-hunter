"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { CampaignSlot } from "@/types/voucher";

const emptyPool = {
  slotId: "",
  benefitType: "discount_percent",
  benefitValue: "",
  displayLabel: "",
  totalQuantity: "10",
  probabilityWeight: "10",
  expiryType: "days",
  expiryValue: "7",
  minimumSpend: "",
};

export function NewPoolForm({ slots }: { slots: CampaignSlot[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState(emptyPool);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // slots can arrive after this component first mounts (e.g. a slot is
  // created while this form is open), so fall back to the first slot
  // instead of relying solely on state captured at mount time.
  const effectiveSlotId = pool.slotId || slots[0]?.id || "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!effectiveSlotId) {
      setError("Add a slot to this campaign first.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/slots/${effectiveSlotId}/pools`, {
        method: "POST",
        body: JSON.stringify({
          benefitType: pool.benefitType,
          benefitValue: pool.benefitValue,
          displayLabel: pool.displayLabel,
          totalQuantity: Number(pool.totalQuantity),
          probabilityWeight: Number(pool.probabilityWeight),
          expiryType: pool.expiryType,
          expiryValue: Number(pool.expiryValue),
          minimumSpend: pool.minimumSpend ? Number(pool.minimumSpend) : undefined,
        }),
      });
      router.refresh();
      setOpen(false);
      setPool(emptyPool);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create voucher pool.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="button admin-form-toggle"
        disabled={slots.length === 0}
        onClick={() => setOpen(true)}
        title={slots.length === 0 ? "Add a slot to this campaign first" : undefined}
        type="button"
      >
        + Add Voucher
      </button>
    );
  }

  return (
    <form className="admin-inline-form" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <strong>New Voucher Pool</strong>
        <button className="button tertiary" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
      <div className="admin-form-grid">
        <label className="field">
          <span>Slot</span>
          <select
            required
            value={effectiveSlotId}
            onChange={(event) => setPool({ ...pool, slotId: event.target.value })}
          >
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.date} {slot.startTime}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Benefit Type</span>
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
          <span>Benefit Value</span>
          <input
            placeholder="20 or Free Dessert"
            required
            value={pool.benefitValue}
            onChange={(event) => setPool({ ...pool, benefitValue: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Display Label</span>
          <input
            placeholder="20% OFF"
            required
            value={pool.displayLabel}
            onChange={(event) => setPool({ ...pool, displayLabel: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Total Quantity</span>
          <input
            min={1}
            required
            type="number"
            value={pool.totalQuantity}
            onChange={(event) => setPool({ ...pool, totalQuantity: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Probability Weight</span>
          <input
            min={1}
            required
            type="number"
            value={pool.probabilityWeight}
            onChange={(event) => setPool({ ...pool, probabilityWeight: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Expiry Type</span>
          <select
            value={pool.expiryType}
            onChange={(event) => setPool({ ...pool, expiryType: event.target.value })}
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="selected_slot_only">Selected Slot Only</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="field">
          <span>Expiry Value</span>
          <input
            min={0}
            required
            type="number"
            value={pool.expiryValue}
            onChange={(event) => setPool({ ...pool, expiryValue: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Minimum Spend (optional)</span>
          <input
            min={0}
            type="number"
            value={pool.minimumSpend}
            onChange={(event) => setPool({ ...pool, minimumSpend: event.target.value })}
          />
        </label>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Creating..." : "Create Voucher Pool"}
      </button>
    </form>
  );
}
