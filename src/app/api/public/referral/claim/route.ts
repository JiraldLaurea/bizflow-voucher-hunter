import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/server/rate-limit";
import { AppError, fail, ok } from "@/server/errors";
import { recordReferralOpen } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VISITOR_COOKIE = "bizflow_visitor_session";
const schema = z.object({
  campaign: z.string().min(1),
  ref: z.string().min(1),
});

function campaignPath(campaign: string, ref?: string) {
  const query = ref
    ? `?${new URLSearchParams({ ref }).toString()}`
    : "";
  return `/campaign/${encodeURIComponent(campaign)}${query}`;
}

function relativeRedirect(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      location: path,
      "cache-control": "private, no-cache, no-store, max-age=0",
    },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    campaign: url.searchParams.get("campaign"),
    ref: url.searchParams.get("ref"),
  });
  if (!parsed.success) return relativeRedirect("/");

  const visitorSessionId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!visitorSessionId) {
    return relativeRedirect(campaignPath(parsed.data.campaign, parsed.data.ref));
  }

  let recorded = false;
  try {
    await enforceRateLimit(request, "referral/claim", {
      limit: 15,
      windowMs: 60_000,
    });
    await recordReferralOpen({
      campaignSlug: parsed.data.campaign,
      ref: parsed.data.ref,
      visitorSessionId,
    });
    recorded = true;
  } catch {
    // The landing-page fallback will retry transient failures.
  }

  return relativeRedirect(
    campaignPath(parsed.data.campaign, recorded ? undefined : parsed.data.ref),
  );
}

/**
 * Client-side fallback for reverse-proxy/cookie handoff failures. It only runs
 * from the real campaign page, so social preview crawlers still cannot grant a
 * referral merely by fetching the shared URL.
 */
export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const visitorSessionId = request.cookies.get(VISITOR_COOKIE)?.value;
    if (!visitorSessionId) {
      throw new AppError(
        "E-REFERRAL-SESSION",
        "Visitor session is not ready",
        409,
      );
    }
    await enforceRateLimit(request, "referral/claim", {
      limit: 15,
      windowMs: 60_000,
    });
    return ok(
      await recordReferralOpen({
        campaignSlug: input.campaign,
        ref: input.ref,
        visitorSessionId,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
