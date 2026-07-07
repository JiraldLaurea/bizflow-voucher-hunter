"use client";

import Image from "next/image";
import QRCode from "qrcode";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaPaw,
  FaShoppingBag,
  FaSpa,
  FaStore,
  FaTag,
  FaUtensils,
} from "react-icons/fa";
import {
  FiAlertTriangle,
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiHome,
  FiRefreshCw,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiTag,
} from "react-icons/fi";
import { api } from "@/lib/api-client";
import { getVoucherPresentation } from "@/lib/voucher-presentation";
import type {
  Campaign,
  CampaignSlot,
  Voucher,
  VoucherAttempt,
} from "@/types/voucher";

type PublicSlot = CampaignSlot & { remainingPoolQuantity: number };
type PublicStep =
  | "landing"
  | "signin"
  | "hunt"
  | "roulette"
  | "results"
  | "datetime"
  | "confirm"
  | "confirmation"
  | "voucher"
  | "vouchers";
type IssuedPayload = { voucher: Voucher; slot: CampaignSlot };
type ClaimedVoucher = IssuedPayload & {
  campaignSlug: string;
  campaignTitle: string;
  businessName: string;
};
type HuntState = {
  user: { id: string };
  attempts: VoucherAttempt[];
  remainingBaseAttempts: number;
  remainingBonusAttempts: number;
  sharesGrantedToday: number;
};

type FlowState = {
  selectedDate: string;
  selectedSlotId: string;
  sessionId: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  guestCount: string;
  attempts: VoucherAttempt[];
  selectedAttemptId: string;
  issued: IssuedPayload | null;
  shareCount: number;
  bonusAttempts: number;
};

type TabCampaign = Pick<Campaign, "slug" | "title" | "mode">;

type FullPageLinkProps = ComponentPropsWithoutRef<"a"> & {
  prefetch?: boolean;
};
type ReferralState = Pick<
  HuntState,
  "sharesGrantedToday" | "remainingBonusAttempts"
>;
type RoulettePreview = Pick<
  VoucherAttempt,
  "benefitType" | "benefitValue" | "displayLabel"
> & {
  probabilityWeight?: number;
  remainingQuantity?: number;
};
type RoulettePhase = "idle" | "searching" | "landing" | "selected";
type PendingSpinCompletion = {
  destination?: string;
  nextState: Partial<FlowState>;
};
type RouletteSequenceResult = {
  items: RoulettePreview[];
  winnerIndex: number;
};

/**
 * Public campaign steps intentionally use document navigation. Next.js RSC
 * transitions can be routed to a stale serverless instance for this dynamic
 * flow, while direct document requests consistently read current campaign data.
 */
function Link({ prefetch: _prefetch, ...props }: FullPageLinkProps) {
  return <a {...props} />;
}

type Props = {
  step: PublicStep;
  campaign: Campaign;
  businessName: string;
  businessLogo: string;
  slots: PublicSlot[];
  campaigns?: TabCampaign[];
  voucherId?: string;
};

type VoucherCardProps = {
  benefit: Pick<
    VoucherAttempt,
    "benefitType" | "benefitValue" | "displayLabel"
  >;
  detail: string;
  selected?: boolean;
  selectionControl?: boolean;
  code?: string;
};

function VoucherCard({
  benefit,
  detail,
  selected = false,
  selectionControl = false,
  code,
}: VoucherCardProps) {
  const presentation = getVoucherPresentation(benefit);

  return (
    <>
      <span className="voucher-glow" aria-hidden="true" />
      <span className="voucher-sparkles" aria-hidden="true">
        <FiStar />
        <FiStar />
        <FiStar />
      </span>
      {selectionControl ? (
        <span className={`radio ${selected ? "radio-selected" : ""}`}>
          {selected ? <FiCheckCircle aria-hidden="true" /> : null}
        </span>
      ) : null}
      <span className={`rarity-badge rarity-badge-${presentation.rarity}`}>
        <FiStar aria-hidden="true" />
        {presentation.label}
        <span aria-hidden="true">·</span>
        {presentation.description}
      </span>
      <h3>{benefit.displayLabel}</h3>
      <p>{detail}</p>
      {code ? (
        <>
          <small>Voucher code</small>
          <p className="code voucher-code">{code}</p>
        </>
      ) : null}
      <span className="voucher-cutout voucher-cutout-left" aria-hidden="true" />
      <span
        className="voucher-cutout voucher-cutout-right"
        aria-hidden="true"
      />
    </>
  );
}

const steps: Array<{ id: PublicStep; label: string; href: string }> = [
  { id: "landing", label: "Campaign Landing", href: "" },
  { id: "signin", label: "Sign In", href: "signin" },
  { id: "hunt", label: "Hunt", href: "hunt" },
  { id: "roulette", label: "Voucher Roulette", href: "roulette" },
  { id: "results", label: "Voucher Results", href: "results" },
  { id: "datetime", label: "Date & Time", href: "datetime" },
  { id: "confirm", label: "Confirm & Details", href: "confirm" },
  { id: "confirmation", label: "Confirmation", href: "confirmation" },
  { id: "vouchers", label: "My Vouchers", href: "vouchers" },
];

const claimedVouchersStorageKey = "bizflow-claimed-vouchers";
const visitorSessionCookie = "bizflow_visitor_session";
const rouletteCardWidth = 304;
const rouletteGap = 12;
const rouletteSpinCount = 42;
const rouletteSpinMs = 10000;
const rouletteSettleMs = 450;
const rouletteFastProgress = 0.84;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatVoucherStatus(status: Voucher["status"]) {
  if (status === "Issued") return "Confirmed";
  if (status === "Redeemed") return "Used";
  return status;
}

