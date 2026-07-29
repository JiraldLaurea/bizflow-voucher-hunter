"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheck, FiCreditCard, FiGift, FiRefreshCw, FiShield, FiX } from "react-icons/fi";
import { api } from "@/lib/api-client";
import type { Business, RewardVoucher, RewardWallet } from "@/types/voucher";

type CreditResult = {
  rewardAmount: string;
  balance: string;
  fraudFlag?: string;
  heldForReview?: boolean;
  idempotentReplay?: boolean;
};

type ValidateRewardResult = {
  voucher: Pick<RewardVoucher, "voucherCode" | "remainingCentavos" | "status" | "expiresAt">;
  wallet: Pick<RewardWallet, "maskedPhone" | "status">;
};

type RedeemResult = {
  voucher: ValidateRewardResult["voucher"];
  amount: string;
  serviceFee: string;
  settlementAmount: string;
};

function formatPoints(pointsCentavos: number) {
  return `${(pointsCentavos / 100).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  })} LP`;
}

export function RewardsStaffTools({
  business,
}: {
  business: Pick<Business, "id" | "name">;
}) {
  const router = useRouter();
  const businessId = business.id;
  const [walletToken, setWalletToken] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [creditIdempotencyKey, setCreditIdempotencyKey] = useState(() => crypto.randomUUID());
  const [rewardCode, setRewardCode] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [rewardResult, setRewardResult] = useState<ValidateRewardResult | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showError(error: unknown, fallback: string) {
    setToast({ tone: "error", title: error instanceof Error ? error.message : fallback });
  }

  async function creditWallet() {
    setBusy(true);
    try {
      const result = await api<CreditResult>("/api/staff/rewards/credit", {
        method: "POST",
        body: JSON.stringify({
          walletToken: walletToken.trim(),
          businessId,
          purchaseAmount,
          idempotencyKey: creditIdempotencyKey,
        }),
      });
      setCreditIdempotencyKey(crypto.randomUUID());
      if (result.heldForReview) {
        setToast({
          tone: "error",
          title: "Loyalty Points held for review",
          detail: result.fraudFlag?.replace(/_/g, " ") ?? "Suspicious activity",
        });
      } else if (result.idempotentReplay) {
        setToast({
          tone: "success",
          title: "Duplicate request safely ignored",
          detail: `Existing LP: ${result.rewardAmount} · Wallet balance: ${result.balance}`,
        });
      } else {
        setToast({
          tone: "success",
          title: `${result.rewardAmount} added`,
          detail: `Wallet balance: ${result.balance}`,
        });
      }
      router.refresh();
    } catch (error) {
      showError(error, "Unable to add Loyalty Points.");
    } finally {
      setBusy(false);
    }
  }

  async function validateReward() {
    setBusy(true);
    try {
      const result = await api<ValidateRewardResult>("/api/staff/rewards/validate-voucher", {
        method: "POST",
        body: JSON.stringify({ codeOrToken: rewardCode.trim() }),
      });
      setRewardResult(result);
      setToast({ tone: "success", title: "LP voucher loaded." });
    } catch (error) {
      setRewardResult(null);
      showError(error, "Unable to validate LP voucher.");
    } finally {
      setBusy(false);
    }
  }

  async function redeemReward() {
    setBusy(true);
    try {
      const result = await api<RedeemResult>("/api/staff/rewards/redeem", {
        method: "POST",
        body: JSON.stringify({
          codeOrToken: rewardCode.trim(),
          businessId,
          amount: redeemAmount,
        }),
      });
      setRewardResult({ voucher: result.voucher, wallet: rewardResult!.wallet });
      setToast({
        tone: "success",
        title: `${result.amount} payment recorded`,
        detail: `Partner receives ${result.settlementAmount}; service fee ${result.serviceFee}.`,
      });
      router.refresh();
    } catch (error) {
      showError(error, "Unable to redeem LP voucher.");
    } finally {
      setBusy(false);
    }
  }

  const canCredit = walletToken.trim().length > 10 && businessId && purchaseAmount.trim();
  const canValidateReward = rewardCode.trim().length >= 3;
  const canRedeemReward =
    rewardResult?.voucher.status === "Active" &&
    businessId &&
    redeemAmount.trim().length > 0;

  return (
    <section className="panel span-12 rewards-staff-tools">
      <div className="admin-topbar">
        <div>
          <h2>Loyalty Points Staff Tools</h2>
          <p className="muted">
            Add 5% LP from paid purchases or accept LP vouchers for monthly
            partner settlement.
          </p>
        </div>
        <span className="badge success">
          <FiShield aria-hidden="true" />
          Audit logged
        </span>
      </div>

      <div className="rewards-staff-grid">
        <div className="rewards-tool-card">
          <div className="rewards-tool-card-header">
            <h3><FiCreditCard aria-hidden="true" /> Add 5% Loyalty Points</h3>
          </div>
          <label className="field">
            <span>Customer Wallet QR Token</span>
            <input
              value={walletToken}
              onChange={(event) => setWalletToken(event.target.value)}
              placeholder="Scan or paste customer wallet token"
            />
          </label>
          <label className="field">
            <span>Actual Paid Amount (₱)</span>
            <input
              inputMode="decimal"
              value={purchaseAmount}
              onChange={(event) => setPurchaseAmount(event.target.value)}
              placeholder="0.00"
            />
          </label>
          <button className="button full" disabled={!canCredit || busy} onClick={creditWallet} type="button">
            {busy ? <FiRefreshCw aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
            Add Loyalty Points
          </button>
        </div>

        <div className="rewards-tool-card">
          <div className="rewards-tool-card-header">
            <h3><FiGift aria-hidden="true" /> Accept LP Voucher</h3>
          </div>
          <label className="field">
            <span>LP Voucher Code or QR Token</span>
            <input
              value={rewardCode}
              onChange={(event) => setRewardCode(event.target.value)}
              placeholder="RWD-ABC123 or QR token"
            />
          </label>
          <div className="split-actions">
            <button className="button secondary full" disabled={!canValidateReward || busy} onClick={validateReward} type="button">
              Validate LP Voucher
            </button>
          </div>
          {rewardResult ? (
            <div className="rewards-result-box">
              <strong>{rewardResult.voucher.voucherCode}</strong>
              <span>Remaining: {formatPoints(rewardResult.voucher.remainingCentavos)}</span>
              <span>Status: {rewardResult.voucher.status}</span>
              <span>Customer: {rewardResult.wallet.maskedPhone}</span>
            </div>
          ) : null}
          <label className="field">
            <span>LP Payment Amount</span>
            <input
              inputMode="decimal"
              value={redeemAmount}
              onChange={(event) => setRedeemAmount(event.target.value)}
              placeholder="0.00"
            />
          </label>
          <button className="button full" disabled={!canRedeemReward || busy} onClick={redeemReward} type="button">
            Record LP Payment
          </button>
        </div>
      </div>

      {toast ? (
        <div className="rewards-snackbar" role="status" aria-live="polite">
          <span className="rewards-snackbar-copy">
            <strong>{toast.title}</strong>
            {toast.detail ? <small>{toast.detail}</small> : null}
          </span>
          <button
            aria-label="Dismiss notification"
            className="rewards-snackbar-close"
            onClick={() => setToast(null)}
            type="button"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
