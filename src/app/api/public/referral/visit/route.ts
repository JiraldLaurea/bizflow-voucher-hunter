import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VISITOR_COOKIE = "bizflow_visitor_session";
const schema = z.object({
  campaign: z.string().min(1),
  ref: z.string().min(1),
});

function relativeRedirect(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      location: path,
      "cache-control": "private, no-cache, no-store, max-age=0",
    },
  });
}

/**
 * Returns a JavaScript handoff instead of granting immediately. Messaging and
 * social preview crawlers fetch this URL but do not execute the handoff, so
 * only a real browser visit proceeds to the claim endpoint.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    campaign: url.searchParams.get("campaign"),
    ref: url.searchParams.get("ref"),
  });
  if (!parsed.success) return relativeRedirect("/");

  const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? "";
  const visitorSessionId = existingVisitorId || crypto.randomUUID();
  // Keep the browser handoff relative. Reverse proxies such as ngrok can expose
  // an HTTPS public host while Next.js sees the upstream as localhost:3000;
  // constructing an absolute URL from request.url would send the visitor to
  // that unreachable internal address.
  const claimQuery = new URLSearchParams({
    campaign: parsed.data.campaign,
    ref: parsed.data.ref,
  });
  const claimPath = `/api/public/referral/claim?${claimQuery.toString()}`;

  const response = new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Opening Voucher Hunt…</title>
  </head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6ff;color:#0b1d3a;font-family:Arial,sans-serif">
    <main style="text-align:center;padding:24px">
      <div style="width:48px;height:48px;margin:0 auto 16px;border:4px solid #ded7ff;border-top-color:#633cff;border-radius:50%;animation:spin .8s linear infinite"></div>
      <strong>Opening your voucher hunt…</strong>
      <p style="color:#68738c">Confirming your visit securely.</p>
    </main>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    <script>window.location.replace(${JSON.stringify(claimPath)});</script>
  </body>
</html>`,
    {
      headers: {
        "cache-control": "private, no-cache, no-store, max-age=0",
        "content-type": "text/html; charset=utf-8",
      },
    },
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
