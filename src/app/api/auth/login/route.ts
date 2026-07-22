import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
} from "@/lib/admin-session";
import { AppError, fail, ok } from "@/server/errors";

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

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const development = process.env.NODE_ENV !== "production";
    const adminEmail =
      process.env.ADMIN_EMAIL || (development ? "admin@bizflow.local" : "");
    const adminPassword =
      process.env.ADMIN_PASSWORD ||
      (development ? process.env.ADMIN_ACCESS_TOKEN : undefined);
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

    const name = isStaff ? (process.env.STAFF_NAME?.trim() || "Campaign Staff") : (process.env.ADMIN_NAME?.trim() || "BizFlow Admin");
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
    const response = ok({ email, name, role });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    return fail(error);
  }
}
