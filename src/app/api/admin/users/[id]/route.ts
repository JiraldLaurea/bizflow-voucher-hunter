import { z } from "zod";
import { requireAdmin, assertSuperAdmin } from "@/server/auth";
import {
  deleteAdminUser,
  MIN_PASSWORD_LENGTH,
  updateAdminUser,
} from "@/server/admin-users";
import { fail, ok } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every field optional: this is a patch, and an omitted password must leave the
// existing one untouched rather than clearing it.
const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["super_admin", "admin", "staff"]).optional(),
  businessIds: z.array(z.string().trim().min(1)).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireAdmin(request);
    assertSuperAdmin(session);
    const input = schema.parse(await request.json());
    // The actor is passed down so the server module can refuse self-demotion
    // and self-deletion, which are the two ways to lock yourself out.
    return ok(await updateAdminUser(params.id, input, session));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireAdmin(request);
    assertSuperAdmin(session);
    await deleteAdminUser(params.id, session);
    return ok({ id: params.id });
  } catch (error) {
    return fail(error);
  }
}
