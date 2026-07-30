import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSmppMessageParts } from "@/server/sms";

// The worker is plain CJS run outside Next, so it cannot import the TypeScript
// segmentation from src/server/sms.ts and carries a hand-ported copy instead.
// A drift between the two silently truncates or mis-concatenates real messages,
// so pin them together here.
//
// Loading the worker executes its module scope, which calls required() on its
// env, so the required variables are stubbed before the require.
function loadWorkerInternals() {
  const previous = { ...process.env };
  Object.assign(process.env, {
    SMPP_WORKER_API_TOKEN: "test-token",
    SMPP_DLR_CALLBACK_URL: "https://example.test/api/sms/delivery-receipt",
    SMPP_WORKER_CALLBACK_SECRET: "test-secret",
    SMPP_HOST: "smsc.test",
    SMPP_SYSTEM_ID: "test-system",
    SMPP_PASSWORD: "test-password",
    // Bind to port 0 so the worker's listen() does not collide with anything.
    SMPP_WORKER_PORT: "0",
  });
  try {
    const require = createRequire(import.meta.url);
    const workerPath = path.join(process.cwd(), "server", "smpp-worker.cjs");
    delete require.cache[require.resolve(workerPath)];
    return require(workerPath) as { __test?: { buildMessageParts: (m: string) => unknown[] } };
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
}

const cases: Array<[string, string]> = [
  ["a single short part", "Your sign-in code is 123456."],
  [
    "a two-part GSM body",
    "[Mesa Manila Test Kitchen] Voucher confirmed! BIZ-C2CC87 - Free Dessert. Visit: 2026-07-05, 19:00-21:00. Show this SMS on arrival. Valid til 2026-07-05.",
  ],
  ["a body needing three GSM parts", "A".repeat(400)],
  ["a GSM body sitting exactly on the single-part boundary", "B".repeat(160)],
  ["a GSM body one character past the boundary", "C".repeat(161)],
  ["a body forced to UCS-2 by one non-GSM character", `${"D".repeat(100)}😀`],
  ["extension characters that cost two septets", "€".repeat(90)],
];

/**
 * The concatenation reference in the UDH is random per message, so it differs
 * between the two calls by design. Zero it before comparing; everything else in
 * the header (length, IEI, IEDL, total, sequence) must match exactly.
 */
function normalize(parts: unknown[]) {
  return parts.map((part) => {
    const copy = { ...(part as Record<string, unknown>) };
    const sm = copy.short_message as { udh?: Buffer; message?: string } | string | undefined;
    if (sm && typeof sm === "object" && Buffer.isBuffer(sm.udh)) {
      const udh = Buffer.from(sm.udh);
      udh[3] = 0;
      copy.short_message = { ...sm, udh };
    }
    return copy;
  });
}

describe("smpp-worker segmentation parity", () => {
  const worker = loadWorkerInternals();

  it("exposes its internals for testing", () => {
    expect(worker.__test?.buildMessageParts).toBeTypeOf("function");
  });

  for (const [label, message] of cases) {
    it(`splits ${label} identically to src/server/sms.ts`, () => {
      const expected = normalize(buildSmppMessageParts(message));
      const actual = normalize(worker.__test!.buildMessageParts(message));
      expect(actual).toEqual(expected);
    });
  }

  it("uses one shared concatenation reference across a multipart message", () => {
    const parts = worker.__test!.buildMessageParts("E".repeat(400)) as Array<{
      short_message: { udh: Buffer };
    }>;
    expect(parts.length).toBeGreaterThan(1);
    const refs = new Set(parts.map((p) => p.short_message.udh[3]));
    expect(refs.size).toBe(1);
    parts.forEach((p, i) => {
      expect(p.short_message.udh[4]).toBe(parts.length); // total
      expect(p.short_message.udh[5]).toBe(i + 1); // sequence
    });
  });
});
