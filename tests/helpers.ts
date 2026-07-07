import { generateCandidate, listSlotsForAttempt, selectFinalVoucher, startHunt } from "@/server/voucher-engine";

/**
 * Drives the new hunt flow end to end: phone sign-in -> draw candidates ->
 * pick one -> choose a slot valid for that candidate's tier -> issue voucher.
 * If `targetSlotId` is given, picks the first drawn candidate whose tier is
 * offered at that slot (so tests can force a specific slot deterministically).
 */
export async function huntAndSelect(opts: {
  campaignSlug: string;
  phone: string;
  sessionId?: string;
  name?: string;
  guestCount?: number;
  draws?: number;
  targetSlotId?: string;
}) {
  const sessionId = opts.sessionId ?? opts.phone;
  const name = opts.name ?? "Test User";
  const base = { campaignSlug: opts.campaignSlug, phone: opts.phone, sessionId };
  await startHunt({ ...base, name });

  const candidates = [];
  for (let i = 0; i < (opts.draws ?? 3); i += 1) candidates.push(await generateCandidate(base));

  let chosen = candidates[0];
  let slotId = opts.targetSlotId;
  if (opts.targetSlotId) {
    for (const candidate of candidates) {
      const { slots } = await listSlotsForAttempt({ campaignSlug: opts.campaignSlug, phone: opts.phone, attemptId: candidate.id });
      if (slots.some((slot) => slot.id === opts.targetSlotId)) {
        chosen = candidate;
        break;
      }
    }
  } else {
    const { slots } = await listSlotsForAttempt({ campaignSlug: opts.campaignSlug, phone: opts.phone, attemptId: chosen.id });
    slotId = slots[0]?.id;
  }

  return selectFinalVoucher({
    campaignSlug: opts.campaignSlug,
    attemptId: chosen.id,
    slotId: slotId!,
    phone: opts.phone,
    sessionId,
    name,
    guestCount: opts.guestCount
  });
}
