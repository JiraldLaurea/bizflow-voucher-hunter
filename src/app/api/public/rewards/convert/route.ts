import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { convertRewardCreditToVoucher } from "@/server/rewards-network";

const schema = z.object({
  campaignSlug: z.string().min(1),
  phone: z.string().min(10),
  customerSessionToken: z.string().min(24),
  walletSecret: z.string().min(16),
  amount: z.union([z.string().min(1), z.number().positive()]),
});

export async function POST(request: Request) {
  try {
    return ok(await convertRewardCreditToVoucher(schema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}
