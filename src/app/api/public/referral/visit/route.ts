import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/server/rate-limit";
import { recordReferralOpen } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VISITOR_COOKIE = "bizflow_visitor_session";
const schema = z.object({
  campaign: z.string().min(1),
  ref: z.string().min(1),
});

function redirectToCampaign(
  request: Request,
  campaign: string,
  ref?: string,
) {
  const destination = new URL(
    `/campaign/${encodeURIComponent(campaign)}`,
    request.url,
  );
  if (ref) destination.searchParams.set("ref", ref);
  return NextResponse.redirect(destination);
}

/**
 * Referral links enter through this redirect so the reward is recorded before
 * an in-app mobile browser can suspend JavaScript or leave the landing page.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    campaign: url.searchParams.get("campaign"),
    ref: url.searchParams.get("ref"),
  });
  if (!parsed.success) return NextResponse.redirect(new URL("/", request.url));

  const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? "";
  const visitorSessionId = existingVisitorId || crypto.randomUUID();

  let recorded = false;
  try {
    await enforceRateLimit(request, "referral/visit", {
      limit: 30,
      windowMs: 60_000,
    });
    await recordReferralOpen({
      campaignSlug: parsed.data.campaign,
      ref: parsed.data.ref,
      visitorSessionId,
    });
    recorded = true;
  } catch {
    // Keep the referral parameters on failure so the landing-page retry can
    // recover from a transient database/network problem.
  }

  const response = redirectToCampaign(
    request,
    parsed.data.campaign,
    recorded ? undefined : parsed.data.ref,
  );
  if (!existingVisitorId) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: visitorSessionId,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: url.protocol === "https:",
    });
  }
  return response;
}
