import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "@/lib/admin-session";
import { createAdminUser, updateAdminUser } from "@/server/admin-users";
import { requireAdmin } from "@/server/auth";
import { generateVoucherCode } from "@/server/codes";
import { getDb, one, resetDb, run } from "@/server/db";
import { redeemVoucher } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

describe("voucher code entropy", () => {
  it("generates codes wide enough that guessing one is not a strategy", () => {
    const code = generateVoucherCode("BIZ");
    // 16 characters over a 32-symbol alphabet is 80 bits. The previous format
    // was six hex characters — 24 bits, a space of 16.7 million, which every
    // code-resolving endpoint was an oracle for.
    expect(code).toMatch(/^BIZ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/);
  });

  it("omits characters that are ambiguous when a code is read aloud", () => {
    const alphabet = new Set(
      Array.from({ length: 400 }, () => generateVoucherCode("X").slice(2)).join(""),
    );
    for (const ambiguous of ["O", "0", "I", "1"]) {
      expect(alphabet.has(ambiguous)).toBe(false);
    }
  });

  it("does not repeat a code across many issuances", () => {
    const codes = new Set(
      Array.from({ length: 2000 }, () => generateVoucherCode("BIZ")),
    );
    expect(codes.size).toBe(2000);
  });
});

describe("campaign voucher redemption", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects a second redemption of the same voucher", async () => {
    const { voucher } = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639170003333",
    });

    await redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout@example.com" });
    await expect(
      redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout@example.com" }),
    ).rejects.toMatchObject({ code: "E-VOUCHER-REDEEMED" });

    // One redemption, one log row: a double scan must not bill the partner twice
    // or hand the goods over twice.
    const db = await getDb();
    const row = await one(
      db,
      "SELECT COUNT(*) AS c FROM redemption_logs WHERE voucher_id = ?",
      [voucher.id],
    );
    expect(Number(row.c)).toBe(1);
  });

  it("does not redeem a voucher that was claimed after this scan began", async () => {
    const { voucher } = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639170004444",
    });

    // Stands in for the other checkout winning the race: the row is already
    // Redeemed by the time the UPDATE runs. The conditional `AND status <>
    // 'Redeemed'` is what turns that into a refusal rather than a second
    // redemption log and a second loyalty credit.
    const db = await getDb();
    await run(db, "UPDATE vouchers SET status = 'Redeemed', redeemed_at = ? WHERE id = ?", [
      new Date().toISOString(),
      voucher.id,
    ]);

    await expect(
      redeemVoucher({ codeOrToken: voucher.voucherCode, staffName: "checkout-b@example.com" }),
    ).rejects.toMatchObject({ code: "E-VOUCHER-REDEEMED" });

    const row = await one(
      db,
      "SELECT COUNT(*) AS c FROM redemption_logs WHERE voucher_id = ?",
      [voucher.id],
    );
    expect(Number(row.c)).toBe(0);
  });
});

describe("admin session revocation", () => {
  beforeEach(async () => {
    process.env.ADMIN_SESSION_SECRET =
      "test-only-admin-session-secret-with-more-than-32-characters";
    await resetDb();
    // Console logins are deliberately outside DATA_TABLES — they are real
    // credentials, and a schema-version bump wipes everything listed there — so
    // resetDb leaves them behind. Clear only the accounts this file creates.
    const db = await getDb();
    await run(db, "DELETE FROM admin_users WHERE email IN (?, ?)", [
      "leaver@example.com",
      "demoted@example.com",
    ]);
  });

  async function requestWithSessionFor(email: string, role: "super_admin" | "admin" | "staff", businessIds: string[]) {
    const token = await createAdminSession({ email, name: "Test", role, businessIds });
    return new Request("http://localhost/api/dashboard/reset", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
    });
  }

  it("refuses a session whose account has since been disabled", async () => {
    const user = await createAdminUser({
      email: "leaver@example.com",
      name: "Leaver",
      role: "admin",
      password: "a-long-enough-password",
      businessIds: ["*"],
    });
    const request = await requestWithSessionFor("leaver@example.com", "admin", ["*"]);

    await expect(requireAdmin(request)).resolves.toMatchObject({ role: "admin" });

    await updateAdminUser(user.id, { status: "disabled" }, { email: "someone@example.com" });
    // The signed cookie is still valid for hours. Without re-reading the account
    // a dismissed admin kept every right until it expired on its own.
    await expect(requireAdmin(request)).rejects.toMatchObject({ code: "E-ADMIN-DISABLED" });
  });

  it("applies a demotion to a session issued before it", async () => {
    const user = await createAdminUser({
      email: "demoted@example.com",
      name: "Demoted",
      role: "admin",
      password: "a-long-enough-password",
      businessIds: ["*"],
    });
    const request = await requestWithSessionFor("demoted@example.com", "admin", ["*"]);

    await updateAdminUser(
      user.id,
      { role: "staff", businessIds: ["biz_demo_restaurant"] },
      { email: "someone@example.com" },
    );

    // The cookie still claims admin over every business; the live row wins.
    const session = await requireAdmin(request);
    expect(session.role).toBe("staff");
    expect(session.businessIds).toEqual(["biz_demo_restaurant"]);
  });

  it("still accepts the env bootstrap login, which has no account row", async () => {
    const request = await requestWithSessionFor("bootstrap@example.com", "super_admin", ["*"]);
    await expect(requireAdmin(request)).resolves.toMatchObject({ role: "super_admin" });
  });
});
