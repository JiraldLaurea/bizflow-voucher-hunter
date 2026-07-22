// Shared access to the per-campaign flow blob that PublicStepClient owns.
//
// The global /more screen needs to read and patch a handful of its fields (the
// verified customer session, the dev voucher choice, the hunt reset) without
// pulling in the campaign flow component. PublicStepClient remains the
// authority on the blob's full shape; everything here is a defensive partial
// read/write so the two can evolve independently.

export const flowStorageKey = (campaignSlug: string) =>
  `bizflow-flow-${campaignSlug}`;
export const flowStoragePrefix = "bizflow-flow-";

export function readFlowState(campaignSlug: string): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(flowStorageKey(campaignSlug));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function readFlowString(campaignSlug: string, field: string): string {
  const value = readFlowState(campaignSlug)[field];
  return typeof value === "string" ? value : "";
}

export function patchFlowState(
  campaignSlug: string,
  patch: Record<string, unknown>,
) {
  try {
    window.localStorage.setItem(
      flowStorageKey(campaignSlug),
      JSON.stringify({ ...readFlowState(campaignSlug), ...patch }),
    );
  } catch {
    /* ignore storage errors */
  }
}

/** Every campaign's saved flow — cleared on sign out so nothing signs back in. */
export function clearAllFlowState() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(flowStoragePrefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Fields a hunt reset clears. Sign-in identity (phone/name/email/session/user)
 * is deliberately left alone so the visitor stays signed in.
 */
export const huntResetPatch: Record<string, unknown> = {
  attempts: [],
  selectedAttemptId: "",
  rouletteInProgressAttemptId: "",
  selectedSlotId: "",
  selectedDate: "",
  issued: null,
  shareCount: 0,
  bonusAttempts: 0,
  devVoucherPoolId: "",
};
