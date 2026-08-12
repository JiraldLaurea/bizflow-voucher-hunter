"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiInfo } from "react-icons/fi";
import { api } from "@/lib/api-client";
import type { CampaignSlot } from "@/types/voucher";
import { FormCard } from "./FormPage";
import { SelectMenu } from "./SelectMenu";
import { appendDone } from "./SlotForm";

const emptyPool = {
  benefitType: "discount_percent",
  benefitValue: "",
  displayLabel: "",
  totalQuantity: "10",
  probabilityWeight: "10",
  minimumSpend: "",
};

const BENEFIT_TYPES = [
  { label: "Discount Percent", value: "discount_percent" },
  { label: "Fixed Amount", value: "fixed_amount" },
  { label: "Free Item", value: "free_item" },
  { label: "Free Shipping", value: "free_shipping" },
];

/**
 * A slot's calendar date, spelled out.
 *
 * The weekday and month name are what let the eye tell one option from another:
 * a column of `2026-07-08` differs from `2026-08-04` only in digits you have to
 * read character by character. Parsed at Manila midnight so the day does not
 * slide backward for a browser sitting west of UTC+8.
 */
function slotDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export type PoolRequestDraft = {
  benefitType: string;
  benefitValue: string;
  displayLabel: string;
  totalQuantity: number;
  probabilityWeight: number;
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
        minimumSpend:
          initialValues.minimumSpend === undefined
            ? ""
            : String(initialValues.minimumSpend),
      }
    : emptyPool;
}

/** A field label that carries the explanatory tooltip these settings need. */
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

/**
 * Create (or re-request) a voucher benefit tier and the slots it is offered at.
 */
export function PoolForm({
  campaignId,
  slots,
  requestMode = false,
  revisionRequestId,
  initialValues,
  returnHref,
}: {
  campaignId: string;
  slots: CampaignSlot[];
  requestMode?: boolean;
  revisionRequestId?: string;
  initialValues?: PoolRequestDraft;
  returnHref: string;
}) {
  const router = useRouter();
  const [pool, setPool] = useState(() => poolState(initialValues));
  const [slotIds, setSlotIds] = useState<string[]>(() =>
    (initialValues?.slotIds ?? []).filter((slotId) =>
      slots.some((slot) => slot.id === slotId),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleSlot(slotId: string) {
    setSlotIds((current) =>
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId],
    );
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
        minimumSpend: pool.minimumSpend ? Number(pool.minimumSpend) : undefined,
        slotIds,
      };
      await api(
        revisionRequestId
          ? `/api/admin/change-requests/${revisionRequestId}`
          : `/api/campaigns/${campaignId}/pools`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      const done = revisionRequestId
        ? "pool-revised"
        : requestMode
          ? "pool-requested"
          : "pool-created";
      router.push(appendDone(returnHref, done));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create benefit tier.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="form-page-form" onSubmit={handleSubmit}>
      {error ? <p className="alert form-page-alert">{error}</p> : null}

      <FormCard
        title="Benefit"
        description="What the customer wins, and how often this tier comes up."
      >
        <div className="admin-form-grid">
          <SelectMenu
            hint="Choose the kind of reward a customer receives."
            label="Benefit Type"
            onChange={(benefitType) => setPool({ ...pool, benefitType })}
            options={BENEFIT_TYPES}
            value={pool.benefitType}
          />
          <label className="field">
            <FieldLabel
              label="Benefit Value"
              hint="Enter the discount amount or the item included in the reward."
            />
            <input
              placeholder="20 or Free Dessert"
              required
              value={pool.benefitValue}
              onChange={(event) => setPool({ ...pool, benefitValue: event.target.value })}
            />
          </label>
          <label className="field">
            <FieldLabel
              label="Display Label"
              hint="This short label is shown to customers on the voucher."
            />
            <input
              placeholder="20% OFF"
              required
              value={pool.displayLabel}
              onChange={(event) => setPool({ ...pool, displayLabel: event.target.value })}
            />
          </label>
          <label className="field">
            <FieldLabel
              label="Total Quantity"
              hint="The maximum number of vouchers available in this tier."
            />
            <input
              min={1}
              required
              type="number"
              value={pool.totalQuantity}
              onChange={(event) => setPool({ ...pool, totalQuantity: event.target.value })}
            />
          </label>
          <label className="field">
            <FieldLabel
              label="Probability Weight"
              hint="How often this tier is won, relative to the campaign's other tiers. A tier with weight 50 alongside one with weight 10 is drawn five times as often."
            />
            <input
              min={1}
              required
              type="number"
              value={pool.probabilityWeight}
              onChange={(event) =>
                setPool({ ...pool, probabilityWeight: event.target.value })
              }
            />
          </label>
          <label className="field">
            <FieldLabel
              label="Minimum Spend (optional)"
              hint="Leave blank if no purchase amount is required to use this voucher."
            />
            <input
              min={0}
              type="number"
              value={pool.minimumSpend}
              onChange={(event) => setPool({ ...pool, minimumSpend: event.target.value })}
            />
          </label>
        </div>
      </FormCard>

      <FormCard
        title="Availability"
        description="Bookable at these date/time slots, and redeemable until the booked slot ends. Rarity is set by Probability Weight, not by how many slots you pick."
      >
        {slots.length === 0 ? (
          <p className="muted">
            This campaign has no slots yet. Add one before defining a benefit tier.
          </p>
        ) : (
          <div className="pool-slot-options">
            {slots.map((slot) => (
              <label key={slot.id} className="pool-slot-option">
                <input
                  type="checkbox"
                  checked={slotIds.includes(slot.id)}
                  onChange={() => toggleSlot(slot.id)}
                />
                <span className="pool-slot-option-label">
                  <span className="pool-slot-option-date">
                    {slotDate(slot.date)}
                  </span>
                  <span className="pool-slot-option-time">
                    {slot.startTime}–{slot.endTime}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </FormCard>

      <div className="form-page-actions">
        <Link className="button secondary" href={returnHref}>
          Cancel
        </Link>
        <button className="button" disabled={busy || slots.length === 0} type="submit">
          {busy
            ? "Submitting..."
            : revisionRequestId
              ? "Submit Revision"
              : requestMode
                ? "Submit Request"
                : "Create Benefit Tier"}
        </button>
      </div>
    </form>
  );
}
