import { beforeEach, describe, expect, it } from "vitest";
import { getDb, one, resetDb, run } from "@/server/db";
import {
  devRefreshIssuedVouchers,
  validateVoucher,
} from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

const phone = "+639171117777";

/**
 * The dev tool exists because demo bookings age out. It has to work on the
 * vouchers that actually go stale — the ones already marked Expired — which is
 * exactly what the first version missed.
 */
describe("dev voucher refresh", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("brings an expired voucher back with a future booking", async () => {
    const issued = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone,
      sessionId: "refresh-session",
      name: "Refresh Customer",
      guestCount: 2,
    });
    const db = await getDb();

    // Age it the way real time does: the slot is in the past and the row has
    // been flipped to Expired by a validation.
    await run(db, "UPDATE slots SET date = '2026-07-01' WHERE id = ?", [
      issued.slot.id,
    ]);
    await run(
      db,
      "UPDATE vouchers SET status = 'Expired', expires_at = ? WHERE voucher_code = ?",
      ["2026-07-01T13:00:00.000Z", issued.voucher.voucherCode],
    );
    const stale = await validateVoucher({
      codeOrToken: issued.voucher.voucherCode,
    });
    expect(stale.voucher.status).toBe("Expired");

    const { refreshed } = await devRefreshIssuedVouchers({ phone });
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]).toMatchObject({
      voucherCode: issued.voucher.voucherCode,
    });
    expect(refreshed[0].movedTo).toBeTruthy();

    // Usable again, and for real reasons: issued, unexpired, booked ahead.
    const after = await validateVoucher({
      codeOrToken: issued.voucher.voucherCode,
    });
    expect(after.voucher.status).toBe("Issued");
    expect(new Date(after.voucher.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    const slot = await one(
      db,
      "SELECT date FROM slots WHERE id = (SELECT slot_id FROM vouchers WHERE voucher_code = ?)",
      [issued.voucher.voucherCode],
    );
    expect(String(slot?.date) >= "2026-07-03").toBe(true);
  });

  it("leaves a redeemed voucher alone", async () => {
    const issued = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone,
      sessionId: "refresh-session-2",
      name: "Refresh Customer",
      guestCount: 2,
    });
    await run(
      await getDb(),
      "UPDATE vouchers SET status = 'Redeemed' WHERE voucher_code = ?",
      [issued.voucher.voucherCode],
    );

    const { refreshed } = await devRefreshIssuedVouchers({ phone });
    expect(refreshed).toHaveLength(0);
  });
});
