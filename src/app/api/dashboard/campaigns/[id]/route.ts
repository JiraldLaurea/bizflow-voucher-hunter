import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { dashboardMetrics } from "@/server/voucher-engine";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    return ok(dashboardMetrics(params.id));
  } catch (error) {
    return fail(error);
  }
}
