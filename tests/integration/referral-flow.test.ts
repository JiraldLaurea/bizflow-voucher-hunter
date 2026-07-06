import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resetDb } from "@/server/db";
import { generateCandidate, recordReferralOpen, startHunt } from "@/server/voucher-engine";
import { GET as visitReferral } from "@/app/api/public/referral/visit/route";

const bonusDraw = (phone: string) =>
  generateCandidate({
    campaignSlug: "july-dinner",
    slotId: "slot_dinner_0705_1900",
    phone,
    sessionId: "referrer-session",
    sourceType: "referral_bonus"
  });

describe("referral share module", () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function startReferrer() {
    const state = await startHunt({
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: "+639181234561",
      sessionId: "referrer-session",
      name: "Referrer",
      email: "referrer@example.com"
    });
    return state.user;
  }

  it("grants 1 extra attempt for a valid, distinct-visitor referral open", async () => {
    const referrer = await startReferrer();

    const result = await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-1"
    });
    expect(result.granted).toBe(true);

    const bonusAttempt = await bonusDraw(referrer.phone);
    expect(bonusAttempt.sourceType).toBe("referral_bonus");

    // The single earned attempt is now spent; a second bonus draw should fail.
    await expect(bonusDraw(referrer.phone)).rejects.toThrowError(/No extra attempts earned/);
  });

  it("records a referral through the mobile-safe redirect before loading the campaign", async () => {
    const referrer = await startReferrer();
    const request = new NextRequest(
      `http://localhost/api/public/referral/visit?campaign=july-dinner&ref=${referrer.id}`,
      { headers: { cookie: "bizflow_visitor_session=visitor-phone-session" } },
    );

    const response = await visitReferral(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/campaign/july-dinner",
    );
    expect((await bonusDraw(referrer.phone)).sourceType).toBe("referral_bonus");
  });

  it("rejects a self-referral (visitor session equals referrer session)", async () => {
    const referrer = await startReferrer();

    const result = await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "referrer-session"
    });
    expect(result.granted).toBe(false);
    expect(result.reason).toBe("self_referral");

    await expect(bonusDraw(referrer.phone)).rejects.toThrowError(/No extra attempts earned/);
  });

  it("does not grant a second reward for the same visitor session (idempotent)", async () => {
    const referrer = await startReferrer();

    const first = await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-1"
    });
    expect(first.granted).toBe(true);

    const second = await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-1"
    });
    expect(second.granted).toBe(true);

    // Only 1 attempt should be redeemable, not 2.
    await bonusDraw(referrer.phone);
    await expect(bonusDraw(referrer.phone)).rejects.toThrowError(/No extra attempts earned/);
  });

  it("stops granting once the daily referral limit (5) is reached", async () => {
    const referrer = await startReferrer();

    for (let i = 0; i < 5; i += 1) {
      const result = await recordReferralOpen({
        campaignSlug: "july-dinner",
        ref: referrer.id,
        visitorSessionId: `visitor-session-${i}`
      });
      expect(result.granted).toBe(true);
    }

    const sixth = await recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-6"
    });
    expect(sixth.granted).toBe(false);
    expect(sixth.reason).toBe("daily_limit_reached");

    // Exactly 5 bonus attempts should be redeemable.
    for (let i = 0; i < 5; i += 1) {
      const attempt = await bonusDraw(referrer.phone);
      expect(attempt.sourceType).toBe("referral_bonus");
    }
    await expect(bonusDraw(referrer.phone)).rejects.toThrowError(/No extra attempts earned/);
  });

  it("rejects an invalid referral code", async () => {
    await expect(
      recordReferralOpen({
        campaignSlug: "july-dinner",
        ref: "usr_does_not_exist",
        visitorSessionId: "visitor-session-1"
      })
    ).rejects.toThrowError(/Referral link is invalid/);
  });
});
