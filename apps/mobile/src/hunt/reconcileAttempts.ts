import {
  isSelectableAttempt,
  type VoucherAttempt,
} from "@bizflow/shared";

/**
 * Remote libSQL reads can briefly trail a draw committed by another serverless
 * instance. Keep a locally acknowledged draw long enough for replicas to catch
 * up, but never let it override the server indefinitely.
 */
export const PENDING_ATTEMPT_GRACE_MS = 15_000;

/** Newest-wins merge that keeps attempt order stable. */
export function mergeAttempts(
  current: VoucherAttempt[],
  incoming: VoucherAttempt[],
): VoucherAttempt[] {
  const byId = new Map(current.map((attempt) => [attempt.id, attempt]));
  for (const attempt of incoming) byId.set(attempt.id, attempt);
  return Array.from(byId.values());
}

export function reconcileSnapshotAttempts({
  current,
  incoming,
  now = Date.now(),
  pending,
}: {
  current: VoucherAttempt[];
  incoming: VoucherAttempt[];
  now?: number;
  pending: Map<string, number>;
}): VoucherAttempt[] {
  for (const attempt of incoming) pending.delete(attempt.id);

  for (const [attemptId, addedAt] of pending) {
    if (now - addedAt >= PENDING_ATTEMPT_GRACE_MS) {
      pending.delete(attemptId);
    }
  }

  const pendingLocal = current.filter(
    (attempt) => pending.has(attempt.id) && isSelectableAttempt(attempt),
  );
  return mergeAttempts(incoming, pendingLocal);
}
