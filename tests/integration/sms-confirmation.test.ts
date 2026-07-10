import { beforeEach, describe, expect, it } from "vitest";
import { getDb, one, resetDb } from "@/server/db";
import { fitsSingleSmsPart } from "@/server/sms";
import { resendVoucherSms, sendVoucherConfirmationSms } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

describe("SMS confirmation", () => {
  beforeEach(async () => {
    await resetDb();
    delete process.env.SMS_PROVIDER;
  });

  async function issueVoucher(phone: string) {
    return huntAndSelect({ campaignSlug: "july-dinner", phone, sessionId: `sms-session-${phone}`, name: "SMS Test User", guestCount: 2 });
  }

  it("sends the confirmation SMS via the mock provider and logs it", async () => {
    const { voucher } = await issueVoucher("+639170009991");
    const result = await sendVoucherConfirmationSms(voucher.id);
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^mock_/);

    const db = await getDb();
    const row = (await one(db, "SELECT * FROM sms_logs WHERE voucher_id = ?", [voucher.id])) as {
      status: string;
      provider: string;
      to_number: string;
      body: string;
      provider_message_id: string | null;
    };
    expect(row.status).toBe("sent");
    expect(row.provider).toBe("mock");
    expect(row.to_number).toBe("+639170009991");
    expect(row.body).toContain(voucher.voucherCode);
    expect(row.provider_message_id).toMatch(/^mock_/);
    // Credit guard: a standard confirmation must stay within one SMS part.
    expect(fitsSingleSmsPart(row.body)).toBe(true);
  });

  it("records an sms_sent analytics event only on success", async () => {
    const { voucher, campaign } = await issueVoucher("+639170009992");
    await sendVoucherConfirmationSms(voucher.id);

    const db = await getDb();
    const row = await one(db, "SELECT COUNT(*) AS c FROM analytics_events WHERE campaign_id = ? AND event_name = 'sms_sent'", [
      campaign.id
    ]);
    expect(Number(row.c)).toBe(1);
  });

  it("resendVoucherSms sends again and adds a second sms_logs row", async () => {
    const { voucher } = await issueVoucher("+639170009993");
    await sendVoucherConfirmationSms(voucher.id);

    const resent = await resendVoucherSms({ codeOrToken: voucher.voucherCode });
    expect(resent.success).toBe(true);
    expect(resent.voucherCode).toBe(voucher.voucherCode);
    expect(resent.to).toBe("+639170009993");

    const db = await getDb();
    const row = await one(db, "SELECT COUNT(*) AS c FROM sms_logs WHERE voucher_id = ?", [voucher.id]);
    expect(Number(row.c)).toBe(2);
  });

  it("logs a failed attempt without throwing when the provider is misconfigured", async () => {
    const { voucher } = await issueVoucher("+639170009994");
    process.env.SMS_PROVIDER = "movider"; // no SMS_API_KEY/SECRET configured

    const result = await sendVoucherConfirmationSms(voucher.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");

    const db = await getDb();
    const row = (await one(db, "SELECT * FROM sms_logs WHERE voucher_id = ?", [voucher.id])) as {
      status: string;
      failure_reason: string | null;
    };
    expect(row.status).toBe("failed");
    expect(row.failure_reason).toContain("not configured");
  });
});
