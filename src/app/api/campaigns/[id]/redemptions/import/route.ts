import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { importRedemptions } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  csv: z.string().min(1),
  staffName: z.string().min(2).default("CSV Import")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    return ok(importRedemptions({ campaignId: params.id, csv: input.csv, staffName: input.staffName }));
  } catch (error) {
    return fail(error);
  }
}
