import { beforeEach, describe, expect, it } from "vitest";
import { getCustomer, listCustomers } from "@/server/customers";
import { getDb, resetDb, run } from "@/server/db";
import { AppError } from "@/server/errors";
import { listBusinesses, listCampaigns } from "@/server/admin";
import { startHunt } from "@/server/voucher-engine";

const ADMIN = { role: "super_admin", businessIds: ["*"] };

describe("dashboard customers", () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function joinCampaign(phone: string, slug: string) {
    await startHunt({ campaignSlug: slug, phone, sessionId: `sess_${phone}` });
  }

  it("lists nobody before anyone hunts", async () => {
    expect(await listCustomers(ADMIN)).toEqual([]);
  });

  it("groups a phone across campaigns into one customer", async () => {
    const campaigns = await listCampaigns();
    const [first, second] = campaigns;
    await joinCampaign("+639171234567", first.slug);
    await joinCampaign("+639171234567", second.slug);

    const customers = await listCustomers(ADMIN);
    // `users` is keyed per campaign, so this is two rows and must still read as
    // one person.
    expect(customers).toHaveLength(1);
    expect(customers[0].phone).toBe("+639171234567");
    expect(customers[0].campaignCount).toBe(2);
  });

  it("searches by number", async () => {
    const [campaign] = await listCampaigns();
    await joinCampaign("+639171234567", campaign.slug);
    await joinCampaign("+639998887777", campaign.slug);

    expect(await listCustomers(ADMIN, "9171")).toHaveLength(1);
    expect(await listCustomers(ADMIN, "0000")).toHaveLength(0);
  });

  it("shows staff only customers of their own business", async () => {
    const businesses = await listBusinesses();
    const campaigns = await listCampaigns();
    const mine = campaigns[0];
    const theirs = campaigns.find((c) => c.businessId !== mine.businessId);
    expect(theirs).toBeDefined();

    await joinCampaign("+639171234567", mine.slug);
    await joinCampaign("+639998887777", theirs!.slug);

    const staff = { role: "staff", businessIds: [mine.businessId] };
    const visible = await listCustomers(staff);
    expect(visible.map((c) => c.phone)).toEqual(["+639171234567"]);
    expect(businesses.length).toBeGreaterThan(1);
  });

  it("hides an out-of-scope customer behind the same 404 as an unknown one", async () => {
    const campaigns = await listCampaigns();
    const mine = campaigns[0];
    const theirs = campaigns.find((c) => c.businessId !== mine.businessId)!;
    await joinCampaign("+639998887777", theirs.slug);

    const staff = { role: "staff", businessIds: [mine.businessId] };
    // Otherwise the difference between "no such customer" and "not yours" would
    // let staff probe for other businesses' customers.
    await expect(getCustomer(staff, "+639998887777")).rejects.toBeInstanceOf(AppError);
    await expect(getCustomer(staff, "+639000000000")).rejects.toBeInstanceOf(AppError);
  });

  it("shows a staff account with no business nobody at all", async () => {
    const [campaign] = await listCampaigns();
    await joinCampaign("+639171234567", campaign.slug);
    expect(await listCustomers({ role: "staff", businessIds: [] })).toEqual([]);
  });

  it("returns the campaigns a customer joined", async () => {
    const campaigns = await listCampaigns();
    await joinCampaign("+639171234567", campaigns[0].slug);

    const detail = await getCustomer(ADMIN, "+639171234567");
    expect(detail.summary.phone).toBe("+639171234567");
    expect(detail.campaigns).toHaveLength(1);
    expect(detail.campaigns[0].campaignSlug).toBe(campaigns[0].slug);
    expect(detail.vouchers).toEqual([]);
  });

  it("reports the loyalty balance when the phone has a wallet", async () => {
    const [campaign] = await listCampaigns();
    await joinCampaign("+639171234567", campaign.slug);

    const db = await getDb();
    await run(
      db,
      `INSERT INTO reward_wallets
         (id, phone, wallet_token, wallet_secret, balance_centavos, lifetime_earned_centavos,
          lifetime_converted_centavos, status, created_at, updated_at)
       VALUES ('w_test', '+639171234567', 'tok_test', 'sec_test', 2500, 2500, 0, 'Active', ?, ?)`,
      [new Date().toISOString(), new Date().toISOString()],
    );

    const [customer] = await listCustomers(ADMIN);
    expect(customer.loyaltyBalanceCentavos).toBe(2500);

    const detail = await getCustomer(ADMIN, "+639171234567");
    expect(detail.summary.loyaltyBalanceCentavos).toBe(2500);
  });

  it("leaves the balance undefined when there is no wallet", async () => {
    const [campaign] = await listCampaigns();
    await joinCampaign("+639171234567", campaign.slug);
    const [customer] = await listCustomers(ADMIN);
    expect(customer.loyaltyBalanceCentavos).toBeUndefined();
  });
});
