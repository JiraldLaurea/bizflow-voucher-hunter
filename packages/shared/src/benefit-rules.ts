import type { VoucherPool } from "./types";

type BenefitType = VoucherPool["benefitType"];

/**
 * Benefit Value is deliberately polymorphic — `discount_percent` stores "90",
 * `free_item` stores "dessert" — so it cannot be validated by shape alone. These
 * helpers carry the per-type rules, shared so the form, the API schemas and
 * createPool all draw the same line rather than three drifting copies.
 */

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Why a benefit value is unusable for its type, or null when it is fine.
 *
 * Nothing downstream computes a discount from this number — the checkout applies it
 * by reading Display Label — but an out-of-range value still misprices the tier
 * everywhere it is shown, and "500% off" should never reach a customer's screen.
 */
export function benefitValueProblem(
  benefitType: BenefitType,
  benefitValue: string,
): string | null {
  const trimmed = benefitValue.trim();
  if (!trimmed) return "Benefit Value is required.";

  if (benefitType === "discount_percent") {
    const value = parseNumber(trimmed);
    if (value === undefined) {
      return "Discount Percent needs a number, for example 20.";
    }
    if (value <= 0 || value > 100) {
      return "A discount percent must be between 1 and 100.";
    }
  }

  if (benefitType === "fixed_amount") {
    const value = parseNumber(trimmed);
    if (value === undefined) {
      return "Fixed Amount needs a number, for example 500.";
    }
    if (value <= 0) return "A fixed amount must be greater than 0.";
  }

  return null;
}

/**
 * Warns when Display Label contradicts Benefit Value.
 *
 * The two are independent by design: a tier can read "70% OFF Facial" while its
 * value is plain "70". But the label is the only thing anyone acts on — staff
 * read it at checkout — so a label saying 90 against a value of 9 gives away an
 * order. Advisory rather than blocking, because a label legitimately carries
 * words the value never will, and may carry no number at all ("Half Price").
 */
export function labelValueMismatch(
  benefitType: BenefitType,
  benefitValue: string,
  displayLabel: string,
): string | null {
  if (benefitType !== "discount_percent" && benefitType !== "fixed_amount") {
    return null;
  }
  const value = parseNumber(benefitValue);
  if (value === undefined) return null;

  const labelNumber = displayLabel.match(/\d+(\.\d+)?/);
  if (!labelNumber) return null;

  const labelValue = Number.parseFloat(labelNumber[0]);
  if (labelValue === value) return null;

  return `Display Label says ${labelNumber[0]} but Benefit Value is ${benefitValue.trim()}. Staff honour the label, so this tier would be given away at ${labelNumber[0]}.`;
}
