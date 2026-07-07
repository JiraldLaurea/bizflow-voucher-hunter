"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { CampaignSlot } from "@/types/voucher";

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

export function NewPoolForm({ campaignId, slots }: { campaignId: string; slots: CampaignSlot[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState(emptyPool);
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      await api(`/api/campaigns/${campaignId}/pools`, {
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
          slotIds,
        }),
      });
      router.refresh();
      setOpen(false);
      setPool(emptyPool);
      setSlotIds([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create benefit tier.");
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
        + Add Benefit Tier
      </button>
    );
  }

  return (
    <form className="admin-inline-form" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <strong>New Benefit Tier</strong>
        <button className="button tertiary" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
      <div className="admin-form-grid">
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
      <fieldset className="pool-slot-picker">
        <legend>Offered at these date/time slots (rarer tiers = fewer slots)</legend>
        <div className="pool-slot-options">
          {slots.map((slot) => (
            <label key={slot.id} className="pool-slot-option">
              <input type="checkbox" checked={slotIds.includes(slot.id)} onChange={() => toggleSlot(slot.id)} />
              {slot.date} {slot.startTime}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p className="alert">{error}</p> : null}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Creating..." : "Create Benefit Tier"}
      </button>
    </form>
  );
}
