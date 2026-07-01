import { exportCampaignCsv } from "@/server/voucher-engine";

export function GET(_request: Request, { params }: { params: { id: string } }) {
  const csv = exportCampaignCsv(params.id);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${params.id}-vouchers.csv"`
    }
  });
}
