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
    const expectedEmail =
      process.env.ADMIN_EMAIL || (development ? "admin@bizflow.local" : "");
    const expectedPassword =
      process.env.ADMIN_PASSWORD ||
      (development ? process.env.ADMIN_ACCESS_TOKEN : undefined);
    if (!expectedEmail || !expectedPassword) {
      throw new AppError(
        "E-ADMIN-CONFIG",
        "Admin login is not configured on the server",
        500,
      );
    }
    if (
      !safeEqual(input.email.trim().toLowerCase(), expectedEmail.toLowerCase()) ||
      !safeEqual(input.password, expectedPassword)
    ) {
      throw new AppError(
        "E-ADMIN-CREDENTIALS",
        "Incorrect email or password",
        401,
      );
    }

    const name = process.env.ADMIN_NAME?.trim() || "BizFlow Admin";
    const role = (process.env.ADMIN_ROLE?.trim() || "super_admin") as "super_admin" | "admin" | "staff";
    const businessIds = (process.env.ADMIN_BUSINESS_IDS?.trim() || "*")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const token = await createAdminSession({
      email: expectedEmail.toLowerCase(),
      name,
      role,
      businessIds: businessIds.length ? businessIds : ["*"],
    });
    const response = ok({ email: expectedEmail.toLowerCase(), name });
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
