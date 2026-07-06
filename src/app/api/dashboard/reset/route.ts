import { requireAdmin } from "@/server/auth";
import { resetDb } from "@/server/db";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    resetDb();
    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
