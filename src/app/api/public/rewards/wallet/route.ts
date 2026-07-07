import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { getOrCreateRewardWallet, rewardWalletSnapshot } from "@/server/rewards-network";

const schema = z.object({
  campaignSlug: z.string().min(1),
  phone: z.string().min(10),
  customerSessionToken: z.string().min(24),
  name: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return ok(
      await getOrCreateRewardWallet({
        campaignSlug: input.campaignSlug,
        phone: input.phone,
        customerSessionToken: input.customerSessionToken,
        name: input.name,
        email: input.email || undefined,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignSlug = z.string().min(1).parse(url.searchParams.get("campaignSlug"));
    const phone = z.string().min(10).parse(url.searchParams.get("phone"));
    const customerSessionToken = z.string().min(24).parse(url.searchParams.get("customerSessionToken"));
    const walletSecret = z.string().min(16).parse(url.searchParams.get("walletSecret"));
    return ok(await rewardWalletSnapshot({ campaignSlug, phone, customerSessionToken, walletSecret }));
  } catch (error) {
    return fail(error);
  }
}
