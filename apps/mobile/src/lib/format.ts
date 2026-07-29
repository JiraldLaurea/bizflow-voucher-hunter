import type { VoucherPool } from "@bizflow/shared";

/**
 * Ported verbatim from the web `PublicStepClient`. Slot dates are plain `YYYY-MM-DD`
 * strings anchored to Manila, so they are parsed with an explicit `+08:00` offset —
 * without it a device in another timezone renders the previous day.
 */
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export function formatCampaignRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+08:00`);
  const end = new Date(`${endDate}T00:00:00+08:00`);
  const monthDay = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  });
  const monthDayYear = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthDay.format(start)} - ${monthDayYear.format(end)}`;
  }
  return `${monthDayYear.format(start)} - ${monthDayYear.format(end)}`;
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function voucherDetail(
  benefit: Pick<VoucherPool, "benefitType" | "benefitValue">,
) {
  if (benefit.benefitType === "free_item") return "Any dessert";
  if (benefit.benefitType === "free_shipping") return "Free shipping reward";
  return "On selected items";
}

export const CAMPAIGN_MODE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  online_shop: "Online Shop",
  beauty: "Beauty",
  pet: "Pet",
  retail: "Retail",
  other: "Other",
};
