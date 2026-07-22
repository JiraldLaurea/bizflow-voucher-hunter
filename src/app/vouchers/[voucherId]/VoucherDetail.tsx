"use client";

import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { FiCalendar, FiCheckCircle, FiChevronLeft, FiClock } from "react-icons/fi";
import { CustomerBottomNav } from "../../_components/CustomerBottomNav";
import { VoucherCard } from "../../_components/VoucherCard";
import { getVoucherPresentation } from "@/lib/voucher-presentation";
import {
  formatDate,
  formatTime,
  isVoucherExpired,
  readClaimedVouchers,
  voucherStatusLabel,
  type ClaimedVoucher,
} from "@/lib/voucher-display";

/**
 * Voucher details for one claimed voucher.
 *
 * Deliberately standalone rather than a step of the campaign flow: a claimed
 * voucher is read straight from this device's wallet and needs no campaign
 * account. Rendering it through the flow meant the flow's "no account for this
 * campaign" guard bounced the visitor to that campaign's landing page — which
 * is exactly what happens after a sign-out, since that clears per-campaign
 * state while the claimed-voucher wallet survives.
 */
export function VoucherDetail({ voucherId }: { voucherId: string }) {
  const [claimed, setClaimed] = useState<ClaimedVoucher[] | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    setClaimed(readClaimedVouchers());
  }, []);

  const item = claimed?.find((entry) => entry.voucher.id === voucherId);
  const qrToken = item?.voucher.qrToken;

  useEffect(() => {
    if (!qrToken) {
      setQrDataUrl("");
      return;
    }
    let active = true;
    QRCode.toDataURL(qrToken, {
      width: 328,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1d3a", light: "#ffffff" },
    })
      .then((dataUrl) => active && setQrDataUrl(dataUrl))
      .catch(() => active && setQrDataUrl(""));
    return () => {
      active = false;
    };
  }, [qrToken]);

  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="mobile-step-header">
          <div className="step-app-bar">
            <Link
              aria-label="Back to my vouchers"
              className="step-back-link"
              href="/vouchers"
              prefetch={false}
            >
              <FiChevronLeft aria-hidden="true" />
            </Link>
            <strong>Voucher Details</strong>
            <span className="step-bar-spacer" />
          </div>
        </section>
        <section className="mobile-screen-card">
          {claimed === null ? (
            <div className="content-skeleton" aria-hidden="true">
              <span className="skeleton-block skeleton-card" />
            </div>
          ) : item ? (
            <div className="confirmation-content voucher-detail-content">
              <h2>{item.voucher.displayLabel}</h2>
              {isVoucherExpired(item.voucher) ? (
                <p className="alert" role="status">
                  This voucher expired on{" "}
                  {formatDate(item.voucher.expiresAt.slice(0, 10))} and can no
                  longer be used.
                </p>
              ) : (
                <p className="muted">Show this voucher and QR code at the outlet.</p>
              )}
              <article
                className={`card candidate issued-voucher voucher-${getVoucherPresentation(item.voucher).rarity}`}
              >
                <VoucherCard
                  benefit={item.voucher}
                  code={item.voucher.voucherCode}
                  detail={item.businessName}
                />
              </article>
              <div className="qr-code">
                {qrDataUrl ? (
                  <Image
                    alt={`QR code for voucher ${item.voucher.voucherCode}`}
                    height={164}
                    src={qrDataUrl}
                    unoptimized
                    width={164}
                  />
                ) : (
                  <span>Generating QR code…</span>
                )}
              </div>
              <div className="summary-list" style={{ textAlign: "left" }}>
                <SummaryRow
                  icon={<FiCalendar aria-hidden="true" />}
                  label="Date"
                  value={formatDate(item.slot.date)}
                />
                <SummaryRow
                  icon={<FiClock aria-hidden="true" />}
                  label="Time"
                  value={formatTime(item.slot.startTime)}
                />
                <SummaryRow
                  icon={<FiCheckCircle aria-hidden="true" />}
                  label="Status"
                  value={voucherStatusLabel(item.voucher)}
                />
              </div>
            </div>
          ) : (
            <div className="info-card">
              <p>This voucher is no longer saved on this device.</p>
              <Link className="button full" href="/vouchers" prefetch={false}>
                Back to My Vouchers
              </Link>
            </div>
          )}
        </section>
        <CustomerBottomNav
          active="vouchers"
          homeHref="/"
          vouchersHref="/vouchers"
          moreHref="/more"
        />
      </div>
    </main>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="summary-row">
      <span className="icon-box">{icon}</span>
      <div>
        <strong>{label}</strong>
        <p className="muted">{value}</p>
      </div>
    </div>
  );
}
