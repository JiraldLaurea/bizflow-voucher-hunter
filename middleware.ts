import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "./src/lib/admin-session";

export async function middleware(request: NextRequest) {
  const session = await verifyAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
  const bearer = request.headers.get("authorization");
  const headerToken = request.headers.get("x-admin-token");
  const providedToken = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : headerToken?.trim();
  const integrationAuthorized = Boolean(
    process.env.ADMIN_ACCESS_TOKEN &&
      providedToken === process.env.ADMIN_ACCESS_TOKEN,
  );

  if (session || integrationAuthorized) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "E-ADMIN-UNAUTHORIZED",
          message: "Admin authorization is required",
        },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/staff/:path*",
    "/api/businesses/:path*",
    "/api/campaigns/:path*",
    "/api/slots/:path*",
    "/api/dashboard/:path*",
    "/api/staff/:path*",
    "/api/export/:path*",
  ],
};
