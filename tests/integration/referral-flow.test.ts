import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resetDb } from "@/server/db";
import {
  generateCandidate,
  getReferralSnapshot,
  recordReferralOpen,
  startHunt,
} from "@/server/voucher-engine";
import { GET as visitReferral } from "@/app/api/public/referral/visit/route";
import {
  GET as claimReferral,
  POST as claimReferralFallback,
} from "@/app/api/public/referral/claim/route";
import { POST as deprecatedOpenReferral } from "@/app/api/public/referral/open/route";

const bonusDraw = (phone: string) =>
  generateCandidate({
    campaignSlug: "july-dinner",
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

  it("ignores preview fetches and records only the browser handoff", async () => {
    const referrer = await startReferrer();
    const request = new NextRequest(
      `http://localhost/api/public/referral/visit?campaign=july-dinner&ref=${referrer.id}`,
      { headers: { cookie: "bizflow_visitor_session=visitor-phone-session" } },
    );

    const previewResponse = await visitReferral(request);

    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.text()).toContain(
      "/api/public/referral/claim",
    );
    expect(
      await getReferralSnapshot({
        campaignSlug: "july-dinner",
        ref: referrer.id,
      }),
    ).toMatchObject({
      sharesGrantedToday: 0,
      remainingBonusAttempts: 0,
    });

    const claimResponse = await claimReferral(
      new NextRequest(
        `http://localhost/api/public/referral/claim?campaign=july-dinner&ref=${referrer.id}`,
        { headers: { cookie: "bizflow_visitor_session=visitor-phone-session" } },
      ),
    );
    expect(claimResponse.status).toBe(307);
    expect(claimResponse.headers.get("location")).toBe(
      "/campaign/july-dinner",
    );
    expect(
      await getReferralSnapshot({
        campaignSlug: "july-dinner",
        ref: referrer.id,
      }),
    ).toMatchObject({
      sharesGrantedToday: 1,
      remainingBonusAttempts: 1,
    });
    expect((await bonusDraw(referrer.phone)).sourceType).toBe("referral_bonus");
  });

  it("keeps the browser handoff on the public origin behind a reverse proxy", async () => {
    const referrer = await startReferrer();
    const response = await visitReferral(
      new NextRequest(
        `http://localhost:3000/api/public/referral/visit?campaign=july-dinner&ref=${referrer.id}`,
        {
          headers: {
            "x-forwarded-host": "voucher-hunt.ngrok-free.app",
            "x-forwarded-proto": "https",
          },
        },
      ),
    );
    const html = await response.text();
    expect(html).toContain(
      `/api/public/referral/claim?campaign=july-dinner&ref=${referrer.id}`,
    );
    expect(html).not.toContain("localhost:3000/api/public/referral/claim");
  });

  it("grants through the campaign-page fallback when the redirect handoff fails", async () => {
    const referrer = await startReferrer();
    const response = await claimReferralFallback(
      new NextRequest("https://voucher-hunt.ngrok-free.app/api/public/referral/claim", {
        method: "POST",
        headers: {
          cookie: "bizflow_visitor_session=visitor-fallback-session",
          "content-type": "application/json",
        },
        body: JSON.stringify({ campaign: "july-dinner", ref: referrer.id }),
      }),
    );
    expect(response.status).toBe(200);
    expect(
      await getReferralSnapshot({
        campaignSlug: "july-dinner",
        ref: referrer.id,
      }),
    ).toMatchObject({
      sharesGrantedToday: 1,
      remainingBonusAttempts: 1,
    });
  });

  it("does not grant from the deprecated page-load open endpoint", async () => {
    const referrer = await startReferrer();

    const response = await deprecatedOpenReferral(
      new Request("http://localhost/api/public/referral/open", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: "july-dinner",
          ref: referrer.id,
          sessionId: "visitor-session-legacy",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(
      await getReferralSnapshot({
        campaignSlug: "july-dinner",
        ref: referrer.id,
      }),
    ).toMatchObject({
      sharesGrantedToday: 0,
      remainingBonusAttempts: 0,
    });
    await expect(bonusDraw(referrer.phone)).rejects.toThrowError(
      /No extra attempts earned/,
    );
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
