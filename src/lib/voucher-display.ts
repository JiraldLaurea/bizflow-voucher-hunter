import type { CampaignSlot, Voucher } from "@/types/voucher";

// Global wallet of vouchers claimed on this device (shared across campaigns).
export const claimedVouchersStorageKey = "bizflow-claimed-vouchers";

export type ClaimedVoucher = {
  voucher: Voucher;
  slot: CampaignSlot;
  campaignSlug: string;
  campaignTitle: string;
  businessName: string;
};

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatVoucherStatus(status: Voucher["status"]) {
  if (status === "Issued") return "Confirmed";
  if (status === "Redeemed") return "Used";
  return status;
}

// The cached voucher keeps its issued-time status, so recompute expiry from the
// clock: anything not already used/cancelled is expired once past expires_at.
export function isVoucherExpired(voucher: Pick<Voucher, "status" | "expiresAt">) {
  if (voucher.status === "Redeemed" || voucher.status === "Cancelled" || voucher.status === "NoShow") {
    return false;
  }
  return voucher.status === "Expired" || new Date(voucher.expiresAt).getTime() < Date.now();
}

export function voucherStatusLabel(voucher: Pick<Voucher, "status" | "expiresAt">) {
  return isVoucherExpired(voucher) ? "Expired" : formatVoucherStatus(voucher.status);
}

export function readClaimedVouchers(): ClaimedVoucher[] {
  try {
    const raw = window.localStorage.getItem(claimedVouchersStorageKey);
    return raw ? (JSON.parse(raw) as ClaimedVoucher[]) : [];
  } catch {
    return [];
  }
}
