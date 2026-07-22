import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "@/lib/admin-session";
import { getDb, one, resetDb, run } from "@/server/db";
import { huntAndSelect } from "../helpers";
import { POST as resetDashboard } from "@/app/api/dashboard/reset/route";
import { POST as createCampaign } from "@/app/api/campaigns/route";
import { PATCH as updateCampaign } from "@/app/api/campaigns/[id]/route";
import { POST as importRedemptions } from "@/app/api/campaigns/[id]/redemptions/import/route";
import { GET as campaignMetrics } from "@/app/api/dashboard/campaigns/[id]/route";
import { GET as businesses } from "@/app/api/businesses/route";
import { POST as markNoShow } from "@/app/api/staff/vouchers/no-show/route";
import { POST as reschedule } from "@/app/api/staff/reservations/reschedule/route";
import { POST as redeemVoucher } from "@/app/api/staff/vouchers/redeem/route";
import { POST as validateReward } from "@/app/api/staff/rewards/validate-voucher/route";

async function requestFor(
  role: AdminSession["role"],
  businessIds: string[],
  url: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const token = await createAdminSession({
    email: `${role}@example.com`,
    name: `${role} user`,
    role,
    businessIds,
  });
  return new Request(url, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("dashboard role and business authorization", () => {
  beforeEach(async () => {
    process.env.ADMIN_SESSION_SECRET = "test-only-admin-session-secret-with-more-than-32-characters";
    await resetDb();
  });

  it("blocks staff from destructive reset and direct campaign creation", async () => {
    const resetResponse = await resetDashboard(
      await requestFor("staff", ["biz_demo_restaurant"], "http://localhost/api/dashboard/reset", {}),
    );
    expect(resetResponse.status).toBe(403);

    const createResponse = await createCampaign(
      await requestFor("staff", ["biz_demo_restaurant"], "http://localhost/api/campaigns", {
        businessId: "biz_demo_restaurant",
        slug: "staff-bypass",
        title: "Staff bypass",
        offerMessage: "Not allowed",
        heroImage: "linear-gradient(#fff,#eee)",
        mode: "restaurant",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        baseAttempts: 1,
        referralDailyLimit: 0,
        candidateTimeoutMinutes: 10,
        terms: "Test",
      }),
    );
    expect(createResponse.status).toBe(403);

    const updateResponse = await updateCampaign(
      await requestFor(
        "staff",
        ["biz_demo_restaurant"],
        "http://localhost/api/campaigns/camp_july_dinner",
        { title: "Unauthorized change" },
        "PATCH",
      ),
      { params: { id: "camp_july_dinner" } },
    );
    expect(updateResponse.status).toBe(403);

    const importResponse = await importRedemptions(
      await requestFor(
        "staff",
        ["biz_demo_restaurant"],
        "http://localhost/api/campaigns/camp_july_dinner/redemptions/import",
        { csv: "voucher_code\nBIZ-NOTREAL" },
      ),
      { params: { id: "camp_july_dinner" } },
    );
    expect(importResponse.status).toBe(403);
  });

  it("blocks staff from cross-business metrics and reservation mutations", async () => {
    const metricsResponse = await campaignMetrics(
      await requestFor("staff", ["biz_demo_shop"], "http://localhost/api/dashboard/campaigns/camp_july_dinner"),
      { params: { id: "camp_july_dinner" } },
    );
    expect(metricsResponse.status).toBe(403);

    const { voucher } = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639170006001",
      targetSlotId: "slot_dinner_0705_1900",
    });
    const noShowResponse = await markNoShow(
      await requestFor("staff", ["biz_demo_shop"], "http://localhost/api/staff/vouchers/no-show", {
        codeOrToken: voucher.voucherCode,
      }),
    );
    expect(noShowResponse.status).toBe(403);

    const rescheduleResponse = await reschedule(
      await requestFor("staff", ["biz_demo_shop"], "http://localhost/api/staff/reservations/reschedule", {
        codeOrToken: voucher.voucherCode,
        newSlotId: "slot_dinner_0707_1900",
      }),
    );
    expect(rescheduleResponse.status).toBe(403);
  });

  it("does not expose business PINs through the API", async () => {
    const response = await businesses(
      await requestFor("staff", ["biz_demo_restaurant"], "http://localhost/api/businesses"),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).not.toHaveProperty("staffPin");

    const stored = await one(await getDb(), "SELECT staff_pin FROM businesses WHERE id = ?", ["biz_demo_restaurant"]);
    expect(String(stored?.staff_pin)).toMatch(/^scrypt\$/);
  });

  it("uses the signed-in identity for voucher audit records", async () => {
    const { voucher } = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639170006002",
      targetSlotId: "slot_dinner_0705_1900",
    });
    const response = await redeemVoucher(
      await requestFor("staff", ["biz_demo_restaurant"], "http://localhost/api/staff/vouchers/redeem", {
        codeOrToken: voucher.voucherCode,
        staffName: "Spoofed Employee",
        purchaseAmount: 500,
      }),
    );
    expect(response.status).toBe(200);
    const log = await one(await getDb(), "SELECT staff_name FROM redemption_logs WHERE voucher_id = ?", [voucher.id]);
    expect(log?.staff_name).toBe("staff@example.com");
  });

  it("redacts wallet secrets and direct identifiers from reward validation", async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    await run(
      db,
      `INSERT INTO reward_wallets
       (id, phone, name, email, wallet_token, wallet_secret, balance_centavos, lifetime_earned_centavos, lifetime_converted_centavos, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 5000, 5000, 0, 'Active', ?, ?)`,
      ["rwal_secure_test", "+639170006003", "Private Customer", "private@example.com", "rwallet_private_token", "rwsecret_private", now, now],
    );
    await run(
      db,
      `INSERT INTO reward_vouchers
       (id, wallet_id, voucher_code, qr_token, amount_centavos, remaining_centavos, status, issued_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, 5000, 5000, 'Active', ?, ?, ?)`,
      ["rvch_secure_test", "rwal_secure_test", "RWD-SECURE", "rvoucher_secure_token", now, "2027-07-01T00:00:00.000Z", now],
    );

    const response = await validateReward(
      await requestFor("staff", ["biz_demo_restaurant"], "http://localhost/api/staff/rewards/validate-voucher", {
        codeOrToken: "RWD-SECURE",
      }),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.wallet).toEqual({ maskedPhone: "6391••••003", status: "Active" });
    expect(payload.data.wallet).not.toHaveProperty("phone");
    expect(payload.data.wallet).not.toHaveProperty("email");
    expect(payload.data.wallet).not.toHaveProperty("walletToken");
    expect(payload.data.voucher).not.toHaveProperty("walletId");
    expect(payload.data.voucher).not.toHaveProperty("qrToken");
  });
});
