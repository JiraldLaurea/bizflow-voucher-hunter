import type { AttemptStatus, VoucherPool, VoucherRarity } from "./types";

export type { VoucherRarity };

/**
 * Whether an attempt is still a voucher option the customer can act on.
 *
 * The hunt snapshot returns every attempt a number has ever drawn on a
 * campaign, in whatever state it ended up, so a results screen that renders the
 * list as-is offers spins from weeks ago as live choices. The server accepts a
 * selection only in these two states and answers anything else with
 * E-ATTEMPT-STATE — an Expired attempt has already returned its stock to the
 * pool, and a Selected one has become a voucher.
 *
 * Shared so both apps draw the same line the server does.
 */
export function isSelectableAttempt(attempt: { status: AttemptStatus }) {
  return attempt.status === "Candidate" || attempt.status === "Held";
}

type VoucherBenefit = Pick<VoucherPool, "rarity">;

export type VoucherPresentation = {
  rarity: VoucherRarity;
  label: string;
  description: string;
};

/**
 * How often each rarity comes up in the draw, relative to the others.
 *
 * These are the weights `weightedPool` divides between tiers, so they are ratios
 * rather than percentages: a Legendary tier is drawn one fiftieth as often as a
 * Standard one. The numbers reproduce the odds the campaigns were seeded with
 * when weight was typed in by hand, so making rarity the control did not quietly
 * re-price any existing campaign.
 */
export const RARITY_WEIGHTS: Record<VoucherRarity, number> = {
  legendary: 1,
  epic: 5,
  rare: 15,
  standard: 50,
};

/** Rarities in the order an admin should see them: rarest prize first. */
export const RARITY_ORDER: VoucherRarity[] = [
  "legendary",
  "epic",
  "rare",
  "standard",
];

const RARITY_COPY: Record<VoucherRarity, { label: string; description: string }> = {
  legendary: { label: "Legendary", description: "Top prize" },
  epic: { label: "Epic", description: "Big reward" },
  rare: { label: "Rare", description: "Lucky find" },
  standard: { label: "Standard", description: "Everyday reward" },
};

/** The badge copy for a rarity, without needing a whole benefit to ask about. */
export function rarityPresentation(rarity: VoucherRarity): VoucherPresentation {
  return { rarity, ...RARITY_COPY[rarity] };
}

/**
 * The rarity badge a customer sees.
 *
 * A thin read of the tier's stored rarity. It used to be inferred from benefit
 * value, which meant a free item could never be a top prize and a big discount
 * could never be an everyday one; rarity is chosen per tier now, and this is the
 * only thing that decides the badge.
 */
export function getVoucherPresentation(
  benefit: VoucherBenefit,
): VoucherPresentation {
  return rarityPresentation(benefit.rarity);
}
