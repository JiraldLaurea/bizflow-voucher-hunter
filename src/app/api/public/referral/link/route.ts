import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { AppError, fail, ok } from "@/server/errors";
import { getOrCreateReferralIdentity } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignSlug: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(8).optional(),
});

const VISITOR_COOKIE = "bizflow_visitor_session";

export async function POST(request: NextRequest) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    const input = schema.parse(await request.json().catch(() => ({})));
    const usesBearerToken = /^Bearer\s+\S+/i.test(
      request.headers.get("authorization") ?? "",
    );
    const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? "";
    const sessionId = usesBearerToken
      ? input.sessionId
      : existingVisitorId || crypto.randomUUID();
    if (!sessionId) {
      throw new AppError(
        "E-REFERRAL-SESSION",
        "A device session is required to create a referral link",
        400,
      );
    }
    const response = ok(
      await getOrCreateReferralIdentity({
        campaignSlug: input.campaignSlug,
        phone,
        sessionId,
      }),
    );
    if (!usesBearerToken && !existingVisitorId) {
      response.cookies.set({
        name: VISITOR_COOKIE,
        value: sessionId,
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
      });
    }
    return response;
  } catch (error) {
    return fail(error);
  }
}
