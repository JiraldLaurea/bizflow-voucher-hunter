import type { VoucherPool } from "@/types/voucher";

export type VoucherRarity = "standard" | "rare" | "epic" | "legendary";

type VoucherBenefit = Pick<VoucherPool, "benefitType" | "benefitValue">;

export type VoucherPresentation = {
  rarity: VoucherRarity;
  label: string;
  description: string;
};

function numericValue(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Converts benefit value into a customer-facing rarity tier. The thresholds
 * mirror the seeded pool weighting: high-value discounts are deliberately the
 * least likely rewards, while utility rewards remain more understated.
 */
export function getVoucherPresentation(
  benefit: VoucherBenefit,
): VoucherPresentation {
  const value = numericValue(benefit.benefitValue);

  if (benefit.benefitType === "discount_percent") {
    if (value >= 75) {
      return {
        rarity: "legendary",
        label: "Legendary",
        description: "Top prize",
      };
    }
    if (value >= 50) {
      return {
        rarity: "epic",
        label: "Epic",
        description: "Big reward",
      };
    }
    if (value >= 30) {
      return {
        rarity: "rare",
        label: "Rare",
        description: "Lucky find",
      };
    }
  }

  if (benefit.benefitType === "fixed_amount") {
    if (value >= 1000) {
      return {
        rarity: "legendary",
        label: "Legendary",
        description: "Top prize",
      };
    }
    if (value >= 500) {
      return { rarity: "epic", label: "Epic", description: "Big reward" };
    }
    if (value >= 250) {
      return { rarity: "rare", label: "Rare", description: "Lucky find" };
    }
  }

  if (benefit.benefitType === "free_item") {
    return { rarity: "rare", label: "Rare", description: "Bonus treat" };
  }

  return {
    rarity: "standard",
    label: "Standard",
    description: "Everyday reward",
  };
}
