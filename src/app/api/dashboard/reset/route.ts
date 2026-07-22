import { assertSuperAdmin, requireAdmin } from "@/server/auth";
import { resetDb } from "@/server/db";
import { AppError, fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertSuperAdmin(session);
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DASHBOARD_RESET !== "true") {
      throw new AppError("E-RESET-DISABLED", "Dashboard reset is disabled in production", 403);
    }
    // Do not return until the destructive wipe and the complete reseed have
    // both finished. Serverless runtimes may suspend work after a response.
    await resetDb();
    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
