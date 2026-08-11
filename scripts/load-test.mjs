#!/usr/bin/env node
/**
 * HTTP load driver for the customer hunt flow and the admin dashboard.
 *
 * Deliberately not a unit test: `tests/integration/concurrency.test.ts` proves
 * the stock invariants hold under contention, but it calls the engine directly
 * and sequentially. Nothing in the suite exercises the HTTP layer, the rate
 * limiter, or the connection behaviour of many clients at once, which is where a
 * busy campaign actually hurts.
 *
 *   node scripts/load-test.mjs --scenario hunt --users 50 --duration 60
 *   node scripts/load-test.mjs --scenario dashboard --users 20 --duration 30
 *   node scripts/load-test.mjs --scenario mixed --users 40 --duration 60
 *
 * Point it somewhere with --base-url. It refuses a non-localhost target unless
 * --i-know-this-is-not-local is passed, because load-testing a deployment sends
 * real traffic, bills real money, and can send real SMS.
 *
 * ── Why each virtual user sets its own X-Forwarded-For ──
 * The public endpoints are rate limited per address, and `signin/request-otp`
 * allows 5 per 5 minutes. Every virtual user coming from one machine shares one
 * address, so without this the run measures the rate limiter and nothing else —
 * six users in, everything is 429.
 *
 * `clientIp()` counts hops from the right and clamps at index 0, so with no
 * proxy in front (localhost) the header a client sends *is* the address it is
 * bucketed under. That is exactly what makes this work, and it is also why
 * TRUSTED_PROXY_HOPS has to match the real proxy depth in production: set it too
 * high there and real callers get to pick their own bucket the same way.
 */

const HELP = `
Usage: node scripts/load-test.mjs [options]

  --scenario <hunt|dashboard|mixed>  What to drive (default: hunt)
  --users <n>                        Concurrent virtual users (default: 25)
  --duration <seconds>               Load phase length (default: 30)
  --base-url <url>                   Target (default: http://127.0.0.1:3000)
  --campaign <slug>                  Campaign to hunt (default: july-dinner)
  --admin-email <email>              Dashboard login
  --admin-password <password>        Dashboard login
  --think <ms>                       Pause between a user's requests (default: 250)
  --shared-ip                        Do NOT vary X-Forwarded-For; measures the
                                     rate limiter itself rather than the app
  --i-know-this-is-not-local         Required to target a non-localhost host
  --help
`;

function parseArgs(argv) {
  const args = {
    scenario: "hunt",
    users: 25,
    duration: 30,
    baseUrl: "http://127.0.0.1:3000",
    campaign: "july-dinner",
    adminEmail: process.env.ADMIN_EMAIL ?? "",
    adminPassword: process.env.ADMIN_PASSWORD ?? "",
    think: 250,
    sharedIp: false,
    allowRemote: false,
  };
  const map = {
    "--scenario": ["scenario", String],
    "--users": ["users", Number],
    "--duration": ["duration", Number],
    "--base-url": ["baseUrl", String],
    "--campaign": ["campaign", String],
    "--admin-email": ["adminEmail", String],
    "--admin-password": ["adminPassword", String],
    "--think": ["think", Number],
  };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (flag === "--shared-ip") {
      args.sharedIp = true;
      continue;
    }
    if (flag === "--i-know-this-is-not-local") {
      args.allowRemote = true;
      continue;
    }
    const entry = map[flag];
    if (!entry) throw new Error(`Unknown option: ${flag}`);
    const [key, cast] = entry;
    args[key] = cast(argv[++i]);
  }
  return args;
}

/* ── Measurement ─────────────────────────────────────────────────────────── */

/**
 * One row per request kind. Latencies are kept in full rather than as a running
 * average: the interesting number under load is the tail, and a mean hides it.
 */
class Stats {
  constructor() {
    this.steps = new Map();
  }

