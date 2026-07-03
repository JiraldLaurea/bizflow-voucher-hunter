import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "@/server/sms";

const ENV_KEYS = ["SMS_PROVIDER", "SMS_API_KEY", "SMS_API_SECRET", "SMS_SENDER_ID", "INFOBIP_BASE_URL"] as const;
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
