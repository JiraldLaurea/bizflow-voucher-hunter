import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { resendVoucherSms } from "@/server/voucher-engine";

const schema = z.object({ codeOrToken: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await resendVoucherSms(input);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
