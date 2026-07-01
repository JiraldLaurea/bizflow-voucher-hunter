import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { startHunt } from "@/server/voucher-engine";

const schema = z.object({
  campaignSlug: z.string().min(1),
  slotId: z.string().min(1),
  phone: z.string().min(7),
  sessionId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return ok(startHunt(input));
  } catch (error) {
    return fail(error);
  }
}
