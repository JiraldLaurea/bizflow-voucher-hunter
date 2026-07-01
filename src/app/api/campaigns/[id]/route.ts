import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { getCampaign, updateCampaign } from "@/server/admin";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    title: z.string().min(1),
    offerMessage: z.string().min(1),
    heroImage: z.string().min(1),
    status: z.enum(["active", "paused", "closed"]),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    baseAttempts: z.number().int().min(1),
    referralDailyLimit: z.number().int().min(0),
    candidateTimeoutMinutes: z.number().int().min(1),
    terms: z.string().min(1),
    shopUrl: z.string().url()
  })
  .partial();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdmin(request);
    return ok(getCampaign(params.id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdmin(request);
    const patch = patchSchema.parse(await request.json());
    return ok(updateCampaign(params.id, patch));
  } catch (error) {
    return fail(error);
  }
}
