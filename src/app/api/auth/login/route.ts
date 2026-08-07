import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
} from "@/lib/admin-session";
import {
  findAdminUserForLogin,
  recordAdminLogin,
  verifyPassword,
} from "@/server/admin-users";
import { devToolsEnabled } from "@/server/dev-tools";
import { AppError, fail, ok } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sessionResponse(
  session: {
    email: string;
    name: string;
    role: "super_admin" | "admin" | "staff";
  },
  token: string,
) {
  const response = ok(session);
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    // A console password is the keys to every business, every customer's PII,
    // and the settlement ledger. This endpoint had no limiter at all, so it was
    // an offline-speed password oracle reachable over the internet. Budget by
    // address and again by the account under attack, since neither alone stops
    // a distributed guesser aimed at one known admin address.
    await enforceRateLimit(request, "auth/login", {
      limit: 10,
      windowMs: 10 * 60_000,
    });
    await enforceRateLimit(request, "auth/login", {
      limit: 10,
      windowMs: 10 * 60_000,
      subject: input.email.trim().toLowerCase(),
    });
    // The bootstrap fallback below hands out a super-admin session for a
    // password published in .env.example. It must never be reachable from a
    // deploy that merely failed to set NODE_ENV — see devToolsEnabled.
    const development = devToolsEnabled();

    // Managed accounts win over the environment credentials. The env pair stays
    // as the bootstrap login — it is what gets you into an empty console to
    // create the first real account, and it is how existing deployments keep
    // working after this table appears.
    const account = await findAdminUserForLogin(input.email);
    if (account) {
      if (
        account.status !== "active" ||
        !verifyPassword(input.password, account.passwordHash)
      ) {
        throw new AppError(
          "E-ADMIN-CREDENTIALS",
          // Deliberately the same message a wrong password gets: whether an
          // address exists, and whether it is disabled, is not public.
          "Incorrect email or password",
          401,
        );
      }
      await recordAdminLogin(account.id);
      const token = await createAdminSession({
        email: account.email,
        name: account.name,
        role: account.role,
        businessIds: account.businessIds,
      });
      return sessionResponse(
        { email: account.email, name: account.name, role: account.role },
        token,
      );
    }

    const adminEmail =
      process.env.ADMIN_EMAIL || (development ? "admin@bizflow.local" : "");
    const adminPassword =
      process.env.ADMIN_PASSWORD ||
      (development
        ? process.env.ADMIN_ACCESS_TOKEN || "admin-password"
        : undefined);
    const staffEmail = process.env.STAFF_EMAIL || (development ? "staff@bizflow.local" : "");
    const staffPassword = process.env.STAFF_PASSWORD || (development ? "staff-password" : "");
    if (!adminEmail || !adminPassword) {
      throw new AppError(
        "E-ADMIN-CONFIG",
        "Admin login is not configured on the server",
        500,
      );
    }
    const email = input.email.trim().toLowerCase();
    const isAdmin = safeEqual(email, adminEmail.toLowerCase()) && safeEqual(input.password, adminPassword);
    const isStaff = Boolean(staffEmail && staffPassword) && safeEqual(email, staffEmail.toLowerCase()) && safeEqual(input.password, staffPassword);
    if (!isAdmin && !isStaff) {
      throw new AppError(
        "E-ADMIN-CREDENTIALS",
        "Incorrect email or password",
        401,
      );
    }

    const name = isStaff ? (process.env.STAFF_NAME?.trim() || "Campaign Staff") : (process.env.ADMIN_NAME?.trim() || "Voucher Hunt Admin");
    const role = isStaff ? "staff" as const : (process.env.ADMIN_ROLE?.trim() || "super_admin") as "super_admin" | "admin";
    const businessScope = isStaff
      ? process.env.STAFF_BUSINESS_IDS || (development ? "biz_demo_restaurant" : "")
      : process.env.ADMIN_BUSINESS_IDS || "*";
    const businessIds = businessScope
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (isStaff && businessIds.length !== 1) {
      throw new AppError(
        "E-STAFF-SCOPE-CONFIG",
        "Staff login must be assigned to exactly one business",
        500,
      );
    }
    const token = await createAdminSession({
      email,
      name,
      role,
      businessIds: isStaff ? businessIds : businessIds.length ? businessIds : ["*"],
    });
    return sessionResponse({ email, name, role }, token);
  } catch (error) {
    return fail(error);
  }
}
