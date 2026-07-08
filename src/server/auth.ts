import { AppError } from "@/server/errors";
import {
  sessionTokenFromRequest,
  verifyAdminSession,
} from "@/lib/admin-session";

/** Guards admin endpoints using the signed login cookie or a server-only token. */
export async function requireAdmin(request: Request) {
  const session = await verifyAdminSession(sessionTokenFromRequest(request));
  if (session) return session;

  // Optional server-only token support for trusted scripts and integrations.
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  const bearer = request.headers.get("authorization");
  const headerToken = request.headers.get("x-admin-token");
  const provided = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : headerToken?.trim();
  if (!expected || !provided || provided !== expected) {
    throw new AppError("E-ADMIN-UNAUTHORIZED", "Admin authorization is required", 401);
  }
  return { email: "integration", name: "API Admin", role: "super_admin" as const, businessIds: ["*"], exp: 0 };
}

export function assertBusinessAccess(
  session: Awaited<ReturnType<typeof requireAdmin>>,
  businessId: string,
) {
  if (session.role === "super_admin" || session.businessIds.includes("*") || session.businessIds.includes(businessId)) {
    return;
  }
  throw new AppError("E-STAFF-BUSINESS-SCOPE", "You are not allowed to perform rewards actions for this business", 403);
}

export function assertRewardsAdmin(session: Awaited<ReturnType<typeof requireAdmin>>) {
  if (session.role === "super_admin" || session.role === "admin") return;
  throw new AppError("E-REWARDS-ADMIN-SCOPE", "Rewards review and settlement actions require admin access", 403);
}
