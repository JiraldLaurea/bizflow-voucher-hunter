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
import { getVoucherPresentation } from "@/lib/voucher-presentation";

describe("voucher presentation", () => {
  it.each([
    ["20", "standard"],
    ["30", "rare"],
    ["50", "epic"],
    ["90", "legendary"],
  ] as const)("classifies a %s%% discount as %s", (benefitValue, rarity) => {
    expect(
      getVoucherPresentation({
        benefitType: "discount_percent",
        benefitValue,
      }).rarity,
    ).toBe(rarity);
  });

  it("treats free items as rare and free shipping as standard", () => {
    expect(
      getVoucherPresentation({
        benefitType: "free_item",
        benefitValue: "dessert",
      }).rarity,
    ).toBe("rare");
    expect(
      getVoucherPresentation({
        benefitType: "free_shipping",
        benefitValue: "free_shipping",
      }).rarity,
    ).toBe("standard");
  });

  it("parses formatted fixed amounts", () => {
    expect(
      getVoucherPresentation({
        benefitType: "fixed_amount",
        benefitValue: "PHP 1,000",
      }).rarity,
    ).toBe("legendary");
  });
});
