import { assertSuperAdmin, requireAdmin } from "@/server/auth";
import { resetDb } from "@/server/db";
import { devToolsEnabled } from "@/server/dev-tools";
import { AppError, fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

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
    // Do not return until the destructive wipe and the complete reseed have
    // both finished. Serverless runtimes may suspend work after a response.
    await resetDb();
    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
