import { describe, expect, it } from "vitest";
import { campaignSlug } from "@/lib/campaign-slug";

// The slug is the campaign's public URL and is no longer typed by hand, so the
// derivation is the only thing standing between a title and a broken link.
describe("campaignSlug", () => {
  it("lowercases and hyphenates a title", () => {
    expect(campaignSlug("July Dinner")).toBe("july-dinner");
  });

  it("collapses runs of punctuation and spacing into one hyphen", () => {
    expect(campaignSlug("8PM  Drop -- Round #2")).toBe("8pm-drop-round-2");
  });

  it("trims leading and trailing separators", () => {
    expect(campaignSlug("  ...Glow Facial Week!  ")).toBe("glow-facial-week");
  });

  it("strips accents rather than dropping the letters", () => {
    expect(campaignSlug("Café Mañana")).toBe("cafe-manana");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(campaignSlug("!!! ???")).toBe("");
  });

  it("only ever emits the characters a slug allows", () => {
    for (const title of ["July Dinner", "Café Mañana", "8PM  Drop -- Round #2"]) {
      expect(campaignSlug(title)).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
