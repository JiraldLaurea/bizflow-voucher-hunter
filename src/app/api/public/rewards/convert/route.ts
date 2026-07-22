import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { convertRewardCreditToVoucher } from "@/server/rewards-network";

const schema = z.object({
  walletSecret: z.string().min(16),
  amount: z.union([z.string().min(1), z.number().positive()]),
});

export async function POST(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone();
    const input = schema.parse(await request.json());
    return ok(
      await convertRewardCreditToVoucher({
        phone,
        walletSecret: input.walletSecret,
        amount: input.amount,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
