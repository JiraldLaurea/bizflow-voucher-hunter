import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { ok } from "@/server/errors";

export async function POST() {
  const response = ok({ loggedOut: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
