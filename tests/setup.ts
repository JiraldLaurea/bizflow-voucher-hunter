import { afterEach, beforeEach, vi } from "vitest";

// Freeze the clock to a date before the seed's demo slots (July 5-9, 2026) so
// voucher expiry — especially slot-bound "selected_slot_only" benefits — is
// deterministic regardless of the real wall-clock date. Only Date is faked;
// timers/microtasks stay real so the async libSQL layer resolves normally.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-03T12:00:00+08:00"));
});

afterEach(() => {
  vi.useRealTimers();
});
