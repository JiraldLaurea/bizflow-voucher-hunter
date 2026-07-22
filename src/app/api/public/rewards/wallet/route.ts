import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { getOrCreateRewardWallet, rewardWalletSnapshot } from "@/server/rewards-network";

const postSchema = z.object({
  name: z.string().trim().min(1).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
});

// Authenticated by the httpOnly sign-in cookie (set only after OTP), so the
// wallet no longer needs a separate verification step or a phone in the body.
export async function POST(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone();
    const input = postSchema.parse(await request.json().catch(() => ({})));
    return ok(
      await getOrCreateRewardWallet({
        phone,
        name: input.name || undefined,
        email: input.email || undefined,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone();
    const url = new URL(request.url);
    const walletSecret = z.string().min(16).parse(url.searchParams.get("walletSecret"));
    return ok(await rewardWalletSnapshot({ phone, walletSecret }));
  } catch (error) {
    return fail(error);
  }
}
