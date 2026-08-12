import { describe, expect, it } from "vitest";
import { benefitValueProblem, labelValueMismatch } from "@bizflow/shared";

describe("benefitValueProblem", () => {
  it("accepts a percent inside 1-100", () => {
    expect(benefitValueProblem("discount_percent", "90")).toBeNull();
    expect(benefitValueProblem("discount_percent", "1")).toBeNull();
    expect(benefitValueProblem("discount_percent", "100")).toBeNull();
  });

  it("rejects a percent above 100 or at zero", () => {
    // The case that motivated the rule: 500 stored fine and rendered as a
    // Legendary tier, meaning whatever the display label happened to say.
    expect(benefitValueProblem("discount_percent", "500")).toMatch(/between 1 and 100/);
    expect(benefitValueProblem("discount_percent", "0")).toMatch(/between 1 and 100/);
  });

  it("rejects a percent that is not a number", () => {
    expect(benefitValueProblem("discount_percent", "half")).toMatch(/needs a number/);
  });

  it("requires a positive fixed amount", () => {
    expect(benefitValueProblem("fixed_amount", "500")).toBeNull();
    expect(benefitValueProblem("fixed_amount", "0")).toMatch(/greater than 0/);
  });

  it("leaves free_item and free_shipping values alone", () => {
    // These are the reason the column is a string: "dessert" is a valid value.
    expect(benefitValueProblem("free_item", "dessert")).toBeNull();
    expect(benefitValueProblem("free_shipping", "free_shipping")).toBeNull();
  });

  it("rejects an empty value for every type", () => {
    expect(benefitValueProblem("free_item", "   ")).toMatch(/required/);
  });
});

describe("labelValueMismatch", () => {
  it("stays quiet when the label's number matches", () => {
    expect(labelValueMismatch("discount_percent", "70", "70% OFF")).toBeNull();
  });

  it("stays quiet when the label carries extra wording", () => {
    // The seeded "70% OFF Facial" tier: customised copy is not a mismatch.
    expect(labelValueMismatch("discount_percent", "70", "70% OFF Facial")).toBeNull();
  });

  it("warns when the label would give away more than the value", () => {
    const warning = labelValueMismatch("discount_percent", "9", "90% OFF");
    expect(warning).toMatch(/Staff honour the label/);
  });

  it("stays quiet when the label has no number to compare", () => {
    expect(labelValueMismatch("discount_percent", "50", "Half Price")).toBeNull();
  });

  it("does not police labels for non-numeric benefit types", () => {
    expect(labelValueMismatch("free_item", "dessert", "2 Free Desserts")).toBeNull();
  });
});
