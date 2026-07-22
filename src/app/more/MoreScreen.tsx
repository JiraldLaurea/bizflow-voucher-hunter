"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiChevronRight,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiLogOut,
  FiRefreshCw,
} from "react-icons/fi";
import { CustomerBottomNav } from "@/app/_components/CustomerBottomNav";
import { api } from "@/lib/api-client";
import { forgetIdentity } from "@/lib/customer-identity";
import {
  clearAllFlowState,
  huntResetPatch,
  patchFlowState,
  readFlowString,
} from "@/lib/flow-storage";
import { claimedVouchersStorageKey } from "@/lib/voucher-display";
import type {
  RewardLedgerEntry,
  RewardVoucher,
  RewardWallet,
} from "@/types/voucher";

type RewardWalletSnapshot = {
  wallet: RewardWallet;
  walletSecret: string;
  balance: string;
  ledger: RewardLedgerEntry[];
  vouchers: RewardVoucher[];
};

type DevPoolOption = {
  poolId?: string;
  displayLabel: string;
  remainingQuantity?: number;
};

const devToolsEnabled = process.env.NODE_ENV !== "production";

const qrOptions = {
  width: 288,
  margin: 2,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#0b1d3a", light: "#ffffff" },
};

async function copyText(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy failed.");
}

/** Renders a data-URL QR for `token`, or "" while absent/failed. */
function useQrDataUrl(token: string | undefined) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    if (!token) {
      setDataUrl("");
      return;
    }
    let active = true;
    QRCode.toDataURL(token, qrOptions)
      .then((url) => active && setDataUrl(url))
      .catch(() => active && setDataUrl(""));
    return () => {
      active = false;
    };
  }, [token]);
  return dataUrl;
}

/**
 * The global Account / More screen.
 *
 * It is deliberately standalone rather than a step of the campaign flow: it
 * lives at a global URL, so any campaign-relative navigation would be wrong
 * here. The only campaign it knows about is `campaignSlug` — an anchor used
 * purely to scope the OTP session, the dev pool list, and the hunt reset. The
 * rewards wallet itself is per-phone and network-wide. Nothing in this file
 * navigates to that campaign.
 */
