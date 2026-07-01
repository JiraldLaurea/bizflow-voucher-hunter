import { ok } from "@/server/errors";

export function GET() {
  return ok({
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
}
