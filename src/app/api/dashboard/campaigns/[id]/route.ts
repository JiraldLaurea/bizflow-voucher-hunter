import { fail, ok } from "@/server/errors";
import { dashboardMetrics } from "@/server/voucher-engine";

export function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return ok(dashboardMetrics(params.id));
  } catch (error) {
    return fail(error);
  }
}
