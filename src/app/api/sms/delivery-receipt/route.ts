import { z } from "zod";
import { fail, ok } from "@/server/errors";
import { recordSmsDeliveryReceipt } from "@/server/sms-delivery-receipts";

export const dynamic = "force-dynamic";

/**
 * Delivery receipts relayed by the SMPP worker.
 *
 * With SMS_PROVIDER=smpp the app holds the session and receives deliver_sm
 * directly. With smpp_worker the session lives in `server/smpp-worker.cjs`, so
 * the receipts arrive there and are forwarded here to reach the same
 * `sms_logs` reconciliation.
 *
 * Authenticated with SMPP_WORKER_CALLBACK_SECRET — a distinct secret from
 * SMPP_WORKER_API_TOKEN, since this direction of trust is the reverse one.
 */
const schema = z.object({
  providerMessageId: z.string().optional(),
  receiptedMessageId: z.string().optional(),
  messageState: z.union([z.number(), z.string()]).optional(),
  shortMessage: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const secret = process.env.SMPP_WORKER_CALLBACK_SECRET;
    // Refuse rather than accept anonymously when unconfigured: an open endpoint
    // here lets anyone mark a voucher's SMS delivered or failed.
    if (!secret) {
      return Response.json(
        { success: false, error: { code: "E-DLR-DISABLED", message: "Delivery receipts are not configured" } },
        { status: 503 },
      );
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json(
        { success: false, error: { code: "E-DLR-AUTH", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const input = schema.parse(await request.json());
    await recordSmsDeliveryReceipt(input);
    return ok({ recorded: true });
  } catch (error) {
    return fail(error);
  }
}
