import { describe, expect, it } from "vitest";
import { buildMapsUrl, buildTelUrl, hasPin } from "@bizflow/shared";

describe("buildMapsUrl", () => {
  it("prefers a dropped pin over the written address", () => {
    const url = buildMapsUrl({
      address: "123 Ayala Ave, Makati City",
      latitude: 14.5547,
      longitude: 121.0244,
    });
    // A written address is only as precise as the geocoder's guess, so
    // coordinates win whenever a pin exists.
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=14.5547,121.0244");
  });

  it("falls back to the address when there is no pin", () => {
    expect(buildMapsUrl({ address: "123 Ayala Ave, Makati City" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Ayala%20Ave%2C%20Makati%20City",
    );
  });

  it("ignores a half-set pin rather than pointing at the equator", () => {
    expect(buildMapsUrl({ address: "Makati", latitude: 14.5547 })).toContain("query=Makati");
  });

  it("ignores NaN coordinates", () => {
    expect(
      buildMapsUrl({ address: "Makati", latitude: Number.NaN, longitude: 121 }),
    ).toContain("query=Makati");
  });

  it("still accepts a bare address string", () => {
    expect(buildMapsUrl("Makati City")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Makati%20City",
    );
  });
});

describe("hasPin", () => {
  it("requires both halves", () => {
    expect(hasPin({ latitude: 14.5, longitude: 121 })).toBe(true);
    expect(hasPin({ latitude: 14.5 })).toBe(false);
    expect(hasPin({})).toBe(false);
  });
});

describe("buildTelUrl", () => {
  it("strips the separators people write numbers with", () => {
    expect(buildTelUrl("+63 2 8123 4567")).toBe("tel:+63281234567");
    expect(buildTelUrl("(02) 8123-4567")).toBe("tel:0281234567");
  });

  it("keeps a local number intact", () => {
    expect(buildTelUrl("09123456789")).toBe("tel:09123456789");
  });
});
