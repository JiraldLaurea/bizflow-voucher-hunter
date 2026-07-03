import { describe, expect, it } from "vitest";
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
