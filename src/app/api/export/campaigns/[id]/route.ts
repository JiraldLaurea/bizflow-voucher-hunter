import { requireAdmin } from "@/server/auth";
import { fail } from "@/server/errors";
import { exportCampaignCsv } from "@/server/voucher-engine";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    const csv = await exportCampaignCsv(params.id);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${params.id}-vouchers.csv"`
      }
    });
  } catch (error) {
    return fail(error);
  }
}
