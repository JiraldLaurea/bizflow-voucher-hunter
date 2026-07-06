import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { validateVoucher } from "@/server/voucher-engine";

const schema = z.object({ codeOrToken: z.string().min(3) });

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return ok(await validateVoucher(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
