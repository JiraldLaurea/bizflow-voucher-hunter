"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiInfo } from "react-icons/fi";
import {
  labelValueMismatch,
  rarityPresentation,
  RARITY_ORDER,
  RARITY_WEIGHTS,
  type VoucherRarity,
} from "@bizflow/shared";
import { api } from "@/lib/api-client";
import { VoucherCard } from "@/app/_components/VoucherCard";
import type { CampaignSlot, VoucherPool } from "@/types/voucher";
import { FormCard } from "./FormPage";
import { SelectMenu } from "./SelectMenu";
import { appendDone } from "./SlotForm";

/** Rarest first, each labelled with the odds it buys. */
const RARITY_OPTIONS = RARITY_ORDER.map((rarity) => ({
  label: `${rarityPresentation(rarity).label} — weight ${RARITY_WEIGHTS[rarity]}`,
  value: rarity,
}));

const emptyPool = {
  benefitType: "discount_percent",
  benefitValue: "",
  displayLabel: "",
  totalQuantity: "10",
  rarity: "standard" as VoucherRarity,
  minimumSpend: "",
};

const BENEFIT_TYPES = [
  { label: "Discount Percent", value: "discount_percent" },
  { label: "Fixed Amount", value: "fixed_amount" },
  { label: "Free Item", value: "free_item" },
  { label: "Free Shipping", value: "free_shipping" },
];

/**
 * What the Benefit Value field is asking for, per benefit type.
 *
 * The column is polymorphic — "20" for a percent, "500" for an amount,
 * "dessert" for an item — so the one generic "Benefit Value / 20 or Free
 * Dessert" pairing left the admin to guess which of the four this row wanted,
 * and a percent typed into a fixed amount only surfaces as a rejected save.
 */
type BenefitValueField = {
  label: string;
  hint: string;
  placeholder: string;
  /** Percent and peso amounts want the numeric keypad on a phone. */
  numeric?: boolean;
};

const BENEFIT_VALUE_FIELD: Record<string, BenefitValueField> = {
  discount_percent: {
    label: "Discount Percent",
    hint: "How much comes off, as a number between 1 and 100. Enter 20 for 20% off.",
    placeholder: "20",
    numeric: true,
  },
  fixed_amount: {
    label: "Discount Amount (₱)",
    hint: "How much comes off the bill, in pesos. Enter the number only, for example 500.",
    placeholder: "500",
    numeric: true,
  },
  free_item: {
    label: "Free Item",
    hint: "The item the customer receives, for example dessert or an add-on treatment.",
    placeholder: "Dessert",
  },
  free_shipping: {
    label: "Shipping Covered",
    hint: "What the free shipping covers, for example standard nationwide delivery.",
    placeholder: "Standard delivery",
  },
};

const GENERIC_BENEFIT_VALUE_FIELD: BenefitValueField = {
  label: "Benefit Value",
  hint: "Enter the discount amount or the item included in the reward.",
  placeholder: "20 or Free Dessert",
};

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
  rarity: VoucherRarity;
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
        rarity: initialValues.rarity,
        minimumSpend:
          initialValues.minimumSpend === undefined
            ? ""
            : String(initialValues.minimumSpend),
      }
    : emptyPool;
}

/**
 * The ticket's sub-line, mirroring the campaign page's `voucherDetail` and
 * adding the minimum spend, which is the one condition a customer most needs to
 * see before picking a tier.
 */
function previewDetail(benefitType: string, minimumSpend: string) {
  const base =
    benefitType === "free_item"
      ? "Any dessert"
      : benefitType === "free_shipping"
        ? "Free shipping reward"
        : "On selected items";
  const minimum = Number(minimumSpend);
  return minimumSpend.trim() && Number.isFinite(minimum) && minimum > 0
    ? `${base} · Min. spend ₱${minimum.toLocaleString()}`
    : base;
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
  // Advisory only. The label legitimately carries wording the value never does
  // ("70% OFF Facial"), so this warns about a contradiction rather than blocking
  // a save the admin may well have meant.
  const mismatch = labelValueMismatch(
    pool.benefitType as VoucherPool["benefitType"],
    pool.benefitValue,
    pool.displayLabel,
  );
  const valueField =
    BENEFIT_VALUE_FIELD[pool.benefitType] ?? GENERIC_BENEFIT_VALUE_FIELD;

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
        rarity: pool.rarity,
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
            <FieldLabel label={valueField.label} hint={valueField.hint} />
            <input
              // Deliberately a text input even for the numeric types: the state
              // is one string across all four, and a `type="number"` field
              // blanks a value it cannot parse, so switching type after typing
              // "dessert" would silently drop it. `inputMode` still brings up
              // the numeric keypad where one exists.
              inputMode={valueField.numeric ? "decimal" : undefined}
              placeholder={valueField.placeholder}
              required
              value={pool.benefitValue}
              onChange={(event) => setPool({ ...pool, benefitValue: event.target.value })}
            />
          </label>
          <label className="field">
            <FieldLabel
              label="Display Label"
              hint="This short label is shown to customers on the voucher, and is what staff read at checkout when applying the discount."
            />
            <input
              placeholder="20% OFF"
              required
              value={pool.displayLabel}
              onChange={(event) => setPool({ ...pool, displayLabel: event.target.value })}
            />
            {mismatch ? (
              <small className="alert" role="alert">
                {mismatch}
              </small>
            ) : null}
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
          <SelectMenu
            hint={`How rare this tier is. Sets both the badge customers see and how often it is won: a Legendary tier comes up ${RARITY_WEIGHTS.standard / RARITY_WEIGHTS.legendary}x less often than a Standard one.`}
            label="Rarity"
            onChange={(rarity) =>
              setPool({ ...pool, rarity: rarity as VoucherRarity })
            }
            options={RARITY_OPTIONS}
            value={pool.rarity}
          />
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

      {/* The real customer-facing ticket, not a mock-up of one: same component
          and same `.card.candidate.voucher-*` wrapper the campaign page mounts
          it in, so what an admin approves here is what actually ships. */}
      <FormCard
        title="Preview"
        description="How this tier looks to a customer when they win it."
      >
        <div className="pool-preview">
          <article className={`card candidate voucher-${pool.rarity}`}>
            <VoucherCard
              benefit={{
                benefitType: pool.benefitType as VoucherPool["benefitType"],
                benefitValue: pool.benefitValue,
                displayLabel: pool.displayLabel || "Your benefit label",
                rarity: pool.rarity,
              }}
              code="BIZ-XXXXXXXXXXXXXXXX"
              detail={previewDetail(pool.benefitType, pool.minimumSpend)}
            />
          </article>
        </div>
      </FormCard>

      <FormCard
        title="Availability"
        description="Bookable at these date/time slots, and redeemable until the booked slot ends. How often the tier is won is set by Rarity, not by how many slots you pick."
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
