import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { decideChangeRequest, reviseChangeRequest } from "@/server/change-requests";
import { AppError, fail, ok } from "@/server/errors";

const schema = z.object({ approved: z.boolean() });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    if (session.role === "staff") throw new AppError("E-CHANGE-ADMIN", "Admin approval is required", 403);
    await decideChangeRequest(params.id, schema.parse(await request.json()).approved, session.email);
    return ok({ success: true });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    if (session.role === "staff") {
      throw new AppError("E-CHANGE-ADMIN", "Only an admin can revise reviewed requests", 403);
    }
    return ok(await reviseChangeRequest(params.id, await request.json()), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
