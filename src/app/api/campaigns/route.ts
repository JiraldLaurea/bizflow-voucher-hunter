import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { createCampaign } from "@/server/admin";
import { fail, ok } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  businessId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1),
  offerMessage: z.string().min(1),
  heroImage: z.string().min(1),
  mode: z.enum(["restaurant", "online_shop", "beauty", "pet", "retail", "other"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  baseAttempts: z.number().int().min(1),
  referralDailyLimit: z.number().int().min(0),
  candidateTimeoutMinutes: z.number().int().min(1),
  terms: z.string().min(1),
  shopUrl: z.string().url().optional(),
  status: z.enum(["active", "paused", "closed"]).optional(),
  requireOtp: z.boolean().optional(),
  allowReschedule: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    return ok(createCampaign(input), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
