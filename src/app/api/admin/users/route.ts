import { z } from "zod";
import { requireAdmin, assertSuperAdmin } from "@/server/auth";
import { createAdminUser, listAdminUsers, MIN_PASSWORD_LENGTH } from "@/server/admin-users";
import { fail, ok } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["super_admin", "admin", "staff"]),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  // Admins may send [] or ["*"] for every business; staff must send exactly one
  // id. The rule lives in the server module so the API and any script share it.
  businessIds: z.array(z.string().trim().min(1)).default([]),
});

/**
 * Console accounts — the people who can sign in to /dashboard, as opposed to
 * `/api/admin/customers`, which is the people who claim vouchers.
 *
 * Super-admin only, throughout. An `admin` who could mint accounts could mint
 * itself a super-admin, which makes the role boundary decorative.
 */
export async function GET(request: Request) {
  try {
    assertSuperAdmin(await requireAdmin(request));
    return ok(await listAdminUsers());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSuperAdmin(await requireAdmin(request));
    const input = schema.parse(await request.json());
    return ok(await createAdminUser(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
