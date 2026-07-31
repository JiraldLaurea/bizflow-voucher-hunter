import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb, run } from "@/server/db";
import { requestSignInOtp } from "@/server/otp";
import { isDevLiveSmsEnabled, setDevLiveSmsEnabled } from "@/server/runtime-settings";
import { resolveSmsProvider } from "@/server/sms";

// The dashboard switch decides whether a development server sends real SMS or
// falls back to the mock. Production must never be gated by it, and the demo
// code must never be echoed back once a real message has gone out.
describe("live SMS setting", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProvider = process.env.SMS_PROVIDER;

  function setNodeEnv(value: string) {
    vi.stubEnv("NODE_ENV", value);
  }

  beforeEach(async () => {
    await resetDb();
    // resetDb keeps `meta` (it holds the auth epoch), and integration files run
    // in parallel against one SQLite file, so the flag has to be cleared here
    // rather than assumed absent.
    await clearFlag();
    process.env.SMS_PROVIDER = "movider";
  });

  async function clearFlag() {
    const db = await getDb();
    await run(db, "DELETE FROM meta WHERE key = ?", ["dev_live_sms"]);
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.SMS_PROVIDER = originalProvider;
    if (originalNodeEnv !== undefined) vi.stubEnv("NODE_ENV", originalNodeEnv);
    vi.unstubAllEnvs();
  });

  it("defaults to off when never set, so a fresh install cannot send by accident", async () => {
    expect(await isDevLiveSmsEnabled()).toBe(false);
  });

  it("falls back to the mock on a development server while off", async () => {
    setNodeEnv("development");
    expect(await resolveSmsProvider()).toBe("mock");
  });

  it("uses the configured provider on a development server once on", async () => {
    setNodeEnv("development");
    await setDevLiveSmsEnabled(true);
    expect(await resolveSmsProvider()).toBe("movider");
  });

  it("never gates production, whatever the switch says", async () => {
    setNodeEnv("production");
    await setDevLiveSmsEnabled(false);
    expect(await resolveSmsProvider()).toBe("movider");
  });

  it("returns the demo code while the mock is in use", async () => {
    setNodeEnv("development");
    const requested = await requestSignInOtp({ phone: "+639171234567" });
    expect(requested.devCode).toMatch(/^\d{6}$/);
  });

  it("withholds the demo code once real sending is on", async () => {
    setNodeEnv("development");
    await setDevLiveSmsEnabled(true);
    // Fail the send: the point is that the code is withheld because a real
    // provider was selected, not because the message happened to succeed.
    process.env.SMS_PROVIDER = "movider";
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_API_SECRET;

    const requested = await requestSignInOtp({ phone: "+639171234567" });
    expect(requested.devCode).toBeUndefined();
  });
});
