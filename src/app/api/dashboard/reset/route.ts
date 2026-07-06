import { requireAdmin } from "@/server/auth";
import { resetDb } from "@/server/db";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    // Do not return until the destructive wipe and the complete reseed have
    // both finished. Serverless runtimes may suspend work after a response.
    await resetDb();
    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
