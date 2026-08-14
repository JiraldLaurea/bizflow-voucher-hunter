import { z } from "zod";
import { assertSuperAdmin, requireAdmin } from "@/server/auth";
import { resetDb, wipeDb } from "@/server/db";
import { devToolsEnabled } from "@/server/dev-tools";
import { AppError, fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  // "reseed" wipes and reloads the demo fixtures; "wipe" leaves the database
  // empty (super-admin logins aside) for a real install.
  mode: z.enum(["reseed", "wipe"]).default("reseed"),
});

/**
 * Reads the mode from an optional JSON body. Callers that predate the mode —
 * and the button that still posts nothing — get the original reseed behaviour,
 * so an empty or absent body is not an error.
 */
async function readMode(request: Request) {
  const body = await request.text();
  if (!body.trim()) return "reseed" as const;
  try {
    return schema.parse(JSON.parse(body)).mode;
  } catch {
    throw new AppError("E-RESET-MODE", "Unknown reset mode", 400);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertSuperAdmin(session);
    // Wipes every campaign, voucher and wallet. Allowed only where dev tooling
    // is recognised, or where an operator has explicitly opted a real
    // environment in — "not production" is not enough of a reason to erase
    // customer data.
    if (!devToolsEnabled() && process.env.ALLOW_DASHBOARD_RESET !== "true") {
      throw new AppError("E-RESET-DISABLED", "Dashboard reset is disabled in this environment", 403);
    }
    const mode = await readMode(request);
    // Do not return until the destructive wipe and the complete reseed have
    // both finished. Serverless runtimes may suspend work after a response.
    if (mode === "wipe") await wipeDb();
    else await resetDb();
    return ok({ reset: true, mode });
  } catch (error) {
    return fail(error);
  }
}
