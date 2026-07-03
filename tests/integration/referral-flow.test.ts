import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/server/db";
import { generateCandidate, recordReferralOpen, startHunt } from "@/server/voucher-engine";

describe("referral share module", () => {
  beforeEach(() => {
    resetDb();
  });

  function startReferrer() {
    const state = startHunt({
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: "+639181234561",
      sessionId: "referrer-session",
      name: "Referrer",
      email: "referrer@example.com"
    });
    return state.user;
  }

  it("grants 1 extra attempt for a valid, distinct-visitor referral open", () => {
    const referrer = startReferrer();

    const result = recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-1"
    });
    expect(result.granted).toBe(true);

    const bonusAttempt = generateCandidate({
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: referrer.phone,
      sessionId: "referrer-session",
      sourceType: "referral_bonus"
    });
    expect(bonusAttempt.sourceType).toBe("referral_bonus");

    // The single earned attempt is now spent; a second bonus draw should fail.
    expect(() =>
      generateCandidate({
        campaignSlug: "july-dinner",
        slotId: "slot_dinner_0705_1900",
        phone: referrer.phone,
        sessionId: "referrer-session",
        sourceType: "referral_bonus"
      })
    ).toThrowError(/No extra attempts earned/);
  });

  it("rejects a self-referral (visitor session equals referrer session)", () => {
    const referrer = startReferrer();

    const result = recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "referrer-session"
    });
    expect(result.granted).toBe(false);
    expect(result.reason).toBe("self_referral");

    expect(() =>
      generateCandidate({
        campaignSlug: "july-dinner",
        slotId: "slot_dinner_0705_1900",
        phone: referrer.phone,
        sessionId: "referrer-session",
        sourceType: "referral_bonus"
      })
    ).toThrowError(/No extra attempts earned/);
  });

  it("does not grant a second reward for the same visitor session (idempotent)", () => {
    const referrer = startReferrer();

    const first = recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-1"
    });
    expect(first.granted).toBe(true);

    const second = recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-1"
    });
    expect(second.granted).toBe(true);

    // Only 1 attempt should be redeemable, not 2.
    generateCandidate({
      campaignSlug: "july-dinner",
      slotId: "slot_dinner_0705_1900",
      phone: referrer.phone,
      sessionId: "referrer-session",
      sourceType: "referral_bonus"
    });
    expect(() =>
      generateCandidate({
        campaignSlug: "july-dinner",
        slotId: "slot_dinner_0705_1900",
        phone: referrer.phone,
        sessionId: "referrer-session",
        sourceType: "referral_bonus"
      })
    ).toThrowError(/No extra attempts earned/);
  });

  it("stops granting once the daily referral limit (5) is reached", () => {
    const referrer = startReferrer();

    for (let i = 0; i < 5; i += 1) {
      const result = recordReferralOpen({
        campaignSlug: "july-dinner",
        ref: referrer.id,
        visitorSessionId: `visitor-session-${i}`
      });
      expect(result.granted).toBe(true);
    }

    const sixth = recordReferralOpen({
      campaignSlug: "july-dinner",
      ref: referrer.id,
      visitorSessionId: "visitor-session-6"
    });
    expect(sixth.granted).toBe(false);
    expect(sixth.reason).toBe("daily_limit_reached");

    // Exactly 5 bonus attempts should be redeemable.
    for (let i = 0; i < 5; i += 1) {
      const attempt = generateCandidate({
        campaignSlug: "july-dinner",
        slotId: "slot_dinner_0705_1900",
        phone: referrer.phone,
        sessionId: "referrer-session",
        sourceType: "referral_bonus"
      });
      expect(attempt.sourceType).toBe("referral_bonus");
    }
    expect(() =>
      generateCandidate({
        campaignSlug: "july-dinner",
        slotId: "slot_dinner_0705_1900",
        phone: referrer.phone,
        sessionId: "referrer-session",
        sourceType: "referral_bonus"
      })
    ).toThrowError(/No extra attempts earned/);
  });

  it("rejects an invalid referral code", () => {
    expect(() =>
      recordReferralOpen({
        campaignSlug: "july-dinner",
        ref: "usr_does_not_exist",
        visitorSessionId: "visitor-session-1"
      })
    ).toThrowError(/Referral link is invalid/);
  });
});