  record(step, ms, outcome) {
    let row = this.steps.get(step);
    if (!row) {
      row = { latencies: [], ok: 0, rateLimited: 0, failed: 0, errors: new Map() };
      this.steps.set(step, row);
    }
    row.latencies.push(ms);
    if (outcome.ok) row.ok += 1;
    else if (outcome.status === 429) row.rateLimited += 1;
    else row.failed += 1;
    if (!outcome.ok) {
      const label = `${outcome.status} ${outcome.code ?? ""}`.trim();
      row.errors.set(label, (row.errors.get(label) ?? 0) + 1);
    }
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/* ── HTTP ────────────────────────────────────────────────────────────────── */

/**
 * A single request, timed and classified. A 429 is recorded but never thrown as
 * a failure: it is the app behaving as designed, and conflating it with a 500
 * would make a healthy limiter look like an outage.
 */
async function call(ctx, step, path, init = {}) {
  const started = performance.now();
  let status = 0;
  let code;
  let body;
  try {
    const response = await fetch(`${ctx.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(ctx.ip ? { "x-forwarded-for": ctx.ip } : {}),
        ...(ctx.token ? { authorization: `Bearer ${ctx.token}` } : {}),
        ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
        ...(init.headers ?? {}),
      },
    });
    status = response.status;
    const text = await response.text();
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined; // HTML pages (the dashboard scenario) are not JSON.
    }
    code = body?.error?.code ?? body?.code;
  } catch (error) {
    status = 0;
    code = error.code ?? "NETWORK";
  }
  const ms = performance.now() - started;
  const ok = status >= 200 && status < 300;
  ctx.stats.record(step, ms, { ok, status, code });
  return { ok, status, code, body, response: { status } };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── Scenarios ───────────────────────────────────────────────────────────── */

/**
 * One customer, end to end: sign in, start the hunt, spin, look at the offered
 * slots, book one. Sign-in happens once per virtual user; the loop after it is
 * the part that repeats, because a real crowd signs in once and then hunts.
 */
async function huntUser(ctx, deadline) {
  const phone = ctx.phone;

  const otp = await call(ctx, "signin/request-otp", "/api/public/signin/request-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  const devCode = otp.body?.data?.devCode ?? otp.body?.devCode;
  if (!otp.ok || !devCode) {
    // Without the echoed code there is no way to complete sign-in, so this user
    // cannot contribute load. Surfaced in the summary as a skipped user.
    ctx.skipped = otp.ok ? "no devCode (dev tools off, or live SMS on)" : `otp ${otp.status}`;
    return;
  }

  const verify = await call(ctx, "signin/verify-otp", "/api/public/signin/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, code: devCode, issueToken: true }),
  });
  const token = verify.body?.data?.token ?? verify.body?.token;
  if (!token) {
    ctx.skipped = `verify ${verify.status}`;
    return;
  }
  ctx.token = token;

  while (performance.now() < deadline) {
    await call(ctx, "hunt/start", "/api/public/hunt/start", {
      method: "POST",
      body: JSON.stringify({ campaignSlug: ctx.campaign, sessionId: ctx.sessionId, name: ctx.name }),
    });
    await sleep(ctx.think);
    if (performance.now() >= deadline) break;

    const attempt = await call(ctx, "hunt/attempt", "/api/public/hunt/attempt", {
      method: "POST",
      body: JSON.stringify({ campaignSlug: ctx.campaign, sessionId: ctx.sessionId }),
    });
    const attemptId = attempt.body?.data?.id ?? attempt.body?.id;
    await sleep(ctx.think);
    if (!attemptId || performance.now() >= deadline) continue;

    const slots = await call(
      ctx,
      "hunt/slots",
      `/api/public/hunt/slots?campaignSlug=${encodeURIComponent(ctx.campaign)}&attemptId=${encodeURIComponent(attemptId)}`,
    );
    const list = slots.body?.data?.slots ?? slots.body?.slots ?? [];
    await sleep(ctx.think);
    if (list.length === 0 || performance.now() >= deadline) continue;

    await call(ctx, "hunt/select", "/api/public/hunt/select", {
      method: "POST",
      body: JSON.stringify({
        campaignSlug: ctx.campaign,
        attemptId,
        slotId: list[0].id,
        sessionId: ctx.sessionId,
        name: ctx.name,
        guestCount: 2,
      }),
    });
    await sleep(ctx.think);
  }
}

/**
 * An admin with the dashboard open. Hits the rendered pages rather than an API,
 * because that is what costs: each one is a server render over `dashboardMetrics`
 * and the per-request session read.
 */
async function dashboardUser(ctx, deadline) {
  const pages = ["/dashboard", "/dashboard/users", "/dashboard/rewards", "/dashboard/billing"];
  let index = 0;
  while (performance.now() < deadline) {
    const page = pages[index % pages.length];
    index += 1;
    await call(ctx, `GET ${page}`, page, { headers: { accept: "text/html" } });
    await sleep(ctx.think);
  }
}

/** Signs in once and returns the session cookie every dashboard user shares. */
async function adminCookie(args, stats) {
  if (!args.adminEmail || !args.adminPassword) {
    throw new Error(
      "Dashboard scenario needs --admin-email and --admin-password (or ADMIN_EMAIL / ADMIN_PASSWORD).",
    );
  }
  const ctx = { baseUrl: args.baseUrl, stats, think: 0 };
  const response = await fetch(`${args.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: args.adminEmail, password: args.adminPassword }),
  });
  if (!response.ok) {
    throw new Error(`Admin login failed: ${response.status} ${await response.text()}`);
  }
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const session = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!session) throw new Error("Admin login returned no session cookie.");
  void ctx;
  return session;
}