function voucherDetail(
  benefit: Pick<VoucherAttempt, "benefitType" | "benefitValue">,
) {
  if (benefit.benefitType === "free_item") return "Any dessert";
  if (benefit.benefitType === "free_shipping") return "Free shipping reward";
  return "On selected items";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function rouletteEase(progress: number) {
  if (progress <= 0.5) {
    return (progress / 0.5) * rouletteFastProgress;
  }

  const slowedProgress = (progress - 0.5) / 0.5;
  return (
    rouletteFastProgress +
    (1 - rouletteFastProgress) *
      (1 - Math.pow(1 - slowedProgress, 3.4))
  );
}

function initialState(_slots: PublicSlot[]): FlowState {
  return {
    selectedDate: "",
    selectedSlotId: "",
    sessionId: "",
    userId: "",
    name: "",
    phone: "",
    email: "",
    guestCount: "2",
    attempts: [],
    selectedAttemptId: "",
    issued: null,
    shareCount: 0,
    bonusAttempts: 0,
  };
}

export function PublicStepClient({
  step,
  campaign,
  businessName,
  slots,
  campaigns = [],
  voucherId,
}: Props) {
  const storageKey = `bizflow-flow-${campaign.slug}`;
  const [state, setState] = useState<FlowState>(() => initialState(slots));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [shareNoticeExiting, setShareNoticeExiting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [soldOut, setSoldOut] = useState(false);
  const [tierSlots, setTierSlots] = useState<PublicSlot[]>([]);
  const [otpRequired, setOtpRequired] = useState(campaign.requireOtp);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [claimedVouchers, setClaimedVouchers] = useState<ClaimedVoucher[]>([]);
  const [rouletteItems, setRouletteItems] = useState<RoulettePreview[]>([]);
  const [rouletteWinner, setRouletteWinner] = useState<RoulettePreview | null>(
    null,
  );
  const [rouletteMessage, setRouletteMessage] = useState("");
  const [roulettePhase, setRoulettePhase] = useState<RoulettePhase>("idle");
  const [rouletteTargetIndex, setRouletteTargetIndex] = useState(0);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [rouletteDurationMs, setRouletteDurationMs] = useState(rouletteSpinMs);
  const [pendingSpinCompletion, setPendingSpinCompletion] =
    useState<PendingSpinCompletion | null>(null);
  const rouletteAnimationRef = useRef<number | null>(null);
  const viewedVoucher =
    step === "voucher"
      ? claimedVouchers.find((item) => item.voucher.id === voucherId)
      : undefined;
  const qrToken =
    step === "voucher"
      ? viewedVoucher?.voucher.qrToken
      : state.issued?.voucher.qrToken;

  useEffect(() => {
    if (campaign.requireOtp) setOtpRequired(true);
  }, [campaign.requireOtp]);

  useEffect(() => {
    return () => {
      if (rouletteAnimationRef.current) {
        window.cancelAnimationFrame(rouletteAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode("");
    setOtpMessage("");
  }, [campaign.slug, state.phone]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const sessionKey = "bizflow-session";
    const sessionId =
      window.localStorage.getItem(sessionKey) ?? crypto.randomUUID();
    window.localStorage.setItem(sessionKey, sessionId);
    document.cookie = `${visitorSessionCookie}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;

    if (saved) {
      setState({ ...initialState(slots), ...JSON.parse(saved), sessionId });
    } else {
      setState({ ...initialState(slots), sessionId });
    }
  }, [slots, storageKey, campaign.slug]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(claimedVouchersStorageKey);
      setClaimedVouchers(saved ? JSON.parse(saved) : []);
    } catch {
      setClaimedVouchers([]);
    }
  }, []);

  useEffect(() => {
    const issued = state.issued;
    if (!issued) return;

    setClaimedVouchers((current) => {
      if (current.some((item) => item.voucher.id === issued.voucher.id)) {
        return current;
      }

      const updated: ClaimedVoucher[] = [
        {
          ...issued,
          campaignSlug: campaign.slug,
          campaignTitle: campaign.title,
          businessName,
        },
        ...current,
      ];
      window.localStorage.setItem(
        claimedVouchersStorageKey,
        JSON.stringify(updated),
      );
      return updated;
    });
  }, [businessName, campaign.slug, campaign.title, state.issued]);

  useEffect(() => {
    if (step !== "datetime" && step !== "results") return;
    refreshShareState();
    if (step === "datetime") fetchTierSlots();
    const interval = setInterval(refreshShareState, 4000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshShareState();
    };
    window.addEventListener("focus", refreshShareState);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshShareState);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, state.userId, state.selectedAttemptId]);

  useEffect(() => {
    if (!shareNotice) return;
    const fadeTimeout = window.setTimeout(
      () => setShareNoticeExiting(true),
      2400,
    );
    const dismissTimeout = window.setTimeout(() => {
      setShareNotice("");
      setShareNoticeExiting(false);
    }, 3000);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(dismissTimeout);
    };
  }, [shareNotice]);

  useEffect(() => {
    if (step !== "roulette" || !state.sessionId || roulettePhase !== "idle") {
      return;
    }
    if (!state.phone) {
      setError("Sign in with your mobile number before spinning.");
      return;
    }
    void startRouletteSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, state.sessionId, state.phone, roulettePhase]);

  useEffect(() => {
    const token = qrToken;
    if (!token) {
      setQrDataUrl("");
      return;
    }

    let active = true;
    QRCode.toDataURL(token, {
      width: 328,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1d3a", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });

    return () => {
      active = false;
    };
  }, [qrToken]);

  function save(next: Partial<FlowState>) {
    setState((current) => {
      const updated = { ...current, ...next };
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }

  function saveAndNavigate(next: Partial<FlowState>, path: string) {
    const updated = { ...state, ...next };
    window.localStorage.setItem(storageKey, JSON.stringify(updated));
    window.location.assign(path);
  }

  function navigate(path: string) {
    window.location.assign(path);
  }

  const currentStepNumber = steps.findIndex((item) => item.id === step) + 1;
  const selectedSlot = slots.find((slot) => slot.id === state.selectedSlotId);
  const selectedAttempt = state.attempts.find(
    (attempt) => attempt.id === state.selectedAttemptId,
  );
  const visibleResult =
    selectedAttempt ?? state.attempts[state.attempts.length - 1];
  const resultMustBeReplaced = Boolean(visibleResult && state.bonusAttempts > 0);
  const rouletteWinnerIndex = Math.max(0, rouletteTargetIndex);
  const rouletteTargetOffset =
    -rouletteWinnerIndex * (rouletteCardWidth + rouletteGap);
  const rouletteAnimatedOffset =
    roulettePhase === "selected" ? rouletteTargetOffset : rouletteOffset;
  const rouletteTrackStyle = {
    "--roulette-target-offset": `${rouletteTargetOffset}px`,
    "--roulette-fast-offset": `${Math.round(rouletteTargetOffset * 0.72)}px`,
    "--roulette-slow-offset": `${Math.round(rouletteTargetOffset * 0.88)}px`,
    "--roulette-near-offset": `${Math.round(rouletteTargetOffset * 0.96)}px`,
    "--roulette-final-approach-offset": `${Math.round(rouletteTargetOffset * 0.992)}px`,
    "--roulette-creep-offset": `${Math.round(rouletteTargetOffset * 0.998)}px`,
    "--roulette-spin-duration": `${rouletteDurationMs}ms`,
    ...(roulettePhase === "landing" || roulettePhase === "selected"
      ? { transform: `translateX(${rouletteAnimatedOffset}px)` }
      : {}),
  } as CSSProperties;
  const dates = useMemo(
    () =>
      Array.from(new Set(slots.map((slot) => slot.date))).map((date) => ({
        date,
        remaining: slots
          .filter((slot) => slot.date === date)
          .reduce((sum, slot) => sum + Math.max(0, slot.remainingCapacity), 0),
      })),
    [slots],
  );
  const daySlots = slots.filter((slot) => slot.date === state.selectedDate);

  function routeFor(nextStep: PublicStep) {
    const target = steps.find((item) => item.id === nextStep);
    return target?.href
      ? `/campaign/${campaign.slug}/${target.href}`
      : `/campaign/${campaign.slug}`;
  }

  function previousRoute(current: PublicStep) {
    const index = steps.findIndex((item) => item.id === current);
    return routeFor(steps[Math.max(0, index - 1)].id);
  }

  function pageTitle() {
    if (step === "voucher") return "Voucher Details";
    return steps[currentStepNumber - 1]?.label ?? "Voucher Hunt";
  }

  function toRoulettePreview(attempt: RoulettePreview): RoulettePreview {
    return {
      benefitType: attempt.benefitType,
      benefitValue: attempt.benefitValue,
      displayLabel: attempt.displayLabel,
      probabilityWeight: attempt.probabilityWeight,
      remainingQuantity: attempt.remainingQuantity,
    };
  }

  function rouletteSequence(
    previews: RoulettePreview[],
    winner: RoulettePreview,
  ): RouletteSequenceResult {
    const pool = previews.length > 0 ? previews : [winner];
    const weighted = pool.flatMap((item) =>
      Array.from({
        length: Math.max(
          1,
          Math.min(4, Math.round((item.probabilityWeight ?? 1) / 15)),
        ),
      }).map(() => item),
    );
    const loop = [...pool, ...weighted, ...pool.slice().reverse()];
    const sequence: RoulettePreview[] = [];
    const trailingCount = 4;
    while (sequence.length < rouletteSpinCount - trailingCount - 1) {
      sequence.push(loop[sequence.length % loop.length] ?? winner);
    }

    const finalApproachLength = Math.min(3, sequence.length);
    for (let index = 1; index <= finalApproachLength; index += 1) {
      sequence[sequence.length - index] = winner;
    }

    const winnerIndex = sequence.length;
    const trailingPool =
      pool.filter((item) => item.displayLabel !== winner.displayLabel).length > 0
        ? pool.filter((item) => item.displayLabel !== winner.displayLabel)
        : pool;
    const trailingItems = Array.from(
      { length: trailingCount },
      (_, index) => trailingPool[index % trailingPool.length] ?? winner,
    );

    return {
      items: [...sequence, winner, ...trailingItems],
      winnerIndex,
    };
  }

  function rouletteLoop(items: RoulettePreview[], count = rouletteSpinCount) {
    if (items.length === 0) return [];
    return Array.from({ length: count }, (_, index) => items[index % items.length]);
  }

  function placeholderRouletteItems() {
    return rouletteLoop([
      {
        benefitType: "discount_percent",
        benefitValue: "20",
        displayLabel: "20% OFF",
        probabilityWeight: 55,
      },
      {
        benefitType: "free_item",
        benefitValue: "dessert",
        displayLabel: "Free Dessert",
        probabilityWeight: 25,
      },
      {
        benefitType: "discount_percent",
        benefitValue: "50",
        displayLabel: "50% OFF",
        probabilityWeight: 15,
      },
      {
        benefitType: "discount_percent",
        benefitValue: "90",
        displayLabel: "90% OFF",
        probabilityWeight: 5,
      },
    ]);
  }

  async function playRoulette(
    sequence: RouletteSequenceResult,
    durationMs = rouletteSpinMs,
  ) {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const winner = sequence.items[sequence.winnerIndex];
    if (!winner) return;
    const targetOffset = -sequence.winnerIndex * (rouletteCardWidth + rouletteGap);
    if (prefersReducedMotion) {
      setRouletteOffset(targetOffset);
      setRouletteWinner(winner);
      setRoulettePhase("selected");
      setRouletteMessage(`Selected: ${winner.displayLabel}`);
      await sleep(rouletteSettleMs);
      return;
    }

    await animateRouletteToOffset(targetOffset, durationMs);
    setRouletteWinner(winner);
    setRouletteOffset(targetOffset);
    setRoulettePhase("selected");
    setRouletteMessage(`Selected: ${winner.displayLabel}`);
    await sleep(rouletteSettleMs);
  }

  function animateRouletteToOffset(targetOffset: number, durationMs: number) {
    if (rouletteAnimationRef.current) {
      window.cancelAnimationFrame(rouletteAnimationRef.current);
      rouletteAnimationRef.current = null;
    }

    setRouletteOffset(0);

    return new Promise<void>((resolve) => {
      const startedAt = performance.now();

      const step = (now: number) => {
        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = rouletteEase(progress);
        const nextOffset = targetOffset * eased;

        setRouletteOffset(Math.round(nextOffset * 100) / 100);

        if (progress < 1) {
          rouletteAnimationRef.current = window.requestAnimationFrame(step);
          return;
        }

        rouletteAnimationRef.current = null;
        setRouletteOffset(targetOffset);
        resolve();
      };

      rouletteAnimationRef.current = window.requestAnimationFrame(step);
    });
  }

  async function fetchRoulettePreviews() {
    try {
      const pools = await api<RoulettePreview[]>(
        `/api/public/campaigns/${encodeURIComponent(campaign.slug)}/pools`,
      );
      return pools.map(toRoulettePreview);
    } catch {
      return [];
    }
  }

  // Step 1: phone sign-in. Identifies the user, then moves to the hunt screen.
  async function signIn() {
    setError("");
    if (!state.phone) {
      setError("Enter your mobile number to sign in and start hunting.");
      return;
    }
    setBusy(true);
    try {
      const started = await api<HuntState>("/api/public/hunt/start", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          phone: state.phone,
          sessionId: state.sessionId,
          name: state.name || "Voucher Hunter",
          email: state.email,
        }),
      });
      const activeAttempts = started.attempts.filter(
        (attempt) =>
          attempt.status === "Candidate" || attempt.status === "Held",
      );
      const pendingAttempt =
        activeAttempts.find((a) => a.id === state.selectedAttemptId) ??
        activeAttempts[activeAttempts.length - 1];
      saveAndNavigate(
        {
          userId: started.user.id,
          attempts: pendingAttempt ? [pendingAttempt] : [],
          selectedAttemptId: pendingAttempt?.id ?? "",
          shareCount: started.sharesGrantedToday,
          bonusAttempts: started.remainingBonusAttempts,
        },
        routeFor("landing"),
      );
    } catch (caught) {
      reportError(caught, "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function startHuntFromLanding() {
    setError("");
    if (!state.phone) {
      navigate(routeFor("signin"));
      return;
    }
    await revealVouchers();
  }

  async function spinToAttempt(
    sourceType: "base" | "referral_bonus",
    destination?: string,
  extraState: Partial<FlowState> = {},
) {
  setBusy(true);
  setPendingSpinCompletion(null);
    setRoulettePhase("searching");
    setRouletteTargetIndex(0);
    setRouletteOffset(0);
    setRouletteDurationMs(rouletteSpinMs);
    setRouletteItems(placeholderRouletteItems());
    setRouletteWinner(null);
    setRouletteMessage("Spinning through every possible voucher...");
    try {
      await nextPaint();
      const previews = await fetchRoulettePreviews();
      if (previews.length > 0) {
        setRouletteItems(rouletteLoop(previews));
      }
      const attempt = await api<VoucherAttempt>("/api/public/hunt/attempt", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          phone: state.phone,
          sessionId: state.sessionId,
          sourceType,
        }),
      });
      const winner = toRoulettePreview(attempt);
      const sequence = rouletteSequence(previews, winner);
      setRouletteItems(sequence.items);
      setRouletteTargetIndex(sequence.winnerIndex);
      const remainingSpinMs = rouletteSpinMs;
      setRouletteDurationMs(remainingSpinMs);
      setRoulettePhase("landing");
      setRouletteMessage("Spinning for your voucher...");
      await nextPaint();
      await playRoulette(sequence, remainingSpinMs);
      const nextState: Partial<FlowState> = {
        attempts: [attempt],
        selectedAttemptId: attempt.id,
        selectedSlotId: "",
        selectedDate: "",
        issued: null,
        ...extraState,
      };
      setPendingSpinCompletion({ destination, nextState });
    } catch (caught) {
      setBusy(false);
      setRouletteItems([]);
      setRouletteWinner(null);
      setRouletteTargetIndex(0);
      setRouletteOffset(0);
      setRouletteDurationMs(rouletteSpinMs);
      setRoulettePhase("idle");
      setRouletteMessage("");
      reportError(
        caught,
        sourceType === "referral_bonus"
          ? "Unable to spin another voucher."
          : "Unable to reveal your voucher.",
      );
    }
  }

  function confirmRouletteSelection() {
    if (!pendingSpinCompletion) return;
    const { destination, nextState } = pendingSpinCompletion;
    setPendingSpinCompletion(null);
    setRouletteItems([]);
    setRouletteWinner(null);
    setRouletteTargetIndex(0);
    setRouletteOffset(0);
    setRouletteDurationMs(rouletteSpinMs);
    setRoulettePhase("idle");
    setRouletteMessage("");
    setBusy(false);
    if (destination) {
      saveAndNavigate(nextState, destination);
    } else {
      save(nextState);
    }
  }

  async function loadHuntSnapshot() {
    const params = new URLSearchParams({
      campaignSlug: campaign.slug,
      phone: state.phone,
    });
    return api<HuntState>(`/api/public/hunt/state?${params.toString()}`);
  }

  // Step 2: reveal one campaign-wide candidate. Extra reveals come from sharing.
  async function revealVouchers() {
    setError("");
    if (!state.phone) {
      setError("Sign in with your mobile number before spinning.");
      return;
    }
    if (visibleResult) {
      saveAndNavigate(
        {
          attempts: [visibleResult],
          selectedAttemptId: visibleResult.id,
        },
        routeFor("results"),
      );
      return;
    }
    setBusy(true);
    try {
      const snapshot = await loadHuntSnapshot();
      const attempts = snapshot.attempts.filter(
        (attempt) =>
          attempt.status === "Candidate" || attempt.status === "Held",
      );
      const pendingAttempt =
        attempts.find((a) => a.id === state.selectedAttemptId) ??
        attempts[attempts.length - 1];
      if (pendingAttempt) {
        saveAndNavigate(
          {
            attempts: [pendingAttempt],
            selectedAttemptId: pendingAttempt.id,
            shareCount: snapshot.sharesGrantedToday,
            bonusAttempts: snapshot.remainingBonusAttempts,
          },
          routeFor("results"),
        );
        return;
      }
      saveAndNavigate({}, routeFor("roulette"));
    } catch (caught) {
      reportError(caught, "Unable to check your voucher hunt.");
    } finally {
      setBusy(false);
    }
  }

  async function startRouletteSpin() {
    setError("");
    try {
      const snapshot = await loadHuntSnapshot();
      const attempts = snapshot.attempts.filter(
        (attempt) =>
          attempt.status === "Candidate" || attempt.status === "Held",
      );
      const pendingAttempt =
        attempts.find((a) => a.id === state.selectedAttemptId) ??
        attempts[attempts.length - 1];
      if (pendingAttempt && snapshot.remainingBonusAttempts <= 0) {
        saveAndNavigate(
          {
            attempts: [pendingAttempt],
            selectedAttemptId: pendingAttempt.id,
            shareCount: snapshot.sharesGrantedToday,
            bonusAttempts: snapshot.remainingBonusAttempts,
          },
          routeFor("results"),
        );
        return;
      }
      const hasUsedBaseSpin = snapshot.attempts.some(
        (attempt) => attempt.sourceType === "base",
      );
      if (hasUsedBaseSpin || snapshot.remainingBaseAttempts <= 0) {
        if (snapshot.remainingBonusAttempts > 0) {
          await spinToAttempt("referral_bonus", routeFor("results"), {
            shareCount: snapshot.sharesGrantedToday,
            bonusAttempts: Math.max(0, snapshot.remainingBonusAttempts - 1),
          });
          return;
        }
        setError(
          "You already used your first spin. Share your link to earn another one.",
        );
        save({
          shareCount: snapshot.sharesGrantedToday,
          bonusAttempts: snapshot.remainingBonusAttempts,
        });
        return;
      }
      await spinToAttempt("base", routeFor("results"), {
        shareCount: snapshot.sharesGrantedToday,
        bonusAttempts: snapshot.remainingBonusAttempts,
      });
    } catch (caught) {
      reportError(caught, "Unable to reveal vouchers.");
    }
  }

  // Loads the date/time slots at which the chosen voucher's tier is offered.
  async function fetchTierSlots() {
    if (!state.selectedAttemptId || !state.phone) {
      setTierSlots([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        campaignSlug: campaign.slug,
        phone: state.phone,
        attemptId: state.selectedAttemptId,
      });
      const res = await api<{ slots: PublicSlot[] }>(
        `/api/public/hunt/slots?${params.toString()}`,
      );
      setTierSlots(res.slots);
      if (
        state.selectedSlotId &&
        !res.slots.some((slot) => slot.id === state.selectedSlotId)
      ) {
        save({ selectedSlotId: "" });
      }
    } catch {
      setTierSlots([]);
    }
  }

  async function refreshShareState() {
    if (!state.userId) return;
    try {
      const params = new URLSearchParams({
        campaignSlug: campaign.slug,
        ref: state.userId,
      });
      const snapshot = await api<ReferralState>(
        `/api/public/referral/state?${params.toString()}`,
      );
      save({
        shareCount: snapshot.sharesGrantedToday,
        bonusAttempts: snapshot.remainingBonusAttempts,
      });
    } catch {
      // Non-critical: keep showing the last known counts.
    }
  }

  async function huntAgain() {
    setError("");
    if (state.bonusAttempts <= 0) {
      setError("Share your link to unlock another roulette spin.");
      return;
    }
    saveAndNavigate({}, routeFor("roulette"));
  }

  async function sendOtp() {
    if (!state.phone) {
      setOtpMessage("Enter your mobile number first.");
      return;
    }
    setOtpBusy(true);
    setOtpMessage("");
    try {
      const res = await api<{ sent: boolean; devCode?: string }>(
        "/api/public/otp/request",
        {
          method: "POST",
          body: JSON.stringify({
            campaignSlug: campaign.slug,
            phone: state.phone,
          }),
        },
      );
      setOtpSent(true);
      setOtpMessage(
        res.devCode
          ? `Code sent. Demo code: ${res.devCode}`
          : "Verification code sent via SMS.",
      );
    } catch (caught) {
      setOtpMessage(
        caught instanceof Error ? caught.message : "Unable to send code.",
      );
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtpCode() {
    setOtpBusy(true);
    setOtpMessage("");
    try {
      await api("/api/public/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          phone: state.phone,
          code: otpCode,
        }),
      });
      setOtpVerified(true);
      setOtpMessage("Phone number verified.");
    } catch (caught) {
      setOtpMessage(caught instanceof Error ? caught.message : "Invalid code.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function shareReferralLink() {
    setError("");
    const query = new URLSearchParams({
      campaign: campaign.slug,
      ref: state.userId,
    });
    const link = `${window.location.origin}/api/public/referral/visit?${query.toString()}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement("textarea");
        input.value = link;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Unable to copy the share link.");
      }
      setShareNoticeExiting(false);
      setShareNotice("Link copied! Send it to a friend.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to prepare the share link.",
      );
    }
  }

  function reportError(caught: unknown, fallback: string) {
    const message = caught instanceof Error ? caught.message : fallback;
    if (/sold out/i.test(message)) setSoldOut(true);
    setError(message);
  }

  function renderSoldOutNotice() {
    const alternatives = slots.filter(
      (slot) =>
        slot.status === "active" &&
        slot.remainingCapacity > 0 &&
        slot.id !== state.selectedSlotId,
    );
    return (
      <div className="soldout-notice" role="alert">
        <h3>
          <FiAlertTriangle aria-hidden="true" /> That slot just sold out
        </h3>
        {alternatives.length ? (
          <>
            <p className="muted">
              Pick another available time to keep hunting:
            </p>
            <ul className="soldout-slot-list">
              {alternatives.slice(0, 6).map((slot) => (
                <li key={slot.id}>
                  <button
                    className="button secondary full"
                    type="button"
                    onClick={() => {
                      saveAndNavigate(
                        { selectedDate: slot.date, selectedSlotId: slot.id },
                        routeFor("datetime"),
                      );
                      setSoldOut(false);
                      setError("");
                    }}
                  >
                    {formatShortDate(slot.date)} · {formatTime(slot.startTime)}{" "}
                    — {slot.remainingCapacity} left
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">
            All slots are fully claimed right now. Please check back later.
          </p>
        )}
      </div>
    );
  }

  async function issueFinalVoucher() {
    setError("");
    if (!state.selectedAttemptId) {
      setError("Choose one voucher candidate first.");
      return;
    }
    if (!state.selectedSlotId) {
      setError("Choose an available date and time first.");
      return;
    }
    if (resultMustBeReplaced) {
      setError("Spin again to replace your previous voucher before confirming.");
      return;
    }
    if (!state.name || !state.phone) {
      setError("Name and mobile number are required.");
      return;
    }
    if (otpRequired && !otpVerified) {
      setError(
        "Verify your phone number with the code we sent before confirming.",
      );
      return;
    }
    setBusy(true);
    try {
      const issued = await api<IssuedPayload>("/api/public/hunt/select", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          attemptId: state.selectedAttemptId,
          slotId: state.selectedSlotId,
          phone: state.phone,
          sessionId: state.sessionId,
          name: state.name,
          email: state.email,
          guestCount:
            campaign.mode === "restaurant"
              ? Number(state.guestCount)
              : undefined,
        }),
      });
      saveAndNavigate({ issued }, routeFor("confirmation"));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to confirm voucher.";
      if (/phone verification is required/i.test(message)) {
        setOtpRequired(true);
        setOtpVerified(false);
        setError("");
        setOtpMessage(
          "Send a verification code to your mobile number, then enter it below.",
        );
      } else {
        reportError(caught, "Unable to confirm voucher.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (step === "landing") {
    return (
      <main className="mobile-flow-shell landing-flow-shell">
        <div className="mobile-app-frame landing-app-frame">
          <section className="landing-app-bar">
            <strong>BizFlow Voucher Hunt</strong>
          </section>
          <section className="landing-screen">{renderStep()}</section>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-flow-shell">
      <div className="mobile-app-frame">
        <section className="mobile-step-header">
          <div className="step-app-bar">
            {step === "results" ||
            step === "confirmation" ||
            step === "vouchers" ||
            step === "roulette" ? (
              <span className="step-back-link" aria-hidden="true" />
            ) : (
              <Link
                aria-label="Back"
                className="step-back-link"
                href={
                  step === "voucher"
                    ? routeFor("vouchers")
                    : previousRoute(step)
                }
                prefetch={false}
              >
                <FiChevronLeft aria-hidden="true" />
              </Link>
            )}
            <strong>{pageTitle()}</strong>
            <span className="step-bar-spacer" />
          </div>
        </section>
        <section
          className={`mobile-screen-card ${
            step === "vouchers" ? "voucher-wallet-screen" : ""
          } ${step === "roulette" ? "roulette-screen" : ""}`}
        >
          {soldOut ? renderSoldOutNotice() : null}
          {renderStep()}
        </section>
        {step === "roulette" && roulettePhase === "selected" ? (
          <div className="roulette-confetti-overlay" aria-hidden="true">
            <span className="roulette-confetti-wrap">
              <span className="roulette-confetti confetti-primary" />
              <span className="roulette-confetti confetti-secondary" />
              <span className="roulette-confetti confetti-sparkles" />
            </span>
          </div>
        ) : null}
        {false && busy && (step === "hunt" || rouletteMessage) ? (
          <div
            aria-labelledby="hunt-loading-title"
            aria-modal="true"
            className={`hunt-loading-backdrop ${rouletteItems.length ? "roulette-backdrop" : ""}`}
            role="dialog"
          >
            <div
              className={`hunt-loading-modal ${rouletteItems.length ? "roulette-modal" : ""}`}
            >
              {rouletteItems.length ? (
                <>
                  <div className="roulette-stage" aria-hidden="true">
                    <span className="roulette-pointer" />
                    <div
                      className={`roulette-track ${
                        roulettePhase === "selected"
                          ? "settled"
                          : roulettePhase === "landing"
                            ? "landing"
                            : "searching"
                      }`}
                      style={rouletteTrackStyle}
                    >
                      {rouletteItems.map((item, index) => {
                        const presentation = getVoucherPresentation(item);
                        return (
                          <article
                            className={`card candidate roulette-ticket voucher-${presentation.rarity} ${
                              roulettePhase === "selected" &&
                              index === rouletteTargetIndex
                                ? "selected"
                                : ""
                            }`}
                            key={`${item.displayLabel}-${index}`}
                          >
                            <VoucherCard
                              benefit={item}
                              detail={voucherDetail(item)}
                            />
                          </article>
                        );
                      })}
                    </div>
                  </div>
                  <h2 id="hunt-loading-title">
                    {rouletteWinner ? "Voucher selected!" : "Spinning now..."}
                  </h2>
                  <p>{rouletteMessage || "Every reward is in the mix."}</p>
                  {pendingSpinCompletion ? (
                    <div className="roulette-confirm-actions">
                      <button
                        className="button full"
                        onClick={confirmRouletteSelection}
                        type="button"
                      >
                        Confirm Voucher
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
              <div className="hunt-loading-emblem" aria-hidden="true">
                <span className="hunt-loading-ring" />
                <FiShoppingBag />
              </div>
              <h2 id="hunt-loading-title">Preparing your vouchers…</h2>
              <p>Restoring your hunt and checking voucher availability.</p>
              <div className="hunt-loading-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );

  function renderStep() {
    if (step === "landing") {
      return (
        <>
          <CampaignTabs campaigns={campaigns} currentSlug={campaign.slug} />
          <h1 className="landing-title">Sign in and hunt for a voucher</h1>
          <p className="landing-copy">
            Sign in with your mobile number, spin the voucher roulette, then
            pick your date &amp; time.
          </p>
          <div className="landing-hero-art" aria-hidden="true" />
          <div className="landing-rule-card">
            <RuleRow
              icon={<FiShield aria-hidden="true" />}
              text="Sign in with your phone number"
            />
            <RuleRow
              icon={<FiClock aria-hidden="true" />}
              text="One roulette spin reveals one voucher result"
            />
            <RuleRow
              icon={<FiShield aria-hidden="true" />}
              text="Higher discounts unlock fewer time slots"
            />
          </div>
          {error ? <p className="alert">{error}</p> : null}
          <button
            aria-busy={busy}
            className="button full landing-primary-action hunt-start-button"
            disabled={busy || !state.sessionId}
            onClick={startHuntFromLanding}
            type="button"
          >
            {busy
              ? "Searching for vouchers..."
              : state.phone
                ? "Let's Hunt!"
                : "Sign In to Hunt"}
          </button>
          <BottomNav activeTab="home" routeFor={routeFor} />
        </>
      );
    }

    if (step === "signin") {
      return (
        <>
          <GiftIllustration />
          <h2 className="hunt-title">Sign in to start hunting</h2>
          <p className="muted hunt-subtitle">
            Enter your mobile number to save your hunt and referral rewards.
          </p>
          <label className="field" style={{ marginTop: 14 }}>
            <span>Mobile Number</span>
            <input
              value={state.phone}
              onChange={(event) => save({ phone: event.target.value })}
              placeholder="+639171234567"
              inputMode="tel"
            />
          </label>
          {error ? <p className="alert">{error}</p> : null}
          <button
            aria-busy={busy}
            className="button full mobile-bottom-action"
            disabled={busy || !state.phone}
            onClick={signIn}
            type="button"
          >
            Continue
          </button>
        </>
      );
    }

    if (step === "hunt") {
      return (
        <>
          <GiftIllustration />
          <h2 className="hunt-title">Ready to Hunt!</h2>
          <p className="muted hunt-subtitle">
            Spin once to reveal your voucher. If you want another result, share
            your link to earn an extra spin.
          </p>
          <div className="summary-list">
            <SummaryRow
              icon={<FiTag aria-hidden="true" />}
              label="Category"
              value={
                campaign.mode === "restaurant" ? "Restaurant" : "Online Shop"
              }
            />
            <SummaryRow
              icon={<FiShoppingBag aria-hidden="true" />}
              label="Extra Spins"
              value={`Earn up to ${campaign.referralDailyLimit} today by sharing`}
            />
          </div>
          {error ? <p className="alert">{error}</p> : null}
          <button
            aria-busy={busy}
            className="button full mobile-bottom-action hunt-start-button"
            disabled={busy || !state.phone}
            onClick={revealVouchers}
            type="button"
          >
            Start Roulette
          </button>
        </>
      );
    }

    if (step === "roulette") {
      const displayItems =
        rouletteItems.length > 0 ? rouletteItems : placeholderRouletteItems();
      if (roulettePhase === "idle" && !rouletteItems.length && !error) {
        return (
          <div className="roulette-page-content">
            <div className="hunt-loading-emblem" aria-hidden="true">
              <span className="hunt-loading-ring" />
              <FiShoppingBag />
            </div>
            <h2 className="hunt-title">Checking your hunt...</h2>
            <p className="muted hunt-subtitle">
              We&apos;re checking if you already have a voucher result.
            </p>
          </div>
        );
      }
      return (
        <div className="roulette-page-content">
          <p className="muted hunt-subtitle">
            Every possible voucher is in the reel. Watch the arrow land on your
            result.
          </p>
          <div className="roulette-stage roulette-page-stage" aria-hidden="true">
            <span className="roulette-pointer" />
            <div className="roulette-reel-clip">
              <div
                className={`roulette-track ${
                  roulettePhase === "selected"
                    ? "settled"
                    : roulettePhase === "landing"
                      ? "landing"
                      : "searching"
                }`}
                style={rouletteTrackStyle}
              >
                {displayItems.map((item, index) => {
                  const presentation = getVoucherPresentation(item);
                  return (
                    <article
                      className={`card candidate roulette-ticket voucher-${presentation.rarity} ${
                        roulettePhase === "selected" &&
                        index === rouletteTargetIndex
                          ? "selected"
                          : ""
                      }`}
                      key={`${item.displayLabel}-${index}`}
                    >
                      <VoucherCard
                        benefit={item}
                        detail={voucherDetail(item)}
                      />
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="roulette-result-copy">
            <h2 className="hunt-title">
              {rouletteWinner ? "Voucher selected!" : "Spinning now..."}
            </h2>
            <p className="muted hunt-subtitle">
              {rouletteMessage || "Starting the roulette..."}
            </p>
            {error ? <p className="alert">{error}</p> : null}
          </div>
          {pendingSpinCompletion ? (
            <div className="roulette-confirm-actions roulette-page-actions">
              <button
                className="button full"
                onClick={confirmRouletteSelection}
                type="button"
              >
                Confirm Voucher
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (step === "results") {
      return (
        <>
          <h1 className="mobile-h1">Your Voucher Result</h1>
          <p className="muted">
            This is your current roulette result. Continue with it, or share
            your link to earn another spin.
          </p>
          {!visibleResult ? (
            <div className="info-card">
              <p>No voucher result yet.</p>
              <Link
                className="button full"
                href={routeFor("hunt")}
                prefetch={false}
              >
                Start Hunt
              </Link>
            </div>
          ) : (
            <div className="single-result-stack">
              <article
                className={`card candidate single-result-ticket voucher-${getVoucherPresentation(visibleResult).rarity}`}
              >
                <VoucherCard
                  benefit={visibleResult}
                  detail={voucherDetail(visibleResult)}
                />
                <small>Min. spend applies</small>
              </article>
              <div className="result-actions">
                {state.bonusAttempts > 0 ? (
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={huntAgain}
                    type="button"
                  >
                    Spin again ({state.bonusAttempts} available)
                  </button>
                ) : (
                  <button
                    className="button secondary full"
                    onClick={shareReferralLink}
                    type="button"
                  >
                    Share to unlock another spin
                  </button>
                )}
                <p className="muted result-share-note">
                  Extra spins earned today: {state.shareCount} /{" "}
                  {campaign.referralDailyLimit}
                </p>
                {resultMustBeReplaced ? (
                  <p className="alert result-replace-note" role="status">
                    Extra spin unlocked. Spin again to replace this result
                    before continuing.
                  </p>
                ) : null}
              </div>
            </div>
          )}
          <Link
            aria-disabled={!visibleResult || resultMustBeReplaced}
            className={`button full mobile-bottom-action ${
              visibleResult && !resultMustBeReplaced ? "" : "disabled-link"
            }`}
            href={
              visibleResult && !resultMustBeReplaced
                ? routeFor("datetime")
                : routeFor("results")
            }
            onClick={() => {
              if (
                visibleResult &&
                !resultMustBeReplaced &&
                !state.selectedAttemptId
              ) {
                save({ selectedAttemptId: visibleResult.id });
              }
            }}
            prefetch={false}
          >
            Pick date &amp; time
          </Link>
          {shareNotice ? (
            <div
              className={`snackbar ${shareNoticeExiting ? "snackbar-exit" : ""}`}
              role="status"
              aria-live="polite"
            >
              <FiCheckCircle aria-hidden="true" />
              {shareNotice}
            </div>
          ) : null}
        </>
      );
    }

    if (step === "datetime") {
      if (!state.userId || !state.selectedAttemptId) {
        return (
          <div className="info-card">
            <p>Reveal and pick a voucher first.</p>
            <Link
              className="button full"
              href={routeFor("hunt")}
              prefetch={false}
            >
              Back to Hunt
            </Link>
          </div>
        );
      }
      const datetimeDates = Array.from(
        new Set(tierSlots.map((slot) => slot.date)),
      );
      return (
        <>
          {selectedAttempt ? (
            <div className="selected-strip">
              <strong>{selectedAttempt.displayLabel}</strong>
              <Link
                className="button tertiary"
                href={routeFor("results")}
                prefetch={false}
              >
                Change voucher
              </Link>
            </div>
          ) : null}
          <p className="date-helper">
            Choose when to use your{" "}
            <strong>{selectedAttempt?.displayLabel}</strong> voucher.
            {selectedAttempt &&
            getVoucherPresentation(selectedAttempt).rarity !== "standard"
              ? ""
              : ""}
          </p>

          {tierSlots.length === 0 ? (
            <div className="info-card date-empty-state">
              <FiCalendar aria-hidden="true" />
              <p>No time slots are available for this voucher right now.</p>
            </div>
          ) : (
            datetimeDates.map((date) => (
              <div key={date} className="datetime-day">
                <h3 className="date-list-title">{formatDate(date)}</h3>
                <div className="slot-list">
                  {tierSlots
                    .filter((slot) => slot.date === date)
                    .map((slot) => {
                      const slotSoldOut =
                        slot.remainingCapacity <= 0 || slot.status !== "active";
                      return (
                        <button
                          className={`slot-row ${slot.id === state.selectedSlotId ? "active" : ""} ${slotSoldOut ? "sold-out" : ""}`}
                          disabled={slotSoldOut}
                          key={slot.id}
                          onClick={() =>
                            save({
                              selectedSlotId: slot.id,
                              selectedDate: slot.date,
                            })
                          }
                          type="button"
                        >
                          <strong>
                            {formatTime(slot.startTime)} –{" "}
                            {formatTime(slot.endTime)}
                          </strong>
                          <span
                            className={`badge ${slot.remainingCapacity <= 3 ? "warning" : ""} ${slotSoldOut ? "danger" : ""}`}
                          >
                            {slotSoldOut
                              ? "Sold Out"
                              : `${slot.remainingCapacity} left`}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))
          )}

          <div className="info-card share-card">
            <p className="muted">Want more choices?</p>
            <strong>
              Extra chances earned today: {state.shareCount} /{" "}
              {campaign.referralDailyLimit}
            </strong>
            {state.bonusAttempts > 0 ? (
              <button
                className="button full"
                disabled={busy}
                onClick={huntAgain}
                type="button"
              >
                Spin again ({state.bonusAttempts} available)
              </button>
            ) : (
              <button
                className="button secondary full"
                onClick={shareReferralLink}
                type="button"
              >
                Share to unlock another spin
              </button>
            )}
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Share your link. When a friend opens it, you earn one extra
              roulette spin.
            </p>
            {resultMustBeReplaced ? (
              <p className="alert result-replace-note" role="status">
                Extra spin unlocked. Spin again to replace this voucher before
                confirming.
              </p>
            ) : null}
            <p
              className="muted"
              style={{ display: "none", fontSize: "0.8rem" }}
            >
              Share your link — when a friend opens it, an extra voucher appears
              back on your results.
            </p>
          </div>

          {error ? <p className="alert">{error}</p> : null}
          <Link
            aria-disabled={!state.selectedSlotId || resultMustBeReplaced}
            className={`button full mobile-bottom-action ${
              state.selectedSlotId && !resultMustBeReplaced
                ? ""
                : "disabled-link"
            }`}
            href={
              state.selectedSlotId && !resultMustBeReplaced
                ? routeFor("confirm")
                : routeFor("datetime")
            }
            prefetch={false}
          >
            Continue
          </Link>
          {shareNotice ? (
            <div
              className={`snackbar ${shareNoticeExiting ? "snackbar-exit" : ""}`}
              role="status"
              aria-live="polite"
            >
              <FiCheckCircle aria-hidden="true" />
              {shareNotice}
            </div>
          ) : null}
        </>
      );
    }

    if (step === "confirm") {
      return (
        <>
          <p className="muted">
            Confirm your selected voucher and reservation details.
          </p>
          {selectedAttempt ? (
            <article
              className={`card candidate confirm-ticket voucher-${getVoucherPresentation(selectedAttempt).rarity}`}
            >
              <VoucherCard
                benefit={selectedAttempt}
                detail="Selected voucher"
              />
            </article>
          ) : (
            <p className="alert">Select a voucher candidate first.</p>
          )}
          <label className="field">
            <span>Full Name</span>
            <input
              value={state.name}
              onChange={(event) => save({ name: event.target.value })}
              placeholder="Jane Doe"
            />
          </label>
          <label className="field">
            <span>Mobile Number</span>
            <input readOnly value={state.phone} placeholder="+639171234567" />
          </label>
          <label className="field">
            <span>Email(Optional)</span>
            <input
              value={state.email}
              onChange={(event) => save({ email: event.target.value })}
              placeholder="jane@example.com"
            />
          </label>
          {campaign.mode === "restaurant" ? (
            <label className="field">
              <span>Guests</span>
              <input
                value={state.guestCount}
                onChange={(event) => save({ guestCount: event.target.value })}
                min="1"
                max="20"
                type="number"
              />
            </label>
          ) : null}
          <div className="summary-list">
            <SummaryRow
              icon={<FiCalendar aria-hidden="true" />}
              label="Date"
              value={selectedSlot ? formatDate(selectedSlot.date) : "No slot"}
            />
            <SummaryRow
              icon={<FiClock aria-hidden="true" />}
              label="Time"
              value={
                selectedSlot ? formatTime(selectedSlot.startTime) : "No slot"
              }
            />
            <SummaryRow
              icon={<FiTag aria-hidden="true" />}
              label="Category"
              value={
                campaign.mode === "restaurant" ? "Restaurant" : "Online Shop"
              }
            />
          </div>
          {otpRequired ? (
            <div className="otp-block">
              <span className="otp-block-label">
                Phone verification required
              </span>
              {otpVerified ? (
                <p className="otp-verified">
                  <FiCheckCircle aria-hidden="true" /> Phone number verified
                </p>
              ) : (
                <>
                  <button
                    className="button secondary full"
                    disabled={otpBusy || !state.phone}
                    onClick={sendOtp}
                    type="button"
                  >
                    {otpSent
                      ? "Resend Verification Code"
                      : "Send Verification Code"}
                  </button>
                  <div className="otp-verify-row">
                    <input
                      aria-label="6-digit verification code"
                      autoComplete="one-time-code"
                      className={`otp-code-input ${otpCode ? "has-value" : ""}`}
                      disabled={!otpSent || otpBusy}
                      inputMode="numeric"
                      maxLength={6}
                      pattern="[0-9]*"
                      placeholder={
                        otpSent ? "Enter 6-digit code" : "Send a code first"
                      }
                      value={otpCode}
                      onChange={(event) =>
                        setOtpCode(event.target.value.replace(/\D/g, ""))
                      }
                    />
                    <button
                      className="button"
                      disabled={otpBusy || !otpSent || otpCode.length !== 6}
                      onClick={verifyOtpCode}
                      type="button"
                    >
                      Verify
                    </button>
                  </div>
                </>
              )}
              {otpMessage ? (
                <p className="muted otp-message">{otpMessage}</p>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="alert">{error}</p> : null}
          <button
            className="button full mobile-bottom-action"
            disabled={
              busy ||
              !state.name ||
              !state.phone ||
              !state.selectedAttemptId ||
              (otpRequired && !otpVerified)
            }
            onClick={issueFinalVoucher}
            type="button"
          >
            Confirm & Reserve
          </button>
        </>
      );
    }

    if (step === "vouchers") {
      return (
        <div className="voucher-wallet">
          <div className="voucher-wallet-heading">
            <p className="muted">Your claimed vouchers saved on this device.</p>
          </div>
          {claimedVouchers.length > 0 ? (
            <div className="candidate-grid">
              {claimedVouchers.map((item) => (
                <button
                  aria-label={`View details for ${item.voucher.displayLabel}`}
                  className={`card candidate candidate-button wallet-voucher voucher-${getVoucherPresentation(item.voucher).rarity}`}
                  key={item.voucher.id}
                  onClick={() =>
                    navigate(
                      `/campaign/${item.campaignSlug}/vouchers/${item.voucher.id}`,
                    )
                  }
                  type="button"
                >
                  <VoucherCard
                    benefit={item.voucher}
                    code={item.voucher.voucherCode}
                    detail={item.businessName}
                  />
                  <small className="wallet-voucher-meta">
                    {item.campaignTitle} · {formatDate(item.slot.date)} at{" "}
                    {formatTime(item.slot.startTime)}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="info-card">
              <p>No claimed vouchers saved on this device yet.</p>
            </div>
          )}
          <BottomNav activeTab="vouchers" routeFor={routeFor} />
        </div>
      );
    }

    if (step === "voucher") {
      return viewedVoucher ? (
        <div className="confirmation-content voucher-detail-content">
          <h2>{viewedVoucher.voucher.displayLabel}</h2>
          <p className="muted">Show this voucher and QR code at the outlet.</p>
          <article
            className={`card candidate issued-voucher voucher-${getVoucherPresentation(viewedVoucher.voucher).rarity}`}
          >
            <VoucherCard
              benefit={viewedVoucher.voucher}
              code={viewedVoucher.voucher.voucherCode}
              detail={viewedVoucher.businessName}
            />
          </article>
          <div className="qr-code">
            {qrDataUrl ? (
              <Image
                alt={`QR code for voucher ${viewedVoucher.voucher.voucherCode}`}
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
              value={formatDate(viewedVoucher.slot.date)}
            />
            <SummaryRow
              icon={<FiClock aria-hidden="true" />}
              label="Time"
              value={formatTime(viewedVoucher.slot.startTime)}
            />
            <SummaryRow
              icon={<FiCheckCircle aria-hidden="true" />}
              label="Status"
              value={formatVoucherStatus(viewedVoucher.voucher.status)}
            />
          </div>
          <Link
            className="button full mobile-bottom-action"
            href={routeFor("vouchers")}
            prefetch={false}
          >
            Back to My Vouchers
          </Link>
        </div>
      ) : (
        <div className="info-card">
          <p>This voucher is no longer saved on this device.</p>
          <Link
            className="button full"
            href={routeFor("vouchers")}
            prefetch={false}
          >
            Back to My Vouchers
          </Link>
        </div>
      );
    }

    return (
      <>
        {state.issued ? (
          <div className="confirmation-content">
            <div className="confirmation-check">
              <Image
                alt="Confirmed"
                height={76}
                priority
                src="/assets/confirmation-check.png"
                width={76}
              />
            </div>
            <h2>Reservation Confirmed!</h2>
            <p className="muted">
              Here&apos;s your voucher code. Show this QR code at the outlet.
            </p>
            <article
              className={`card candidate issued-voucher voucher-${getVoucherPresentation(state.issued.voucher).rarity}`}
            >
              <VoucherCard
                benefit={state.issued.voucher}
                code={state.issued.voucher.voucherCode}
                detail="Your confirmed reward"
              />
            </article>
            <div className="qr-code">
              {qrDataUrl ? (
                <Image
                  alt={`QR code for voucher ${state.issued.voucher.voucherCode}`}
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
                value={formatDate(state.issued.slot.date)}
              />
              <SummaryRow
                icon={<FiClock aria-hidden="true" />}
                label="Time"
                value={formatTime(state.issued.slot.startTime)}
              />
              <SummaryRow
                icon={<FiCheckCircle aria-hidden="true" />}
                label="Status"
                value="Confirmed"
              />
            </div>
            <button
              className="button full mobile-bottom-action"
              onClick={() => navigate(routeFor("vouchers"))}
              type="button"
            >
              View My Vouchers
            </button>
          </div>
        ) : (
          <div className="info-card">
            <p>No confirmed voucher found on this device.</p>
            <Link
              className="button full"
              href={routeFor("landing")}
              prefetch={false}
            >
              Start Again
            </Link>
          </div>
        )}
      </>
    );
  }

  function selectDate(date: string) {
    const currentSlot = slots.find(
      (slot) => slot.id === state.selectedSlotId && slot.date === date,
    );
    const nextSlot =
      currentSlot ??
      slots.find(
        (slot) =>
          slot.date === date &&
          slot.status === "active" &&
          slot.remainingCapacity > 0,
      );
    const changingSlot = nextSlot?.id !== state.selectedSlotId;
    save({
      selectedDate: date,
      selectedSlotId: nextSlot?.id ?? "",
      ...(changingSlot
        ? { attempts: [], selectedAttemptId: "", issued: null }
        : {}),
    });
  }
}

const modeIcons: Record<Campaign["mode"], ReactNode> = {
  restaurant: <FaUtensils aria-hidden="true" />,
  online_shop: <FaStore aria-hidden="true" />,
  beauty: <FaSpa aria-hidden="true" />,
  pet: <FaPaw aria-hidden="true" />,
  retail: <FaShoppingBag aria-hidden="true" />,
  other: <FaTag aria-hidden="true" />,
};

function CampaignTabs({
  campaigns,
  currentSlug,
}: {
  campaigns: TabCampaign[];
  currentSlug: string;
}) {
  if (campaigns.length === 0) return null;
  return (
    <div className="landing-tabs">
      {campaigns.map((item) => (
        <Link
          className={`landing-tab ${item.slug === currentSlug ? "active" : ""}`}
          href={`/campaign/${item.slug}`}
          key={item.slug}
          prefetch={false}
        >
          {modeIcons[item.mode]}
          {item.title}
        </Link>
      ))}
    </div>
  );
}

function RuleRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="landing-rule-row">
      <span className="landing-rule-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function GiftIllustration() {
  return (
    <svg
      className="hunt-illustration"
      viewBox="0 0 200 200"
      role="img"
      aria-label="Gift box"
    >
      <defs>
        <linearGradient id="giftBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#5c3dff" />
        </linearGradient>
        <linearGradient id="giftLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a74ff" />
          <stop offset="1" stopColor="#6f49ff" />
        </linearGradient>
      </defs>
      {/* soft halo */}
      <circle cx="100" cy="104" r="66" fill="#eeeaff" />
      {/* confetti */}
      <circle cx="40" cy="70" r="4" fill="#f59e0b" />
      <circle cx="164" cy="88" r="4" fill="#22c55e" />
      <circle cx="150" cy="52" r="3.5" fill="#ef4444" />
      <circle cx="58" cy="44" r="3.5" fill="#7c4dff" />
      <circle cx="86" cy="30" r="3" fill="#22c55e" />
      <rect
        x="128"
        y="34"
        width="8"
        height="8"
        rx="2"
        fill="#f59e0b"
        transform="rotate(24 132 38)"
      />
      <rect
        x="34"
        y="98"
        width="8"
        height="8"
        rx="2"
        fill="#7c4dff"
        transform="rotate(-18 38 102)"
      />
      <rect
        x="158"
        y="118"
        width="8"
        height="8"
        rx="2"
        fill="#ef4444"
        transform="rotate(30 162 122)"
      />
      <path
        d="M62 30 q6 6 0 12"
        stroke="#f59e0b"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M150 108 q6 6 0 12"
        stroke="#22c55e"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* box body */}
      <rect x="62" y="98" width="76" height="62" rx="7" fill="url(#giftBody)" />
      {/* lid */}
      <rect x="54" y="80" width="92" height="24" rx="7" fill="url(#giftLid)" />
      {/* ribbon */}
      <rect x="93" y="80" width="14" height="80" fill="#d9ccff" />
      {/* bow */}
      <path
        d="M100 80 C 82 60 66 66 74 80 C 79 89 92 87 100 80 Z"
        fill="#c3b0ff"
      />
      <path
        d="M100 80 C 118 60 134 66 126 80 C 121 89 108 87 100 80 Z"
        fill="#c3b0ff"
      />
      <circle cx="100" cy="80" r="6" fill="#efe9ff" />
    </svg>
  );
}

function BottomNav({
  activeTab,
  routeFor,
}: {
  activeTab: "home" | "vouchers";
  routeFor: (step: PublicStep) => string;
}) {
  return (
    <nav className="landing-bottom-nav" aria-label="Customer navigation">
      <Link
        className={activeTab === "home" ? "active" : ""}
        href={routeFor("landing")}
        prefetch={false}
      >
        <FiHome aria-hidden="true" />
        Home
      </Link>
      <Link
        className={activeTab === "vouchers" ? "active" : ""}
        href={routeFor("vouchers")}
        prefetch={false}
      >
        <FiShoppingBag aria-hidden="true" />
        Vouchers
      </Link>
    </nav>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
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
