import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { createSlot, listSlots } from "@/server/admin";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const timePattern = /^\d{2}:\d{2}$/;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(timePattern, "startTime must be HH:MM"),
  endTime: z.string().regex(timePattern, "endTime must be HH:MM"),
  timezone: z.string().optional(),
  branchId: z.string().optional(),
  totalCapacity: z.number().int().min(1),
  status: z.enum(["active", "sold_out", "closed", "paused"]).optional()
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    return ok(await listSlots(params.id));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    return ok(await createSlot(params.id, input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
