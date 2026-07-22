import { AppError } from "@/server/errors";
import type { Campaign } from "@/types/voucher";
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
  if (
    session.role === "super_admin" ||
    (session.role === "admin" && session.businessIds.includes("*")) ||
    session.businessIds.includes(businessId)
  ) {
    return;
  }
  throw new AppError("E-STAFF-BUSINESS-SCOPE", "You are not allowed to access this business", 403);
}

export function assertRewardsAdmin(session: Awaited<ReturnType<typeof requireAdmin>>) {
  if (session.role === "super_admin" || session.role === "admin") return;
  throw new AppError("E-REWARDS-ADMIN-SCOPE", "Rewards review and settlement actions require admin access", 403);
}

export function assertAdminRole(session: Awaited<ReturnType<typeof requireAdmin>>) {
  if (session.role === "super_admin" || session.role === "admin") return;
  throw new AppError("E-ADMIN-ROLE", "This action requires admin access", 403);
}

export function assertSuperAdmin(session: Awaited<ReturnType<typeof requireAdmin>>) {
  if (session.role === "super_admin") return;
  throw new AppError("E-SUPER-ADMIN-ROLE", "This action requires super-admin access", 403);
}

export function filterCampaignsForSession<T extends Pick<Campaign, "businessId">>(session: { role: "super_admin" | "admin" | "staff"; businessIds: string[] }, campaigns: T[]) {
  return session.role === "staff"
    ? campaigns.filter((campaign) => session.businessIds.includes(campaign.businessId))
    : campaigns;
}
