import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "@/server/db";
import {
  creditRewardFromPurchase,
  getOrCreateRewardWallet,
} from "@/server/rewards-network";
import { redeemVoucher } from "@/server/voucher-engine";
import { huntAndSelect } from "../helpers";

/**
 * The page is a server component that renders a client filter bar, so the
 * router hooks that bar reaches for have to exist even though nothing here
 * navigates.
 */
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`unexpected redirect to ${href}`);
  },
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

// currentSession reads the request cookie through React's `cache`, which has no
// request to sit in here. The business list underneath stays real.
const session = { role: "super_admin", businessIds: ["*"], email: "a@b.c", name: "Admin" };
vi.mock("@/server/dashboard-data", async () => {
  const { listBusinesses } = await import("@/server/admin");
  return {
    currentSession: async () => session,
    cachedBusinesses: async () => listBusinesses(),
  };
});

const { default: TransactionsPage } = await import(
  "@/app/dashboard/transactions/page"
);

async function renderPage(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(await TransactionsPage({ searchParams }));
}

describe("transactions page", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("renders an empty state before any checkout has taken money", async () => {
    const html = await renderPage();
    expect(html).toContain("Transactions");
    expect(html).toContain("No transactions yet");
  });

  it("renders each movement with its customer, amount and staff", async () => {
    const selected = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639181111111",
      sessionId: "page-session",
      name: "Page Customer",
    });
    await redeemVoucher({
      codeOrToken: selected.voucher.voucherCode,
      staffName: "Cashier",
      purchaseAmount: 2000,
    });
    const wallet = await getOrCreateRewardWallet({ phone: "+639182222222" });
    await creditRewardFromPurchase({
      walletToken: wallet.wallet.walletToken,
      businessId: "biz_demo_shop",
      purchaseAmount: "1000",
      staffName: "shop@bizflow.local",
      idempotencyKey: "page-walk-in-purchase",
    });

    const html = await renderPage();

    expect(html).toContain("Page Customer");
    expect(html).toContain(selected.voucher.voucherCode);
    expect(html).toContain("Voucher redeemed");
    expect(html).toContain("Loyalty Points earned");
    expect(html).toContain("Cashier");
    // ₱2,000 counted once across the redemption and the award it triggered,
    // plus the ₱1,000 walk-in.
    expect(html).toContain("₱3,000.00");
    expect(html).toContain("Export CSV");
    expect(html).not.toContain("No transactions yet");
  });

  it("says a filtered-out list is filtered rather than empty", async () => {
    const selected = await huntAndSelect({
      campaignSlug: "july-dinner",
      phone: "+639181111111",
      sessionId: "page-session-2",
      name: "Page Customer",
    });
    await redeemVoucher({
      codeOrToken: selected.voucher.voucherCode,
      staffName: "Cashier",
      purchaseAmount: 2000,
    });

    const html = await renderPage({ q: "nobody-by-that-name" });
    expect(html).toContain("No transactions match these filters");
    expect(html).not.toContain("No transactions yet");
  });

  it("ignores a junk kind in the query string instead of failing", async () => {
    const html = await renderPage({ kind: "not-a-kind" });
    expect(html).toContain("No transactions yet");
  });

  /**
   * A <label> forwards a click to the first labelable element inside it, and a
   * <button> is labelable. Wrapping the dropdown in one meant picking an option
   * closed the menu and the forwarded click immediately reopened it, so the
   * filter looked stuck open. The control captions itself instead.
   */
  it("does not wrap a dropdown trigger in a label", async () => {
    const html = await renderPage();

    expect(html).toContain('role="combobox"');
    // The caption is still rendered, just by the control rather than a <label>.
    expect(html).toContain("Type");

    const labels = html.match(/<label[^>]*>[\s\S]*?<\/label>/g) ?? [];
    // Proves the match works before anything is asserted about it: the three
    // native fields (From, To, Search) do belong in labels and stay there.
    expect(labels).toHaveLength(3);
    expect(labels.every((label) => label.includes("<input"))).toBe(true);

    for (const label of labels) {
      expect(label).not.toContain('role="combobox"');
    }
  });
});
