// Domain types now live in @bizflow/shared so the web app and the React Native
// app share one source of truth. This re-export keeps existing `@/types/voucher`
// imports working unchanged.
export * from "@bizflow/shared/types";
