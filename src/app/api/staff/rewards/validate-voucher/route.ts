import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { validateRewardVoucher } from "@/server/rewards-network";

const schema = z.object({
  codeOrToken: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return ok(await validateRewardVoucher(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
