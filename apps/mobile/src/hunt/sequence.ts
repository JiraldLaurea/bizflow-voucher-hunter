import type { RoulettePreview } from "@/api/client";

/**
 * Number of cards in one native reel cycle.
 *
 * The web can cheaply move dozens of DOM cards, but each native ticket contains
 * two gradients, cutouts, text and an Android shadow. Twelve cards still include
 * every campaign voucher and repeat by weight, while the doubled seamless track
 * stays small enough to animate as one cached GPU layer.
 */
export const SPIN_COUNT = 12;

/** Repeats `items` up to `count` cards so the reel always has a full cycle. */
export function rouletteLoop(items: RoulettePreview[], count = SPIN_COUNT) {
  if (items.length === 0) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]);
}

/**
 * Builds the reel contents, weighting each pool's share of the cards by its
 * probability so the reel looks like the odds it represents. Ported from the web's
 * `rouletteSequence`.
 */
export function rouletteSequence(
  previews: RoulettePreview[],
  winner: RoulettePreview,
): { items: RoulettePreview[]; winnerIndex: number } {
  const pool = previews.length > 0 ? previews : [winner];
  // Keep at least one visual occurrence of every configured tier, even for a
  // campaign with more tiers than the usual demo campaigns.
  const sequenceCount = Math.max(SPIN_COUNT, pool.length + 5);
  const weighted = pool.flatMap((item) =>
    Array.from({
      length: Math.max(
        1,
        Math.min(4, Math.round((item.probabilityWeight ?? 1) / 15)),
      ),
    }).map(() => item),
  );
  const loop = [...pool, ...weighted, ...pool.slice().reverse()];
  const sequence: RoulettePreview[] = [];
  const trailingCount = 4;
  while (sequence.length < sequenceCount - trailingCount - 1) {
    sequence.push(loop[sequence.length % loop.length] ?? winner);
  }

  const finalApproachLength = Math.min(3, sequence.length);
  for (let index = 1; index <= finalApproachLength; index += 1) {
    sequence[sequence.length - index] = winner;
  }

  const winnerIndex = sequence.length;
  const others = pool.filter((item) => item.displayLabel !== winner.displayLabel);
  const trailingPool = others.length > 0 ? others : pool;
  const trailingItems = Array.from(
    { length: trailingCount },
    (_, index) => trailingPool[index % trailingPool.length] ?? winner,
  );

  return { items: [...sequence, winner, ...trailingItems], winnerIndex };
}

/** Shown while the real pools are still loading, so the reel can spin immediately. */
export function placeholderRouletteItems() {
  return rouletteLoop([
    {
      benefitType: "discount_percent",
      benefitValue: "20",
      displayLabel: "20% OFF",
      probabilityWeight: 55,
    },
    {
      benefitType: "free_item",
      benefitValue: "dessert",
      displayLabel: "Free Dessert",
      probabilityWeight: 25,
    },
    {
      benefitType: "discount_percent",
      benefitValue: "50",
      displayLabel: "50% OFF",
      probabilityWeight: 15,
    },
    {
      benefitType: "discount_percent",
      benefitValue: "90",
      displayLabel: "90% OFF",
      probabilityWeight: 5,
    },
  ]);
}
