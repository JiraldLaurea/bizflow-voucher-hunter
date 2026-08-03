import type { VoucherPool } from "@bizflow/shared";

import type { Language, TranslationKey } from "@/i18n/translations";

type Translate = (
  key: TranslationKey,
  variables?: Record<string, number | string>,
) => string;

const LANGUAGE_LOCALES: Record<Language, string> = {
  en: "en-PH",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
};

const MODE_KEYS: Record<string, TranslationKey> = {
  beauty: "mode.beauty",
  online_shop: "mode.onlineShop",
  other: "mode.other",
  pet: "mode.pet",
  restaurant: "mode.restaurant",
  retail: "mode.retail",
};

const INSTRUCTION_KEYS: Record<string, TranslationKey> = {
  beauty: "campaign.instruction.beauty",
  online_shop: "campaign.instruction.onlineShop",
  other: "campaign.instruction.other",
  pet: "campaign.instruction.pet",
  restaurant: "campaign.instruction.restaurant",
  retail: "campaign.instruction.retail",
};

export const CAMPAIGN_MODES = [
  "restaurant",
  "online_shop",
  "beauty",
  "pet",
  "retail",
  "other",
] as const;

export function localeFor(language: Language) {
  return LANGUAGE_LOCALES[language];
}

/** Slot dates are plain Manila calendar dates, so keep the explicit +08:00 anchor. */
export function formatDate(date: string, locale = "en-PH") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export function formatCampaignRange(
  startDate: string,
  endDate: string,
  locale = "en-PH",
) {
  const start = new Date(`${startDate}T00:00:00+08:00`);
  const end = new Date(`${endDate}T00:00:00+08:00`);
  const monthDay = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const monthDayYear = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthDay.format(start)} - ${monthDayYear.format(end)}`;
  }
  return `${monthDayYear.format(start)} - ${monthDayYear.format(end)}`;
}

export function formatTime(time: string, locale = "en-PH") {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(`2000-01-01T${time}:00+08:00`));
}

export function campaignModeLabel(t: Translate, mode: string) {
  return t(MODE_KEYS[mode] ?? "mode.other");
}

export function campaignInstruction(t: Translate, mode: string) {
  return t(INSTRUCTION_KEYS[mode] ?? "campaign.instruction.other");
}

type Benefit = Pick<VoucherPool, "benefitType" | "benefitValue" | "displayLabel">;

export function voucherDisplayLabel(t: Translate, benefit: Benefit) {
  if (benefit.benefitType === "discount_percent") {
    return t("voucher.discountPercent", { value: benefit.benefitValue });
  }
  if (benefit.benefitType === "fixed_amount") {
    return t("voucher.fixedAmount", { value: benefit.benefitValue });
  }
  if (benefit.benefitType === "free_shipping") return t("voucher.freeShipping");
  if (/dessert/i.test(benefit.displayLabel)) return t("voucher.freeDessert");
  return t("voucher.freeItem");
}

export function voucherDetail(t: Translate, benefit: Benefit) {
  if (benefit.benefitType === "free_item") {
    return /dessert/i.test(benefit.displayLabel)
      ? t("voucher.detail.freeDessert")
      : t("voucher.detail.freeItem");
  }
  if (benefit.benefitType === "free_shipping") {
    return t("voucher.detail.freeShipping");
  }
  return t("voucher.detail.selectedItems");
}

export function voucherRarityLabel(t: Translate, rarity: string) {
  return t(RARITY_LABEL_KEYS[rarity] ?? "voucher.rarity.standard");
}

export function voucherRarityDescription(t: Translate, rarity: string) {
  return t(
    RARITY_DESCRIPTION_KEYS[rarity] ?? "voucher.rarityDescription.standard",
  );
}

const RARITY_LABEL_KEYS: Record<string, TranslationKey> = {
  standard: "voucher.rarity.standard",
  rare: "voucher.rarity.rare",
  epic: "voucher.rarity.epic",
  legendary: "voucher.rarity.legendary",
};

const RARITY_DESCRIPTION_KEYS: Record<string, TranslationKey> = {
  standard: "voucher.rarityDescription.standard",
  rare: "voucher.rarityDescription.rare",
  epic: "voucher.rarityDescription.epic",
  legendary: "voucher.rarityDescription.legendary",
};

export function voucherStatusLabel(t: Translate, status: string) {
  if (status === "issued") return t("vouchers.statusIssued");
  if (status === "active") return t("vouchers.statusActive");
  if (status === "redeemed") return t("vouchers.statusRedeemed");
  if (status === "expired") return t("vouchers.statusExpired");
  return status;
}
