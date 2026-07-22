import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { requestSignInOtp, verifySignInOtp } from "@/server/otp";

// Sign-in OTP proves phone ownership at sign-in, campaign-agnostically. In
// non-production the code is returned so the flow can complete without live SMS.
describe("sign-in OTP", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const phone = "+639171234567";

  it("verifies a phone with the code it was sent", async () => {
    const requested = await requestSignInOtp({ phone });
    expect(requested.sent).toBe(true);
    expect(requested.devCode).toMatch(/^\d{6}$/);

    const verified = await verifySignInOtp({ phone, code: requested.devCode! });
    expect(verified.phone).toBe(phone);
  });

  it("rejects an incorrect code", async () => {
    const requested = await requestSignInOtp({ phone });
    const wrong = requested.devCode === "000000" ? "111111" : "000000";
    await expect(verifySignInOtp({ phone, code: wrong })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("rejects verifying a number that never requested a code", async () => {
    await expect(
      verifySignInOtp({ phone: "+639998887777", code: "123456" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("consumes the code so it cannot be replayed", async () => {
    const requested = await requestSignInOtp({ phone });
    await verifySignInOtp({ phone, code: requested.devCode! });
    await expect(
      verifySignInOtp({ phone, code: requested.devCode! }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
