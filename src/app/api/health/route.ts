import { ok } from "@/server/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return ok({
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
}
