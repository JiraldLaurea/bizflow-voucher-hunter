import { describe, expect, it } from "vitest";
import { isValidPhilippinePhone, maskPhone, normalizePhone } from "@/server/phone";

describe("phone normalization", () => {
  it("keeps an already-international number as-is", () => {
    expect(normalizePhone("+639171234567")).toBe("+639171234567");
  });

  it("converts a local 09xx number to +639xx", () => {
    expect(normalizePhone("09171234567")).toBe("+639171234567");
  });

  it("adds the missing + to a 639xx number", () => {
    expect(normalizePhone("639171234567")).toBe("+639171234567");
  });

  it("strips spaces, hyphens, parens, and dots before matching", () => {
    expect(normalizePhone("0917-123.4567")).toBe("+639171234567");
    expect(normalizePhone("(0917) 123 4567")).toBe("+639171234567");
  });

  it("rejects numbers that are not valid PH mobile numbers", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1234567890")).toBeNull();
    expect(normalizePhone("0817123456")).toBeNull();
  });

  it("isValidPhilippinePhone mirrors normalizePhone", () => {
    expect(isValidPhilippinePhone("09171234567")).toBe(true);
    expect(isValidPhilippinePhone("not-a-phone")).toBe(false);
  });

  it("masks the middle digits of a normalized number", () => {
    expect(maskPhone("+639171234567")).toBe("+6391***4567");
  });
});
