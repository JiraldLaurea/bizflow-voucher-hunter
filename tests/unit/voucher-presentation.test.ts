import { isSelectableAttempt } from "@/lib/voucher-presentation";
import { describe, expect, it } from "vitest";

describe("isSelectableAttempt", () => {
  it("accepts only the states the server will let a customer select", () => {
    expect(isSelectableAttempt({ status: "Candidate" })).toBe(true);
    expect(isSelectableAttempt({ status: "Held" })).toBe(true);
  });

  it("rejects attempts that are spent, released, or timed out", () => {
    // Each of these renders as a full-price voucher card if the results screen
    // trusts the snapshot as-is, and each is refused with E-ATTEMPT-STATE.
    expect(isSelectableAttempt({ status: "Expired" })).toBe(false);
    expect(isSelectableAttempt({ status: "Released" })).toBe(false);
    expect(isSelectableAttempt({ status: "Selected" })).toBe(false);
  });
});
import {
  getVoucherPresentation,
  rarityPresentation,
  RARITY_ORDER,
} from "@/lib/voucher-presentation";

describe("voucher presentation", () => {
  it.each(["standard", "rare", "epic", "legendary"] as const)(
    "returns the badge for a %s tier",
    (rarity) => {
      expect(getVoucherPresentation({ rarity })).toEqual(
        rarityPresentation(rarity),
      );
    },
  );

  it("reads the tier's rarity rather than inferring one from the benefit", () => {
    // This is what storing rarity bought: the badge no longer follows from the
    // benefit value, so a free dessert can be the top prize and a 90% discount
    // can be an everyday one if that is what the tier was set to.
    expect(getVoucherPresentation({ rarity: "legendary" }).label).toBe(
      "Legendary",
    );
    expect(getVoucherPresentation({ rarity: "standard" }).label).toBe(
      "Standard",
    );
  });

  it("gives every rarity distinct badge copy", () => {
    const labels = RARITY_ORDER.map((rarity) => rarityPresentation(rarity).label);
    expect(new Set(labels).size).toBe(RARITY_ORDER.length);
  });
});
