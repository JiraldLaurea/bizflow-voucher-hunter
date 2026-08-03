import { beforeEach, describe, expect, it } from "vitest";
import { createBusiness, listBusinesses, updateBusiness } from "@/server/admin";
import { resetDb, seedData } from "@/server/db";
import { AppError } from "@/server/errors";
import { listPublicCampaignCards } from "@/server/voucher-engine";

// Venue details live on the business, not the campaign: one venue runs many
// campaigns, and copying the address onto each guarantees they drift apart.
describe("business venue details", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const base = {
    name: "Mesa Manila",
    logoText: "MM",
    industry: "restaurant" as const,
    staffPin: "1234",
  };

  it("stores an address and contact number on create", async () => {
    const created = await createBusiness({
      ...base,
      address: "123 Ayala Ave, Makati City",
      contactNumber: "+63 2 8123 4567",
    });
    expect(created.address).toBe("123 Ayala Ave, Makati City");
    expect(created.contactNumber).toBe("+63 2 8123 4567");

    const listed = (await listBusinesses()).find((b) => b.id === created.id);
    expect(listed?.address).toBe("123 Ayala Ave, Makati City");
  });

  it("leaves both undefined when not supplied", async () => {
    const created = await createBusiness(base);
    expect(created.address).toBeUndefined();
    expect(created.contactNumber).toBeUndefined();
  });

  it("adds details to a business that was created without them", async () => {
    const created = await createBusiness(base);
    const updated = await updateBusiness(created.id, {
      address: "9 Bonifacio High Street, Taguig",
      contactNumber: "09171234567",
    });
    expect(updated.address).toBe("9 Bonifacio High Street, Taguig");
    expect(updated.contactNumber).toBe("09171234567");
  });

  it("only changes the fields supplied", async () => {
    const created = await createBusiness({
      ...base,
      address: "123 Ayala Ave",
      contactNumber: "09171234567",
    });
    const updated = await updateBusiness(created.id, { address: "456 Salcedo St" });
    expect(updated.address).toBe("456 Salcedo St");
    // Untouched, rather than blanked by omission.
    expect(updated.contactNumber).toBe("09171234567");
  });

  it("clears a field when given an empty string", async () => {
    const created = await createBusiness({ ...base, address: "123 Ayala Ave" });
    const updated = await updateBusiness(created.id, { address: "" });
    expect(updated.address).toBeUndefined();
  });

  it("trims surrounding whitespace", async () => {
    const created = await createBusiness(base);
    const updated = await updateBusiness(created.id, { address: "  123 Ayala Ave  " });
    expect(updated.address).toBe("123 Ayala Ave");
  });

  it("rejects an unknown business", async () => {
    await expect(updateBusiness("biz_missing", { address: "x" })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("refuses to blank the business name", async () => {
    const created = await createBusiness(base);
    await expect(updateBusiness(created.id, { name: "   " })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("carries the details onto public campaign cards", async () => {
    const cards = await listPublicCampaignCards();
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const business = seedData.businesses.find((b) => b.name === card.businessName);
      expect(business).toBeDefined();
      expect(card.businessAddress).toBe(business?.address);
      expect(card.businessContactNumber).toBe(business?.contactNumber);
      // Guards the SQL join: a NULL column must surface as an absent field, not
      // as the string "null".
      expect(card.businessAddress).not.toBe("null");
      expect(card.businessContactNumber).not.toBe("null");
    }
  });

  it("omits the fields entirely for a venue with no details", async () => {
    const created = await createBusiness(base);
    const listed = (await listBusinesses()).find((b) => b.id === created.id);
    expect(listed?.address).toBeUndefined();
    expect(listed?.contactNumber).toBeUndefined();
  });
});
