import { AppError } from "@/server/errors";

/**
 * Guards admin-only endpoints. Requires the caller to present the shared admin
 * token via either `Authorization: Bearer <token>` or `x-admin-token: <token>`.
 * The expected token is read from ADMIN_ACCESS_TOKEN.
 */
export function requireAdmin(request: Request) {
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  if (!expected) {
    throw new AppError("E-ADMIN-CONFIG", "Admin token is not configured on the server", 500);
  }
  const bearer = request.headers.get("authorization");
  const headerToken = request.headers.get("x-admin-token");
  const provided = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : headerToken?.trim();
  if (!provided || provided !== expected) {
    throw new AppError("E-ADMIN-UNAUTHORIZED", "Admin authorization is required", 401);
  }
}
