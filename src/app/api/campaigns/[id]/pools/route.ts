import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { createPool, listPools } from "@/server/admin";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  benefitType: z.enum(["discount_percent", "fixed_amount", "free_item", "free_shipping"]),
  benefitValue: z.string().min(1),
  displayLabel: z.string().min(1),
  totalQuantity: z.number().int().min(1),
  probabilityWeight: z.number().int().min(1),
  expiryType: z.enum(["hours", "days", "selected_slot_only", "custom"]),
  expiryValue: z.number().int().min(0),
  minimumSpend: z.number().int().min(0).optional(),
  restriction: z.string().optional(),
  status: z.enum(["active", "paused", "depleted"]).optional(),
  slotIds: z.array(z.string()).optional()
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    return ok(await listPools(params.id));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    return ok(await createPool(params.id, input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
