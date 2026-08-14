import { isTransactionKind } from "@/lib/transaction-kinds";
import { requireAdmin } from "@/server/auth";
import { fail } from "@/server/errors";
import { listTransactionsForExport, transactionsToCsv } from "@/server/transactions";

/**
 * The transaction list as a CSV, under whatever filters the page was showing.
 *
 * No role assertion beyond a valid session: `listTransactionsForExport` narrows
 * a staff account to its own businesses from the session, so the export can
 * never widen what the page itself would show.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind");

    const rows = await listTransactionsForExport(session, {
      businessId: params.get("business") ?? undefined,
      kind: isTransactionKind(kind) ? kind : undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      search: params.get("q") ?? undefined,
    });

    return new Response(transactionsToCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="bizflow-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
