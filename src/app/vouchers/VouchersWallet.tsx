"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerBottomNav } from "../_components/CustomerBottomNav";
import { VoucherCard } from "../_components/VoucherCard";
import { getVoucherPresentation } from "@/lib/voucher-presentation";
import {
  formatDate,
  formatTime,
  isVoucherExpired,
  readClaimedVouchers,
  type ClaimedVoucher,
} from "@/lib/voucher-display";

export function VouchersWallet() {
  const [claimed, setClaimed] = useState<ClaimedVoucher[] | null>(null);

  useEffect(() => {
    setClaimed(readClaimedVouchers());
  }, []);

  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="mobile-step-header">
          <div className="step-app-bar">
            <span className="step-back-link" aria-hidden="true" />
            <strong>My Vouchers</strong>
            <span className="step-bar-spacer" />
          </div>
        </section>
        <section className="mobile-screen-card voucher-wallet-screen">
          <div className="voucher-wallet">
            <div className="voucher-wallet-heading">
              <p className="muted">Your claimed vouchers saved on this device.</p>
            </div>
            {claimed === null ? (
              <div className="content-skeleton" aria-hidden="true">
                <span className="skeleton-block skeleton-card" />
              </div>
            ) : claimed.length > 0 ? (
              <div className="candidate-grid">
                {claimed.map((item) => (
                  <Link
                    aria-label={`View details for ${item.voucher.displayLabel}`}
                    className={`card candidate candidate-button wallet-voucher voucher-${getVoucherPresentation(item.voucher).rarity}`}
                    href={`/vouchers/${item.voucher.id}`}
                    key={item.voucher.id}
                    prefetch={false}
                  >
                    <VoucherCard benefit={item.voucher} code={item.voucher.voucherCode} detail={item.businessName} />
                    <small className="wallet-voucher-meta">
                      {item.campaignTitle} · {formatDate(item.slot.date)} at {formatTime(item.slot.startTime)}
                      {isVoucherExpired(item.voucher) ? " · Expired" : ""}
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="info-card">
                <p>No claimed vouchers saved on this device yet.</p>
                <Link className="button full" href="/" prefetch={false}>
                  Browse campaigns
                </Link>
              </div>
            )}
          </div>
        </section>
        <CustomerBottomNav active="vouchers" homeHref="/" vouchersHref="/vouchers" moreHref="/more" />
      </div>
    </main>
  );
}
