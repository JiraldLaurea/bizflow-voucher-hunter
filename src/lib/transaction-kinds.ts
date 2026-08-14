/**
 * The kinds of movement the transaction list holds, and what to call them.
 *
 * Kept out of `@/server/transactions` because the filter bar is a client
 * component: importing the labels from the server module would pull the libSQL
 * client into the browser bundle with them.
 */

export type TransactionKind = "voucher_redemption" | "lp_earned" | "lp_spent";

export const TRANSACTION_KINDS: { value: TransactionKind; label: string }[] = [
  { value: "voucher_redemption", label: "Voucher redeemed" },
  { value: "lp_earned", label: "Loyalty Points earned" },
  { value: "lp_spent", label: "Loyalty Points spent" },
];

export function transactionKindLabel(kind: TransactionKind) {
  return TRANSACTION_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

export function isTransactionKind(value: unknown): value is TransactionKind {
  return TRANSACTION_KINDS.some((entry) => entry.value === value);
}
