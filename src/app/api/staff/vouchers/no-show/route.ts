import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { markNoShow } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  codeOrToken: z.string().min(3),
  staffName: z.string().min(2).optional()
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return ok(markNoShow(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
