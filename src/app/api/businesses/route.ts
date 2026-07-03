import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { createBusiness, listBusinesses } from "@/server/admin";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  logoText: z.string().min(1).max(4),
  industry: z.enum(["restaurant", "online_shop", "beauty", "pet", "retail", "other"]),
  staffPin: z.string().regex(/^\d{4,6}$/, "staffPin must be 4 to 6 digits")
});

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return ok(listBusinesses());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const input = schema.parse(await request.json());
    return ok(createBusiness(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
