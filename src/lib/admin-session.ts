export const ADMIN_SESSION_COOKIE = "bizflow_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type AdminSession = {
  email: string;
  name: string;
  role: "super_admin" | "admin" | "staff";
  businessIds: string[];
  exp: number;
};

function encodeBase64Url(value: string | Uint8Array) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_ACCESS_TOKEN) {
    return `bizflow-development-session:${process.env.ADMIN_ACCESS_TOKEN}:local-only`;
  }
  throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
}

export async function createAdminSession(input: {
  email: string;
  name: string;
  role?: AdminSession["role"];
  businessIds?: string[];
}) {
  const payload: AdminSession = {
    email: input.email,
    name: input.name,
    role: input.role ?? "super_admin",
    businessIds: input.businessIds ?? ["*"],
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(sessionSecret()),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSession(
  token?: string | null,
): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(sessionSecret()),
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const decoded = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payload)),
    ) as AdminSession;
    if (
      !decoded.email ||
      !decoded.name ||
      !decoded.role ||
      !Array.isArray(decoded.businessIds) ||
      !decoded.exp ||
      decoded.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function sessionTokenFromRequest(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const entry = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(ADMIN_SESSION_COOKIE.length + 1)) : null;
}
