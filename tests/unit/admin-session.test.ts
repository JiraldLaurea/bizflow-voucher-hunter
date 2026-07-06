import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  sessionTokenFromRequest,
  verifyAdminSession,
} from "@/lib/admin-session";
import { requireAdmin } from "@/server/auth";

describe("admin session", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET =
      "test-only-admin-session-secret-with-more-than-32-characters";
    process.env.ADMIN_ACCESS_TOKEN = "test-integration-token";
  });

  it("creates and verifies a signed session", async () => {
    const token = await createAdminSession({
      email: "admin@example.com",
      name: "Test Admin",
    });
    const session = await verifyAdminSession(token);

    expect(session?.email).toBe("admin@example.com");
    expect(session?.name).toBe("Test Admin");
    expect(session?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered session", async () => {
    const token = await createAdminSession({
      email: "admin@example.com",
      name: "Test Admin",
    });
    const [payload, signature] = token.split(".");
    // The HMAC is computed over the payload string, so flipping its first
    // character deterministically invalidates the signature.
    const tamperedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;

    expect(await verifyAdminSession(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("authorizes requests with the HTTP-only session cookie", async () => {
    const token = await createAdminSession({
      email: "admin@example.com",
      name: "Test Admin",
    });
    const request = new Request("http://localhost/api/campaigns", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
    });

    expect(sessionTokenFromRequest(request)).toBe(token);
    await expect(requireAdmin(request)).resolves.toMatchObject({
      email: "admin@example.com",
    });
  });

  it("keeps the server-only integration token fallback", async () => {
    const request = new Request("http://localhost/api/campaigns", {
      headers: { "x-admin-token": "test-integration-token" },
    });
    await expect(requireAdmin(request)).resolves.toMatchObject({
      name: "API Admin",
    });
  });
});
