import type { VoucherAttempt } from "@bizflow/shared";
import { describe, expect, it } from "vitest";

import {
  PENDING_ATTEMPT_GRACE_MS,
  reconcileSnapshotAttempts,
} from "../../apps/mobile/src/hunt/reconcileAttempts";

function attempt(
  id: string,
  status: VoucherAttempt["status"] = "Candidate",
): VoucherAttempt {
  return {
    id,
    campaignId: "campaign-1",
    userId: "user-1",
    attemptNumber: 1,
    sourceType: "base",
    benefitType: "discount_percent",
    benefitValue: "30",
    displayLabel: "30% OFF",
    poolId: "pool-1",
    status,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("mobile hunt snapshot reconciliation", () => {
  it("keeps a locally acknowledged draw when an immediate snapshot is stale", () => {
    const local = attempt("attempt-local");
    const pending = new Map([[local.id, 1_000]]);

    const result = reconcileSnapshotAttempts({
      current: [local],
      incoming: [],
      now: 1_000 + PENDING_ATTEMPT_GRACE_MS - 1,
      pending,
    });

    expect(result).toEqual([local]);
    expect(pending.has(local.id)).toBe(true);
  });

  it("uses the server copy and clears the pending marker once replication catches up", () => {
    const local = attempt("attempt-local");
    const server = { ...local, status: "Held" as const };
    const pending = new Map([[local.id, 1_000]]);

    const result = reconcileSnapshotAttempts({
      current: [local],
      incoming: [server],
      now: 2_000,
      pending,
    });

    expect(result).toEqual([server]);
    expect(pending.has(local.id)).toBe(false);
  });

  it("returns authority to the server after the replication grace period", () => {
    const local = attempt("attempt-local");
    const pending = new Map([[local.id, 1_000]]);

    const result = reconcileSnapshotAttempts({
      current: [local],
      incoming: [],
      now: 1_000 + PENDING_ATTEMPT_GRACE_MS,
      pending,
    });

    expect(result).toEqual([]);
    expect(pending.has(local.id)).toBe(false);
  });
});
