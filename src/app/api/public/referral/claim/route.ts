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

function campaignUrl(request: Request, campaign: string, ref?: string) {
  const destination = new URL(
    `/campaign/${encodeURIComponent(campaign)}`,
    request.url,
  );
  if (ref) destination.searchParams.set("ref", ref);
  return destination;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    campaign: url.searchParams.get("campaign"),
    ref: url.searchParams.get("ref"),
  });
  if (!parsed.success) return NextResponse.redirect(new URL("/", request.url));

  const visitorSessionId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!visitorSessionId) {
    return NextResponse.redirect(
      campaignUrl(request, parsed.data.campaign, parsed.data.ref),
    );
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

  return NextResponse.redirect(
    campaignUrl(
      request,
      parsed.data.campaign,
      recorded ? undefined : parsed.data.ref,
    ),
  );
}
