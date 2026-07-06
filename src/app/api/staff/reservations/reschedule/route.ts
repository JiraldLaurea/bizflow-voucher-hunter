import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { rescheduleReservation } from "@/server/voucher-engine";

export const dynamic = "force-dynamic";

const schema = z.object({
  codeOrToken: z.string().min(3),
  newSlotId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return ok(rescheduleReservation(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
