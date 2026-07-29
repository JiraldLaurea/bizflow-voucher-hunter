import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { all, getDb, resetDb } from "@/server/db";
import {
  notifyDailyLoyaltyAvailable,
  phonesAwaitingDailyLoyalty,
  reservationsDueOn,
} from "@/server/notifications";
import {
  listPushDevices,
  registerPushDevice,
  sendPush,
  setPushPreferences,
} from "@/server/push";
import { getOrCreateRewardWallet } from "@/server/rewards-network";
import { huntAndSelect } from "../helpers";

const phone = "+639171114444";
const token = "ExponentPushToken[test-device-aaa]";

/** Stands in for Expo's push service; every send reports an `ok` ticket. */
function mockExpoOk() {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }, { status: "ok", id: "ticket-2" }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
}

describe("push notifications", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers a device idempotently and reassigns a reused token", async () => {
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });
    expect(await listPushDevices(phone)).toHaveLength(1);

    // Same handset, new owner: the token must move rather than duplicate, so the
    // previous customer stops receiving that device's notifications.
    const other = "+639171115555";
    await registerPushDevice({ phone: other, expoPushToken: token, platform: "android" });
    expect(await listPushDevices(phone)).toHaveLength(0);
    expect(await listPushDevices(other)).toHaveLength(1);
  });

  it("does not send to a category the customer has switched off", async () => {
    const fetchMock = mockExpoOk();
    vi.stubGlobal("fetch", fetchMock);

    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });
    await setPushPreferences({ phone, daily: false });

    const result = await sendPush({
      phone,
      category: "daily",
      title: "t",
      body: "b",
    });

    expect(result.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    // A different category on the same device is unaffected.
    const rewards = await sendPush({
      phone,
      category: "rewards",
      title: "t",
      body: "b",
    });
    expect(rewards.sent).toBe(1);
  });

  it("sends the daily nudge at most once per Manila day", async () => {
    vi.stubGlobal("fetch", mockExpoOk());
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });

    const first = await notifyDailyLoyaltyAvailable({ phone, date: "2026-07-03" });
    const second = await notifyDailyLoyaltyAvailable({ phone, date: "2026-07-03" });

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);

    // A new day is a new dedupe key, so the nudge is allowed again.
    const nextDay = await notifyDailyLoyaltyAvailable({ phone, date: "2026-07-04" });
    expect(nextDay.sent).toBe(1);
  });

  it("keeps a failed send from throwing, and logs it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("expo unreachable");
      }),
    );
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });

    // The caller is a business flow; it must survive the notification failing.
    const result = await sendPush({ phone, category: "rewards", title: "t", body: "b" });
    expect(result.failed).toBeGreaterThan(0);
    expect(result.sent).toBe(0);
  });

  it("targets only customers who have not collected today's LP", async () => {
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });
    expect(await phonesAwaitingDailyLoyalty()).toContain(phone);

    // Opening the wallet awards the daily LP, which removes them from the list.
    await getOrCreateRewardWallet({ phone, name: "LP User" });
    expect(await phonesAwaitingDailyLoyalty()).not.toContain(phone);
  });

  it("finds reservations due on a date for customers with a device", async () => {
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });
    const issued = await huntAndSelect({ campaignSlug: "july-dinner", phone });

    const due = await reservationsDueOn(issued.slot.date);
    const mine = due.find((row) => row.phone === phone);
    expect(mine).toBeDefined();
    expect(mine?.voucherId).toBe(issued.voucher.id);
    expect(mine?.businessName).toBeTruthy();

    // A date with no bookings yields nothing.
    expect(await reservationsDueOn("2030-01-01")).toHaveLength(0);
  });

  it("excludes reservations for customers with no registered device", async () => {
    const issued = await huntAndSelect({ campaignSlug: "july-dinner", phone });
    expect(await reservationsDueOn(issued.slot.date)).toHaveLength(0);
  });

  it("records every attempt in push_logs for auditing", async () => {
    vi.stubGlobal("fetch", mockExpoOk());
    await registerPushDevice({ phone, expoPushToken: token, platform: "android" });
    await sendPush({ phone, category: "rewards", title: "Title", body: "Body" });

    const db = await getDb();
    const logs = await all(db, "SELECT * FROM push_logs WHERE phone = ?", [phone]);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("sent");
    expect(logs[0].category).toBe("rewards");
  });
});