export function MoreScreen({
  campaignSlug,
  initialPhone,
}: {
  campaignSlug: string;
  initialPhone: string;
}) {
  // The phone comes from the signed-in server session (initialPhone). There is
  // no per-screen verification anymore — reaching this page means verified.
  const phone = initialPhone;
  const [hydrated, setHydrated] = useState(false);

  const [wallet, setWallet] = useState<RewardWalletSnapshot | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [convertAmount, setConvertAmount] = useState("");
  const [expandedVoucherId, setExpandedVoucherId] = useState("");

  const [devOptions, setDevOptions] = useState<DevPoolOption[]>([]);
  const [devPoolId, setDevPoolId] = useState("");
  const [devResetBusy, setDevResetBusy] = useState(false);
  const [devResetMessage, setDevResetMessage] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const walletQr = useQrDataUrl(wallet?.wallet.walletToken);
  const expandedVoucher = wallet?.vouchers.find(
    (voucher) => voucher.id === expandedVoucherId,
  );
  const voucherQr = useQrDataUrl(expandedVoucher?.qrToken);

  useEffect(() => {
    setDevPoolId(readFlowString(campaignSlug, "devVoucherPoolId"));
    setHydrated(true);
  }, [campaignSlug]);

  // Authenticated by the httpOnly sign-in cookie — no token/phone in the body.
  const loadWallet = useCallback(async () => {
    setWalletBusy(true);
    try {
      const snapshot = await api<RewardWalletSnapshot>(
        "/api/public/rewards/wallet",
        { method: "POST", body: JSON.stringify({}) },
      );
      setWallet(snapshot);
      setError("");
    } catch (caught) {
      setWallet(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load rewards wallet.",
      );
    } finally {
      setWalletBusy(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated) void loadWallet();
  }, [hydrated, loadWallet]);

  useEffect(() => {
    if (!devToolsEnabled) return;
    let active = true;
    api<DevPoolOption[]>(
      `/api/public/campaigns/${encodeURIComponent(campaignSlug)}/pools`,
    )
      .then((pools) => {
        if (active) setDevOptions(pools.filter((pool) => pool.poolId));
      })
      .catch(() => {
        if (active) setDevOptions([]);
      });
    return () => {
      active = false;
    };
  }, [campaignSlug]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function copy(value: string, label: string) {
    try {
      await copyText(value);
      setNotice(`${label} copied.`);
    } catch {
      setError(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  async function convertRewardCredit() {
    if (!convertAmount.trim()) {
      setError("Enter an amount to convert.");
      return;
    }
    setWalletBusy(true);
    setError("");
    try {
      await api("/api/public/rewards/convert", {
        method: "POST",
        body: JSON.stringify({
          walletSecret: wallet?.walletSecret,
          amount: convertAmount,
        }),
      });
      setConvertAmount("");
      setNotice("Reward credit converted into a voucher.");
      await loadWallet();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to convert reward credit.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  function chooseDevPool(poolId: string) {
    setDevPoolId(poolId);
    patchFlowState(campaignSlug, { devVoucherPoolId: poolId });
  }

  async function resetHunt() {
    if (!phone) return;
    setDevResetBusy(true);
    setDevResetMessage("");
    try {
      const result = await api<{
        attemptsCleared: number;
        vouchersCleared: number;
      }>("/api/public/hunt/reset", {
        method: "POST",
        body: JSON.stringify({ campaignSlug, phone }),
      });
      patchFlowState(campaignSlug, huntResetPatch);
      window.localStorage.removeItem(claimedVouchersStorageKey);
      setDevPoolId("");
      setDevResetMessage(
        `Hunt reset — cleared ${result.attemptsCleared} attempt(s) and ${result.vouchersCleared} voucher(s).`,
      );
    } catch (caught) {
      setDevResetMessage(
        caught instanceof Error ? caught.message : "Unable to reset the hunt.",
      );
    } finally {
      setDevResetBusy(false);
    }
  }

  async function signOut() {
    // The auth cookies are httpOnly, so clearing them is a server round-trip.
    try {
      await api("/api/public/signin/signout", { method: "POST" });
    } catch {
      /* proceed to sign-in regardless */
    }
    forgetIdentity();
    clearAllFlowState();
    // Bare /signin, so signing back in lands on the campaign directory.
    window.location.assign("/signin");
  }

  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="mobile-step-header">
          <div className="step-app-bar">
            <span className="step-back-link" aria-hidden="true" />
            <strong>More</strong>
            <span className="step-bar-spacer" />
          </div>
        </section>
        <section className="mobile-screen-card">
          <div className="more-tab-content">
            <div className="info-card">
              <h2>Account</h2>
              <p className="muted">
                {phone ? `Signed in as ${phone}` : "You are not signed in."}
              </p>
            </div>

            <div className="info-card rewards-wallet-card">
              <div className="rewards-wallet-header">
                <div>
                  <h2>Rewards Wallet</h2>
                  <p className="muted">
                    {wallet
                      ? "Show this QR when paying at partner stores."
                      : "Your rewards wallet across BizFlow partner stores."}
                  </p>
                </div>
                <span className="badge success">5% credit</span>
              </div>

              {wallet ? (
                <>
                  <div className="rewards-wallet-balance">
                    <span className="muted">Available reward credit</span>
                    <strong>{wallet.balance}</strong>
                    <small>
                      Credits are not cash and can only convert to BizFlow
                      partner vouchers.
                    </small>
                  </div>
                  <div className="reward-wallet-qr">
                    {walletQr ? (
                      <Image
                        alt="Customer rewards wallet QR code"
                        height={148}
                        src={walletQr}
                        unoptimized
                        width={148}
                      />
                    ) : (
                      <span>Generating wallet QR…</span>
                    )}
                  </div>
                  <div className="reward-wallet-token">
                    <button
                      className="button secondary wallet-token-toggle"
                      onClick={() => setTokenVisible((visible) => !visible)}
                      type="button"
                    >
                      {tokenVisible ? (
                        <FiEyeOff aria-hidden="true" />
                      ) : (
                        <FiEye aria-hidden="true" />
                      )}
                      {tokenVisible ? "Hide wallet token" : "Show wallet token"}
                    </button>
                    {tokenVisible && (
                      <div className="wallet-token-value">
                        <code>{wallet.wallet.walletToken}</code>
                        <button
                          className="button secondary wallet-token-copy"
                          onClick={() =>
                            copy(wallet.wallet.walletToken, "Wallet token")
                          }
                          type="button"
                        >
                          <FiCopy aria-hidden="true" />
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                  <label className="field rewards-convert-field">
                    <span>Convert credits to voucher</span>
                    <input
                      inputMode="decimal"
                      onChange={(event) => setConvertAmount(event.target.value)}
                      placeholder="50.00"
                      value={convertAmount}
                    />
                  </label>
                  <button
                    className="button full"
                    disabled={
                      walletBusy ||
                      !wallet.walletSecret ||
                      !convertAmount.trim()
                    }
                    onClick={convertRewardCredit}
                    type="button"
                  >
                    Convert to Voucher
                  </button>
                  {wallet.vouchers.length > 0 ? (
                    <div className="reward-voucher-list">
                      <strong>Your reward vouchers</strong>
                      {wallet.vouchers.slice(0, 3).map((voucher) => {
                        const expanded = expandedVoucherId === voucher.id;
                        return (
                          <div className="reward-voucher-card" key={voucher.id}>
                            <button
                              className="reward-voucher-row"
                              onClick={() =>
                                setExpandedVoucherId(expanded ? "" : voucher.id)
                              }
                              type="button"
                            >
                              <span>{voucher.voucherCode}</span>
                              <small>
                                ₱{(voucher.remainingCentavos / 100).toFixed(2)} ·{" "}
                                {voucher.status}
                              </small>
                              <FiChevronRight
                                aria-hidden="true"
                                className={`reward-voucher-arrow ${expanded ? "expanded" : ""}`}
                              />
                            </button>
                            {expanded ? (
                              <div className="reward-voucher-detail">
                                <div className="reward-voucher-qr">
                                  {voucherQr ? (
                                    <Image
                                      alt={`QR code for reward voucher ${voucher.voucherCode}`}
                                      height={148}
                                      src={voucherQr}
                                      unoptimized
                                      width={148}
                                    />
                                  ) : (
                                    <span>Generating reward QR…</span>
                                  )}
                                </div>
                                <div className="reward-voucher-actions">
                                  <button
                                    className="button secondary"
                                    onClick={() =>
                                      copy(
                                        voucher.voucherCode,
                                        "Reward voucher code",
                                      )
                                    }
                                    type="button"
                                  >
                                    <FiCopy aria-hidden="true" />
                                    Copy Code
                                  </button>
                                  <button
                                    className="button secondary"
                                    onClick={() =>
                                      copy(voucher.qrToken, "Reward QR token")
                                    }
                                    type="button"
                                  >
                                    <FiCopy aria-hidden="true" />
                                    Copy QR Token
                                  </button>
                                </div>
                                <small className="muted">
                                  Partner staff can scan this QR or enter the
                                  voucher code in Rewards Network.
                                </small>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="muted">
                  {walletBusy
                    ? "Loading rewards wallet…"
                    : "Rewards wallet is unavailable right now."}
                </p>
              )}
              {error ? <p className="alert">{error}</p> : null}
            </div>

            {devToolsEnabled ? (
              <aside className="dev-voucher-picker">
                <div className="dev-voucher-picker-heading">
                  <span>Development tools</span>
                  <small>Local only</small>
                </div>
                <label className="field">
                  <span>Choose the next voucher</span>
                  <select
                    disabled={devOptions.length === 0}
                    onChange={(event) => chooseDevPool(event.target.value)}
                    value={devPoolId}
                  >
                    <option value="">Random — use campaign odds</option>
                    {devOptions.map((option) => (
                      <option key={option.poolId} value={option.poolId}>
                        {option.displayLabel} ({option.remainingQuantity ?? 0}{" "}
                        remaining)
                      </option>
                    ))}
                  </select>
                </label>
                <p>This choice applies to the next roulette spin for this campaign.</p>
                <div className="dev-tool-divider" />
                <label className="field">
                  <span>Reset the voucher hunt</span>
                  <button
                    className="button secondary full"
                    disabled={devResetBusy || !phone}
                    onClick={resetHunt}
                    type="button"
                  >
                    <FiRefreshCw aria-hidden="true" />
                    {devResetBusy ? "Resetting…" : "Reset My Hunt"}
                  </button>
                </label>
                <p>
                  Clears this number&apos;s attempts, voucher, and reservation
                  for this campaign and returns the stock, so you can hunt again
                  from the start.
                </p>
                {devResetMessage ? (
                  <p className="dev-tool-message">{devResetMessage}</p>
                ) : null}
              </aside>
            ) : null}

            <button
              className="button secondary full more-sign-out-button"
              onClick={signOut}
              type="button"
            >
              <FiLogOut aria-hidden="true" />
              Sign Out
            </button>

            {notice ? (
              <div className="snackbar" role="status" aria-live="polite">
                <FiCheckCircle aria-hidden="true" />
                {notice}
              </div>
            ) : null}
          </div>
        </section>
        <CustomerBottomNav
          active="more"
          homeHref="/"
          vouchersHref="/vouchers"
          moreHref="/more"
        />
      </div>
    </main>
  );
}