/* ── Runner ──────────────────────────────────────────────────────────────── */

function report(args, stats, wallMs, skipped) {
  const rows = [];
  let totalRequests = 0;
  let totalOk = 0;
  let total429 = 0;
  let totalFailed = 0;

  for (const [step, row] of stats.steps) {
    const sorted = [...row.latencies].sort((a, b) => a - b);
    totalRequests += sorted.length;
    totalOk += row.ok;
    total429 += row.rateLimited;
    totalFailed += row.failed;
    rows.push({
      step,
      n: sorted.length,
      ok: row.ok,
      rl: row.rateLimited,
      fail: row.failed,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] ?? 0,
      errors: row.errors,
    });
  }

  const ms = (v) => `${v.toFixed(0)}ms`.padStart(8);
  console.log(`\n${"=".repeat(96)}`);
  console.log(
    `scenario=${args.scenario}  users=${args.users}  duration=${args.duration}s  target=${args.baseUrl}`,
  );
  console.log(`${"=".repeat(96)}`);
  console.log(
    "step".padEnd(28) +
      "n".padStart(7) +
      "ok".padStart(7) +
      "429".padStart(7) +
      "fail".padStart(7) +
      "p50".padStart(9) +
      "p95".padStart(9) +
      "p99".padStart(9) +
      "max".padStart(9),
  );
  console.log("-".repeat(96));
  for (const row of rows) {
    console.log(
      row.step.padEnd(28) +
        String(row.n).padStart(7) +
        String(row.ok).padStart(7) +
        String(row.rl).padStart(7) +
        String(row.fail).padStart(7) +
        ms(row.p50) +
        ms(row.p95) +
        ms(row.p99) +
        ms(row.max),
    );
  }
  console.log("-".repeat(96));
  const rps = totalRequests / (wallMs / 1000);
  console.log(
    `total ${totalRequests} requests in ${(wallMs / 1000).toFixed(1)}s  =  ${rps.toFixed(1)} req/s   ` +
      `ok=${totalOk}  rate-limited=${total429}  failed=${totalFailed}`,
  );

  const withErrors = rows.filter((row) => row.errors.size > 0);
  if (withErrors.length > 0) {
    console.log("\nnon-2xx breakdown");
    for (const row of withErrors) {
      for (const [label, count] of [...row.errors].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${row.step.padEnd(28)} ${String(count).padStart(6)}  ${label}`);
      }
    }
  }
  if (skipped.length > 0) {
    console.log(`\n${skipped.length} virtual user(s) could not sign in and produced no load:`);
    const reasons = new Map();
    for (const reason of skipped) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    for (const [reason, count] of reasons) console.log(`  ${String(count).padStart(4)}  ${reason}`);
  }
  console.log("");
}

async function main() {
  const args = parseArgs(process.argv);

  const host = new URL(args.baseUrl).hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal && !args.allowRemote) {
    console.error(
      `\nRefusing to load-test ${args.baseUrl}.\n\n` +
        "This sends sustained real traffic to a deployment: it bills compute and\n" +
        "database usage, writes rows that stay there, and can send real SMS if the\n" +
        "provider is not mocked. Re-run with --i-know-this-is-not-local if that is\n" +
        "genuinely what you want.\n",
    );
    process.exit(2);
  }

  const stats = new Stats();
  const cookie = args.scenario === "hunt" ? undefined : await adminCookie(args, stats);

  const started = performance.now();
  const deadline = started + args.duration * 1000;
  const skipped = [];

  const workers = Array.from({ length: args.users }, (_, index) => {
    const ctx = {
      baseUrl: args.baseUrl,
      campaign: args.campaign,
      stats,
      think: args.think,
      // A distinct address per user unless --shared-ip: see the header comment.
      ip: args.sharedIp ? undefined : `10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`,
      phone: `+63918${String(4_000_000 + index).slice(-7)}`,
      sessionId: `load-${process.pid}-${index}`,
      name: `Load User ${index}`,
      cookie,
    };
    const isDashboard =
      args.scenario === "dashboard" || (args.scenario === "mixed" && index % 4 === 0);
    const run = isDashboard ? dashboardUser(ctx, deadline) : huntUser(ctx, deadline);
    return run
      .catch((error) => {
        ctx.skipped = `threw: ${error.message}`;
      })
      .then(() => {
        if (ctx.skipped) skipped.push(ctx.skipped);
      });
  });

  await Promise.all(workers);
  report(args, stats, performance.now() - started, skipped);
}

main().catch((error) => {
  console.error(`\nload-test failed: ${error.message}\n`);
  process.exit(1);
});
