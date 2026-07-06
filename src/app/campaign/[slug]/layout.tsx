import type { ReactNode } from "react";

// Campaign availability, slots, and voucher counts are operational data and
// must never be served from a stale full-route cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PublicCampaignLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
