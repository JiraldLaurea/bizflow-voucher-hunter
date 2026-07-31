import { z } from "zod";
import { assertSuperAdmin, requireAdmin } from "@/server/auth";
import { fail, ok } from "@/server/errors";
import { isDevLiveSmsEnabled, setDevLiveSmsEnabled } from "@/server/runtime-settings";
import { resolveSmsProvider } from "@/server/sms";

export const dynamic = "force-dynamic";

/**
 * The "Live SMS" switch for non-production servers.
 *
 * Reports the configured provider alongside the flag so the dashboard can say
 * what turning it on would actually do — with SMS_PROVIDER=mock the switch has
 * no effect, which is otherwise invisible and confusing.
 */
async function currentState() {
  return {
    enabled: await isDevLiveSmsEnabled(),
    configuredProvider: process.env.SMS_PROVIDER ?? "mock",
    effectiveProvider: await resolveSmsProvider(),
    isProduction: process.env.NODE_ENV === "production",
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertSuperAdmin(session);
    return ok(await currentState());
  } catch (error) {
    return fail(error);
  }
}

const schema = z.object({ enabled: z.boolean() });

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    assertSuperAdmin(session);
    const { enabled } = schema.parse(await request.json());
    await setDevLiveSmsEnabled(enabled);
    return ok(await currentState());
  } catch (error) {
    return fail(error);
  }
}
