import { z } from "zod";
import { AppError, fail, ok } from "@/server/errors";
import { validateVoucher } from "@/server/voucher-engine";

const schema = z.object({ codeOrToken: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = validateVoucher(input);
    if (!result.user) throw new AppError("E-USER-404", "Voucher owner was not found", 404);
    return ok({
      status: "mock_sent",
      to: result.user.phone,
      voucherCode: result.voucher.voucherCode
    });
  } catch (error) {
    return fail(error);
  }
}
