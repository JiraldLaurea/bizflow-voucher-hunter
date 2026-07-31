import { z } from "zod";
import { updateBusiness } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { AppError, fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * Venue details shown to customers on the campaign page.
 *
 * Every field is optional so a partial update leaves the rest alone; an empty
 * string clears a value. The staff PIN is deliberately absent — it is a
 * credential, rotated through its own flow rather than a details form.
 */
const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(300).optional(),
  contactNumber: z.string().max(40).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { businessId: string } },
) {
  try {
    const session = await requireAdmin(request);
    // Staff see only their own business and must not be able to rewrite the
    // public-facing address or phone number for it.
    if (session.role === "staff") {
      throw new AppError("E-STAFF-BUSINESS-EDIT", "Staff cannot edit businesses", 403);
    }
    const input = schema.parse(await request.json());
    return ok(await updateBusiness(params.businessId, input));
  } catch (error) {
    return fail(error);
  }
}
