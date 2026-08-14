import { z } from "zod";
import { requireSignedInCustomerPhone } from "@/server/customer-auth";
import { fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { convertRewardCreditToVoucher } from "@/server/rewards-network";

// No amount: conversion mints one voucher of a fixed denomination, so there is
// nothing for the caller to choose. Older clients may still post `amount`; it is
// ignored rather than rejected so they degrade to minting one voucher instead of
// erroring.
const schema = z.object({
  walletSecret: z.string().min(16),
  /** Which catalogue entry. Omitted by clients that predate the catalogue. */
  rewardId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const phone = await requireSignedInCustomerPhone(request);
    // Budgeted by wallet, not address: this moves LP, and the balance is per
    // phone. A burst here is either a retry storm or someone probing the
    // conditional-balance guard for a race.
    await enforceRateLimit(request, "rewards/convert", {
      limit: 15,
      windowMs: 60_000,
      subject: phone,
    });
    const input = schema.parse(await request.json());
    return ok(
      await convertRewardCreditToVoucher({
        phone,
        walletSecret: input.walletSecret,
        rewardId: input.rewardId,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
