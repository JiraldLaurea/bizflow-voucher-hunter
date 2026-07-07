import { ok } from "@/server/errors";

export async function POST(request: Request) {
  await request.json().catch(() => null);
  return ok({
    granted: false,
    reason: "deprecated_use_referral_claim",
  });
}
