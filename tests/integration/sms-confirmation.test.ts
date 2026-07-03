import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDb } from "@/server/db";
import {
  generateCandidate,
  resendVoucherSms,
  selectFinalVoucher,
  sendVoucherConfirmationSms,
  startHunt
} from "@/server/voucher-engine";

describe("SMS confirmation", () => {
  beforeEach(() => {
    resetDb();
    delete process.env.SMS_PROVIDER;
  });

  function issueVoucher(phone: string) {
    const input = {
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone,
      sessionId: `sms-session-${phone}`,
      name: "SMS Test User"
    };
    startHunt(input);
    const candidate = generateCandidate(input);
    return selectFinalVoucher({ ...input, attemptId: candidate.id, guestCount: 2 });
  }

  it("sends the confirmation SMS via the mock provider and logs it", async () => {
    const { voucher } = issueVoucher("+639170009991");
    const result = await sendVoucherConfirmationSms(voucher.id);
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^mock_/);

    const db = getDb();
    const row = db.prepare("SELECT * FROM sms_logs WHERE voucher_id = ?").get(voucher.id) as {
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
  });

  it("records an sms_sent analytics event only on success", async () => {
    const { voucher, campaign } = issueVoucher("+639170009992");
    await sendVoucherConfirmationSms(voucher.id);

    const db = getDb();
    const count = (
      db
        .prepare("SELECT COUNT(*) AS c FROM analytics_events WHERE campaign_id = ? AND event_name = 'sms_sent'")
        .get(campaign.id) as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("resendVoucherSms sends again and adds a second sms_logs row", async () => {
    const { voucher } = issueVoucher("+639170009993");
    await sendVoucherConfirmationSms(voucher.id);

    const resent = await resendVoucherSms({ codeOrToken: voucher.voucherCode });
    expect(resent.success).toBe(true);
    expect(resent.voucherCode).toBe(voucher.voucherCode);
    expect(resent.to).toBe("+639170009993");

    const db = getDb();
    const count = (
      db.prepare("SELECT COUNT(*) AS c FROM sms_logs WHERE voucher_id = ?").get(voucher.id) as { c: number }
    ).c;
    expect(count).toBe(2);
  });

  it("logs a failed attempt without throwing when the provider is misconfigured", async () => {
    const { voucher } = issueVoucher("+639170009994");
    process.env.SMS_PROVIDER = "movider"; // no SMS_API_KEY/SECRET configured

    const result = await sendVoucherConfirmationSms(voucher.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");

    const db = getDb();
    const row = db.prepare("SELECT * FROM sms_logs WHERE voucher_id = ?").get(voucher.id) as {
      status: string;
      failure_reason: string | null;
    };
    expect(row.status).toBe("failed");
    expect(row.failure_reason).toContain("not configured");
  });
});
