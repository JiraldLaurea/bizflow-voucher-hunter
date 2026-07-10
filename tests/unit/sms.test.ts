import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSmppMessageParts, fitsSingleSmsPart, sendSms } from "@/server/sms";

const ENV_KEYS = [
  "SMS_PROVIDER",
  "SMS_API_KEY",
  "SMS_API_SECRET",
  "SMS_SENDER_ID",
  "INFOBIP_BASE_URL",
  "SMPP_HOST",
  "SMPP_SYSTEM_ID",
  "SMPP_PASSWORD"
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe("sendSms", () => {
  it("mock provider always succeeds and logs to console", async () => {
    delete process.env.SMS_PROVIDER;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await sendSms("+639171234567", "hello");
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^mock_/);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[SMS MOCK] To: +639171234567"));
    logSpy.mockRestore();
  });

  it("movider: returns success with the provider message id", async () => {
    process.env.SMS_PROVIDER = "movider";
    process.env.SMS_API_KEY = "key";
    process.env.SMS_API_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ phone_number_list: [{ message_id: "abc123" }] })
      })
    );
    const result = await sendSms("+639171234567", "hello");
    expect(result).toEqual({ success: true, providerMessageId: "abc123" });
  });

  it("movider: surfaces a top-level error array as a failure", async () => {
    process.env.SMS_PROVIDER = "movider";
    process.env.SMS_API_KEY = "key";
    process.env.SMS_API_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ error: [{ code: 401, message: "Invalid credentials" }] })
      })
    );
    const result = await sendSms("+639171234567", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid credentials");
  });

  it("movider: fails fast when credentials are not configured", async () => {
    process.env.SMS_PROVIDER = "movider";
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_API_SECRET;
    const result = await sendSms("+639171234567", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("twilio: returns success with the message sid", async () => {
    process.env.SMS_PROVIDER = "twilio";
    process.env.SMS_API_KEY = "AC_sid";
    process.env.SMS_API_SECRET = "token";
    process.env.SMS_SENDER_ID = "+15550001111";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: "SMxyz" })
      })
    );
    const result = await sendSms("+639171234567", "hello");
    expect(result).toEqual({ success: true, providerMessageId: "SMxyz" });
  });

  it("infobip: rejected status maps to a failure with the rejection reason", async () => {
    process.env.SMS_PROVIDER = "infobip";
    process.env.SMS_API_KEY = "key";
    process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ messageId: "msg1", status: { groupName: "REJECTED", description: "blocked" } }]
        })
      })
    );
    const result = await sendSms("+639171234567", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toBe("blocked");
  });

  it("smpp: fails fast when credentials are not configured", async () => {
    process.env.SMS_PROVIDER = "smpp";
    delete process.env.SMPP_HOST;
    delete process.env.SMPP_SYSTEM_ID;
    delete process.env.SMPP_PASSWORD;
    const result = await sendSms("+639171234567", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("clicksend: SUCCESS status maps to a success result", async () => {
    process.env.SMS_PROVIDER = "clicksend";
    process.env.SMS_API_KEY = "username";
    process.env.SMS_API_SECRET = "apikey";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { messages: [{ message_id: "cs1", status: "SUCCESS" }] } })
      })
    );
    const result = await sendSms("+639171234567", "hello");
    expect(result).toEqual({ success: true, providerMessageId: "cs1" });
  });
});

describe("fitsSingleSmsPart", () => {
  it("treats a short OTP-style message as a single part", () => {
    expect(fitsSingleSmsPart("Your verification code is 123456. It expires in 5 minutes.")).toBe(true);
  });

  it("treats a full voucher confirmation body as multi-part", () => {
    // The exact class of message that overflowed a single short_message (>254 octets).
    const body =
      "[Mesa Manila Test Kitchen] Your voucher is confirmed. Code: BIZ-F499E9. Benefit: 20% OFF. " +
      "Date/Time: 2026-07-05 14:00-16:00. Show this SMS at the restaurant. Valid until 2026-08-02. " +
      "Terms: Valid for selected slot only. Minimum spend applies. One final voucher per phone number. Name: SMS Test User.";
    expect(body.length).toBeGreaterThan(160);
    expect(fitsSingleSmsPart(body)).toBe(false);
  });

  it("uses the 160-septet GSM boundary", () => {
    expect(fitsSingleSmsPart("a".repeat(160))).toBe(true);
    expect(fitsSingleSmsPart("a".repeat(161))).toBe(false);
  });

  it("uses the 70-character UCS-2 boundary for non-GSM text", () => {
    // "中" is outside the GSM alphabet, forcing UCS-2 (70-char single part).
    expect(fitsSingleSmsPart("中".repeat(70))).toBe(true);
    expect(fitsSingleSmsPart("中".repeat(71))).toBe(false);
  });
});

describe("buildSmppMessageParts", () => {
  it("returns a single inline short_message for a short body", () => {
    const parts = buildSmppMessageParts("Your code is 123456.");
    expect(parts).toEqual([{ short_message: "Your code is 123456." }]);
  });

  it("splits a long GSM body into UDH-concatenated GSM parts (153/part)", () => {
    const body = "a".repeat(200); // 200 GSM chars > 160 -> multi-part
    const parts = buildSmppMessageParts(body);
    expect(parts.length).toBe(Math.ceil(200 / 153)); // 2 parts, not 3

    const ref = (parts[0].short_message as { udh: Buffer }).udh[3];
    parts.forEach((part, i) => {
      expect(part.esm_class).toBe(0x40); // UDH indicator
      expect(part.data_coding).toBe(0); // GSM
      const { udh } = part.short_message as { udh: Buffer };
      expect([...udh.subarray(0, 3)]).toEqual([0x05, 0x00, 0x03]); // concat IE header
      expect(udh[3]).toBe(ref); // same reference across all parts
      expect(udh[4]).toBe(parts.length); // total
      expect(udh[5]).toBe(i + 1); // 1-based sequence
    });
  });

  it("splits a long non-GSM body into UCS-2 parts (67/part)", () => {
    const body = "中".repeat(100); // non-GSM -> UCS-2, 100 > 70 -> multi-part
    const parts = buildSmppMessageParts(body);
    expect(parts.length).toBe(Math.ceil(100 / 67)); // 2 parts
    parts.forEach((part) => expect(part.data_coding).toBe(8));
  });

  it("reassembles losslessly across parts", () => {
    const body = "Voucher BIZ-ABC123 20% OFF valid until 2026-08-02. " + "x".repeat(120);
    const rebuilt = buildSmppMessageParts(body)
      .map((p) => (p.short_message as { message: string }).message)
      .join("");
    expect(rebuilt).toBe(body);
  });
});
