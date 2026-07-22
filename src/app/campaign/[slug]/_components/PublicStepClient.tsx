"use client";

import Image from "next/image";
import QRCode from "qrcode";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiClock,
  FiMapPin,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiTag,
} from "react-icons/fi";
import { CustomerBottomNav } from "@/app/_components/CustomerBottomNav";
import { api } from "@/lib/api-client";
import {
  isValidPhoneNumber,
  readStoredIdentity,
  rememberIdentity,
} from "@/lib/customer-identity";
import { flowStorageKey, patchFlowState } from "@/lib/flow-storage";
import { resolveCampaignImage } from "@/lib/campaign-image";
import {
  claimedVouchersStorageKey,
  type ClaimedVoucher,
} from "@/lib/voucher-display";
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
  | "confirmation";
type IssuedPayload = { voucher: Voucher; slot: CampaignSlot };
type HuntState = {
  user: { id: string };
  attempts: VoucherAttempt[];
  remainingBaseAttempts: number;
  remainingBonusAttempts: number;
  sharesGrantedToday: number;
  /** Present when this phone already issued a final voucher for the campaign. */
  voucher?: Voucher;
};

type FlowState = {
  selectedDate: string;
  selectedSlotId: string;
  sessionId: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  customerSessionToken: string;
  guestCount: string;
  attempts: VoucherAttempt[];
  selectedAttemptId: string;
  /** Server draw created for a reel that the visitor has not confirmed yet. */
  rouletteInProgressAttemptId: string;
  issued: IssuedPayload | null;
  shareCount: number;
  bonusAttempts: number;
  /** Local-development override used to exercise a specific voucher tier. */
  devVoucherPoolId: string;
};

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
  poolId?: string;
  probabilityWeight?: number;
  remainingQuantity?: number;
};
type RoulettePhase = "idle" | "searching" | "landing" | "selected";
type PendingSpinCompletion = {
  destination?: string;
  nextState: Partial<FlowState>;
};
// The reel free-spins until the visitor taps it; this holds the already-drawn
// result so the tap only has to play the deceleration onto it.
type PendingSpinStop = {
  sequence: RouletteSequenceResult;
  destination?: string;
  nextState: Partial<FlowState>;
};
type RouletteSequenceResult = {
  items: RoulettePreview[];
  winnerIndex: number;
};

const CAMPAIGN_MODE_LABELS: Record<Campaign["mode"], string> = {
  restaurant: "Restaurant",
  online_shop: "Online Shop",
  beauty: "Beauty",
  pet: "Pet",
  retail: "Retail",
  other: "Other",
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
  /** Remembered phone from the cookie, so the server can render signed-in copy. */
  initialPhone?: string;
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
  { id: "hunt", label: "Hunt", href: "hunt" },
  { id: "roulette", label: "Voucher Roulette", href: "roulette" },
  { id: "results", label: "Voucher Results", href: "results" },
  { id: "datetime", label: "Date & Time", href: "datetime" },
  { id: "confirm", label: "Confirm & Details", href: "confirm" },
  { id: "confirmation", label: "Confirmation", href: "confirmation" },
];

// The claimed-voucher wallet is a standalone global page, not a step of this
// flow — a claimed voucher is read from the device and needs no campaign.
const vouchersRoute = "/vouchers";

const visitorSessionCookie = "bizflow_visitor_session";
const devVoucherChoiceEnabled = process.env.NODE_ENV !== "production";

const rouletteCardWidth = 304;
const rouletteGap = 12;
const rouletteSpinCount = 42;
// Distance from one card to the next — the reel's fundamental unit.
const rouletteUnit = rouletteCardWidth + rouletteGap;
const rouletteSpinMs = 10000;
// Constant free-spin velocity, in px/ms (~4.5 cards a second).
const rouletteSpinSpeed = 1.45;
// How far the reel coasts after the tap, in cards, and the shape of that coast.
// The stop duration is derived from these (see runRouletteStop) so the slow-down
// begins at exactly the free-spin speed instead of lurching faster first.
//
// Exponent 2 is exactly constant deceleration — velocity decays linearly to zero,
// the way a real reel loses speed to friction. Higher exponents front-load the
// travel, which lands the reel visually early and leaves a long dead crawl that
// reads as "it already stopped".
const rouletteStopCards = 12;
const rouletteStopEaseExp = 2;
const rouletteSettleMs = 450;

/**
 * Fold a running offset back into a single reel cycle. The track renders its
 * items twice, so a wrapped offset always has a full screen of cards to its
 * right and the jump from the end of one cycle to the start of the next is
 * invisible — that is what makes the spin loop seamlessly instead of snapping
 * back to the first voucher.
 */
function wrapRouletteOffset(offset: number, cycle: number) {
  if (cycle <= 0) return 0;
  return -(((-offset % cycle) + cycle) % cycle);
}

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

function formatCampaignRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+08:00`);
  const end = new Date(`${endDate}T00:00:00+08:00`);
  const monthDay = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  });
  const monthDayYear = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthDay.format(start)} - ${monthDayYear.format(end)}`;
  }
  return `${monthDayYear.format(start)} - ${monthDayYear.format(end)}`;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
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

/**
 * Deceleration used once the visitor taps to stop. Its gradient at progress 0 is
 * rouletteStopEaseExp, which is what lets stopRoulette pick a duration where the
 * coast starts at exactly the free-spin speed — matching velocities across the
 * handoff so the reel never appears to speed up before slowing down.
 */
function rouletteStopEase(progress: number) {
  return 1 - Math.pow(1 - progress, rouletteStopEaseExp);
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
    customerSessionToken: "",
    guestCount: "2",
    attempts: [],
    selectedAttemptId: "",
    rouletteInProgressAttemptId: "",
    issued: null,
    shareCount: 0,
    bonusAttempts: 0,
    devVoucherPoolId: "",
  };
}

function mergeAttempts(current: VoucherAttempt[], incoming: VoucherAttempt[]) {
  const merged = new Map<string, VoucherAttempt>();
  [...current, ...incoming].forEach((attempt) => {
    merged.set(attempt.id, attempt);
  });
  return Array.from(merged.values());
}

function findResumeAttempt(
  serverAttempts: VoucherAttempt[],
  localAttempts: VoucherAttempt[],
  selectedAttemptId: string,
  inProgressAttemptId: string,
) {
  if (inProgressAttemptId) {
    const marked = serverAttempts.find(
      (attempt) => attempt.id === inProgressAttemptId,
    );
    if (marked) return marked;
  }

  const knownIds = new Set(localAttempts.map((attempt) => attempt.id));
  const unknown = [...serverAttempts]
    .reverse()
    .find((attempt) => !knownIds.has(attempt.id));
  return (
    unknown ??
    serverAttempts.find((attempt) => attempt.id === selectedAttemptId) ??
    serverAttempts[serverAttempts.length - 1]
  );
}

// Shimmer placeholder shown while client-only flow state (attempts, selected
// voucher, issued voucher) loads from storage — avoids flashing an empty/"pick
// a voucher first" state on first paint before hydration.
function ContentSkeleton() {
  return (
    <div className="content-skeleton" aria-hidden="true">
      <span className="skeleton-block skeleton-card" />
      <span className="skeleton-block skeleton-bar" />
    </div>
  );
}

function DateTimeSkeleton({ slots }: { slots: PublicSlot[] }) {
  // The selected tier is fetched separately, but the campaign's slot grouping
  // is already available. Reusing that shape reserves a near-identical amount
  // of vertical space while its tier-specific availability is loading.
  const rowCounts = Array.from(
    slots.reduce((counts, slot) => {
      counts.set(slot.date, (counts.get(slot.date) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).values(),
  );
  const groups = rowCounts.length > 0 ? rowCounts : [3, 2, 1];

  return (
    <div
      aria-busy="true"
      aria-label="Loading available dates and times"
      className="datetime-skeleton"
      role="status"
    >
      <div className="datetime-skeleton-selected" aria-hidden="true">
        <span className="skeleton-block skeleton-text skeleton-selected-label" />
        <span className="skeleton-block skeleton-text skeleton-selected-action" />
      </div>
      <div className="datetime-skeleton-helper" aria-hidden="true">
        <span className="skeleton-block skeleton-text" />
        <span className="skeleton-block skeleton-text skeleton-helper-short" />
      </div>
      {groups.map((rowCount, groupIndex) => (
        <div className="datetime-skeleton-day" key={groupIndex} aria-hidden="true">
          <span className="skeleton-block skeleton-text skeleton-day-title" />
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <div className="datetime-skeleton-slot" key={rowIndex}>
              <span className="datetime-skeleton-slot-copy">
                <span className="skeleton-block skeleton-text skeleton-slot-time" />
                <span className="skeleton-block skeleton-text skeleton-slot-note" />
              </span>
              <span className="skeleton-block skeleton-slot-check" />
            </div>
          ))}
        </div>
      ))}
      <div className="datetime-skeleton-share" aria-hidden="true">
        <span className="skeleton-block skeleton-text skeleton-share-title" />
        <span className="skeleton-block skeleton-text skeleton-share-count" />
        <span className="skeleton-block skeleton-bar" />
        <span className="datetime-skeleton-share-note">
          <span className="skeleton-block skeleton-text skeleton-share-note" />
          <span className="skeleton-block skeleton-text skeleton-share-note skeleton-share-note-short" />
        </span>
      </div>
      <span className="skeleton-block skeleton-bar datetime-skeleton-continue" aria-hidden="true" />
      <span className="visually-hidden">Loading available dates and times.</span>
    </div>
  );
}

export function PublicStepClient({
  step,
  campaign,
  businessName,
  slots,
  initialPhone,
}: Props) {
  const storageKey = flowStorageKey(campaign.slug);
  const [state, setState] = useState<FlowState>(() => {
    // Hydration must start from server-provided values only. The mount effect
    // below restores browser-only localStorage state after React has attached.
    const seed = initialPhone || "";
    return {
      ...initialState(slots),
      phone: isValidPhoneNumber(seed) ? seed : "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [shareNoticeExiting, setShareNoticeExiting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [soldOut, setSoldOut] = useState(false);
  const [tierSlots, setTierSlots] = useState<PublicSlot[]>([]);
  const [tierSlotsLoading, setTierSlotsLoading] = useState(
    step === "datetime",
  );
  const [flowHydrated, setFlowHydrated] = useState(false);
  const [referralCheckComplete, setReferralCheckComplete] = useState(false);
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
  const [pendingSpinStop, setPendingSpinStop] =
    useState<PendingSpinStop | null>(null);
  // Confirm is a document navigation, so this stays true until the page swaps.
  const [confirming, setConfirming] = useState(false);
  const rouletteAnimationRef = useRef<number | null>(null);
  // Mirrors rouletteOffset so the animation frames and the stop handler can read
  // the live position without going through a stale render closure.
  const rouletteOffsetRef = useRef(0);
  // Set when the visitor taps before the draw has come back, so the stop can be
  // honoured the moment it does.
  const stopRequested = useRef(false);
  // Guards against a double-tap starting two competing stop animations: the
  // pendingSpinStop state read is a render-old value, so a second tap in the
  // same frame would still see it set.
  const stopRunning = useRef(false);
  // Set once a spin has been confirmed, so the auto-start effect won't run again
  // on this mount while the outgoing navigation is still in flight.
  const spinFinished = useRef(false);
  const autoSignInAttempted = useRef(false);
  const qrToken = state.issued?.voucher.qrToken;

  useEffect(() => {
    return () => {
      if (rouletteAnimationRef.current) {
        window.cancelAnimationFrame(rouletteAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const sessionKey = "bizflow-session";
    const sessionId =
      window.localStorage.getItem(sessionKey) ?? crypto.randomUUID();
    window.localStorage.setItem(sessionKey, sessionId);
    document.cookie = `${visitorSessionCookie}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;

    // A corrupted saved flow must never block hydration (which would leave the
    // page stuck on "Checking sign in..."), so parse defensively and fall back
    // to a fresh flow. setFlowHydrated(true) always runs at the end.
    let next: FlowState = { ...initialState(slots), sessionId };
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved)
        next = {
          ...next,
          ...(JSON.parse(saved) as Partial<FlowState>),
          sessionId,
        };
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    // Carry a remembered number into any campaign whose state has no valid phone
    // yet — covers both brand-new campaigns and stale/empty per-campaign state —
    // so a returning visitor is not asked for their number again.
    const identity = readStoredIdentity();
    if (
      identity?.phone &&
      isValidPhoneNumber(identity.phone) &&
      !isValidPhoneNumber(next.phone)
    ) {
      next.phone = identity.phone;
      next.name = next.name || identity.name || "";
      next.email = next.email || identity.email || "";
    } else if (isValidPhoneNumber(next.phone)) {
      // Already signed in on this campaign (possibly from before this feature):
      // back-fill the shared identity so other campaigns can auto sign-in too.
      rememberIdentity({
        phone: next.phone,
        name: next.name,
        email: next.email,
      });
    } else if (initialPhone && isValidPhoneNumber(initialPhone)) {
      // Cookie said signed-in but local storage had nothing: keep the server's
      // hint so we don't flash back to the signed-out landing.
      next.phone = initialPhone;
    }
    setState(next);
    setFlowHydrated(true);
  }, [slots, storageKey, campaign.slug, initialPhone]);

  // The server-side /visit -> /claim handoff normally records the referral
  // before this page loads. If a reverse proxy or cookie race interrupted that
  // handoff, /claim preserves the ref query and this browser-only fallback
  // retries after the visitor cookie has been established above.
  useEffect(() => {
    if (!flowHydrated || referralCheckComplete) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (step !== "landing" || !ref) {
      setReferralCheckComplete(true);
      return;
    }

    let active = true;
    void api("/api/public/referral/claim", {
      method: "POST",
      body: JSON.stringify({ campaign: campaign.slug, ref }),
    })
      .then(() => {
        if (!active) return;
        params.delete("ref");
        const query = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
        );
      })
      .catch(() => {
        // Keep the ref in the URL. If sign-in is still required, its return URL
        // preserves the query and the claim can be retried after verification.
      })
      .finally(() => {
        if (active) setReferralCheckComplete(true);
      });

    return () => {
      active = false;
    };
  }, [campaign.slug, flowHydrated, referralCheckComplete, step]);

  useEffect(() => {
    if (!flowHydrated || !referralCheckComplete) return;
    const hasPhone = isValidPhoneNumber(state.phone);
    // No remembered number: send to the single global sign-in, returning here after.
    if (!hasPhone) {
      const returnPath = `${window.location.pathname}${window.location.search}`;
      navigate(
        `/signin?next=${encodeURIComponent(returnPath)}`,
      );
      return;
    }
    // Signed in (has a number) but no account for this campaign yet on a deeper
    // step: bounce to the landing where auto sign-in establishes it.
    if (step !== "landing" && !state.userId) {
      navigate(routeFor("landing"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowHydrated, referralCheckComplete, step, state.phone, state.userId]);

  // Returning visitor with a remembered number but no account for this campaign
  // yet: sign in automatically (on the landing) so switching campaigns doesn't re-ask.
  useEffect(() => {
    if (
      !flowHydrated ||
      !referralCheckComplete ||
      autoSignInAttempted.current
    )
      return;
    if (step !== "landing" || state.userId || !isValidPhoneNumber(state.phone))
      return;
    autoSignInAttempted.current = true;
    void signIn({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowHydrated, referralCheckComplete, step, state.phone, state.userId]);

  // Persist a newly issued voucher into the device-wide wallet that the global
  // /vouchers pages read. This flow no longer renders that wallet, so it is a
  // plain read-modify-write rather than component state.
  useEffect(() => {
    const issued = state.issued;
    if (!issued) return;
    try {
      const saved = window.localStorage.getItem(claimedVouchersStorageKey);
      const current: ClaimedVoucher[] = saved ? JSON.parse(saved) : [];
      if (current.some((item) => item.voucher.id === issued.voucher.id)) return;
      window.localStorage.setItem(
        claimedVouchersStorageKey,
        JSON.stringify([
          {
            ...issued,
            campaignSlug: campaign.slug,
            campaignTitle: campaign.title,
            businessName,
          },
          ...current,
        ]),
      );
    } catch {
      /* ignore storage errors */
    }
  }, [businessName, campaign.slug, campaign.title, state.issued]);

  useEffect(() => {
    if (!flowHydrated) return;
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
  }, [flowHydrated, step, state.userId, state.selectedAttemptId]);

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
    // One spin per visit to this screen. Without this a completed spin that
    // returns the phase to "idle" would immediately start another one.
    if (spinFinished.current) return;
    if (!state.phone) {
      setError("Sign in with your mobile number before spinning.");
      return;
    }
    void startRouletteSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, state.sessionId, state.phone, roulettePhase]);

  // Free-spin the reel at a constant speed for as long as it is searching. It
  // only ever stops because the visitor taps it (see stopRoulette), so this runs
  // indefinitely rather than for a fixed number of turns.
  useEffect(() => {
    if (roulettePhase !== "searching") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      applyRouletteOffset(
        rouletteOffsetRef.current - delta * rouletteSpinSpeed,
      );
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roulettePhase]);

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

  function markRouletteInProgress(attemptId: string) {
    // Persist synchronously. A visitor can tap Home on the first animation
    // frame, before React processes a queued state update or the draw request
    // returns, and the next visit still needs to know that the reel was active.
    patchFlowState(campaign.slug, {
      rouletteInProgressAttemptId: attemptId,
    });
    setState((current) => ({
      ...current,
      rouletteInProgressAttemptId: attemptId,
    }));
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
  // The reel is tappable for the whole free spin — including the brief window
  // before the draw returns, where a tap is queued rather than ignored. Keeping
  // this independent of pendingSpinStop is what lets the copy stay constant.
  const isSpinning = roulettePhase === "searching";
  const rouletteWinnerIndex = Math.max(0, rouletteTargetIndex);
  const rouletteTargetOffset = -rouletteWinnerIndex * rouletteUnit;
  // One full pass over the reel. The track renders its items twice, so folding
  // the running offset into this cycle keeps the loop seamless.
  const rouletteCycle =
    (rouletteItems.length || rouletteSpinCount) * rouletteUnit;
  const rouletteAnimatedOffset =
    roulettePhase === "selected"
      ? rouletteTargetOffset
      : wrapRouletteOffset(rouletteOffset, rouletteCycle);
  const rouletteTrackStyle = {
    "--roulette-target-offset": `${rouletteTargetOffset}px`,
    "--roulette-fast-offset": `${Math.round(rouletteTargetOffset * 0.72)}px`,
    "--roulette-slow-offset": `${Math.round(rouletteTargetOffset * 0.88)}px`,
    "--roulette-near-offset": `${Math.round(rouletteTargetOffset * 0.96)}px`,
    "--roulette-final-approach-offset": `${Math.round(rouletteTargetOffset * 0.992)}px`,
    "--roulette-creep-offset": `${Math.round(rouletteTargetOffset * 0.998)}px`,
    "--roulette-spin-duration": `${rouletteDurationMs}ms`,
    // Every phase is JS-driven now, so the tap-to-stop can pick up exactly where
    // the free spin left off instead of jumping back to the first card.
    transform: `translateX(${rouletteAnimatedOffset}px)`,
  } as CSSProperties;
  const rouletteDisplayItems = useMemo(
    () =>
      rouletteItems.length > 0 ? rouletteItems : placeholderRouletteItems(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rouletteItems],
  );
  // The reel is rebuilt only when its contents or phase change — never on the
  // per-frame offset updates that drive the spin, which would otherwise
  // reconcile every card 60 times a second.
  const rouletteCards = useMemo(
    () =>
      // Rendered twice so wrapping the offset by one cycle is invisible.
      [...rouletteDisplayItems, ...rouletteDisplayItems].map((item, index) => {
        const presentation = getVoucherPresentation(item);
        return (
          <article
            className={`card candidate roulette-ticket voucher-${presentation.rarity} ${
              roulettePhase === "selected" && index === rouletteTargetIndex
                ? "selected"
                : ""
            }`}
            key={`${item.displayLabel}-${index}`}
          >
            <VoucherCard benefit={item} detail={voucherDetail(item)} />
          </article>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rouletteDisplayItems, roulettePhase, rouletteTargetIndex],
  );
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

  function landingRouteWithReferral() {
    const landing = routeFor("landing");
    const ref = new URLSearchParams(window.location.search).get("ref");
    return ref
      ? `${landing}?${new URLSearchParams({ ref }).toString()}`
      : landing;
  }

  function previousRoute(current: PublicStep) {
    const index = steps.findIndex((item) => item.id === current);
    return routeFor(steps[Math.max(0, index - 1)].id);
  }

  function pageTitle() {
    return steps[currentStepNumber - 1]?.label ?? "Voucher Hunt";
  }

  function toRoulettePreview(attempt: RoulettePreview): RoulettePreview {
    return {
      poolId: attempt.poolId,
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
      pool.filter((item) => item.displayLabel !== winner.displayLabel).length >
      0
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
    return Array.from(
      { length: count },
      (_, index) => items[index % items.length],
    );
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

  // Single writer for the reel position: keeps the ref (read by animation frames)
  // and the state (read by the render) in step.
  function applyRouletteOffset(value: number) {
    rouletteOffsetRef.current = value;
    setRouletteOffset(Math.round(value * 100) / 100);
  }

  function cancelRouletteAnimation() {
    if (rouletteAnimationRef.current) {
      window.cancelAnimationFrame(rouletteAnimationRef.current);
      rouletteAnimationRef.current = null;
    }
  }

  function animateRouletteBetween(
    fromOffset: number,
    toOffset: number,
    durationMs: number,
    ease: (progress: number) => number,
  ) {
    cancelRouletteAnimation();
    const distance = toOffset - fromOffset;

    return new Promise<void>((resolve) => {
      const startedAt = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        applyRouletteOffset(fromOffset + distance * ease(progress));

        if (progress < 1) {
          rouletteAnimationRef.current = window.requestAnimationFrame(step);
          return;
        }

        rouletteAnimationRef.current = null;
        applyRouletteOffset(toOffset);
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
  // `silent` is used by cross-campaign auto sign-in, where a failure (e.g. the
  // number already claimed a voucher here) must not surface a scary error.
  async function signIn(options?: { silent?: boolean }) {
    setError("");
    if (!isValidPhoneNumber(state.phone)) {
      if (!options?.silent)
        setError("Enter a valid mobile number to sign in and start hunting.");
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
      // Remember the number across campaigns so we can auto sign-in next time.
      rememberIdentity({
        phone: state.phone,
        name: state.name,
        email: state.email,
      });
      // Already holds a voucher for this campaign: they can sign in but not hunt
      // again — send them to their wallet instead of the hunt screen.
      if (started.voucher) {
        saveAndNavigate({ userId: started.user.id }, vouchersRoute);
        return;
      }
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
          attempts: mergeAttempts(state.attempts, activeAttempts),
          selectedAttemptId: pendingAttempt?.id ?? "",
          shareCount: started.sharesGrantedToday,
          bonusAttempts: started.remainingBonusAttempts,
        },
        landingRouteWithReferral(),
      );
    } catch (caught) {
      if (!options?.silent) reportError(caught, "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  // Where a returning visitor left off in this campaign, so "Let's Hunt" resumes
  // instead of restarting. null = no further progress (reveal/spin as normal).
  function resumeRoute(): string | null {
    if (state.issued) return routeFor("confirmation");
    if (state.selectedSlotId) return routeFor("confirm");
    if (state.rouletteInProgressAttemptId) return routeFor("roulette");
    // A drawn voucher (even one highlighted) means the visitor is still choosing
    // on the results screen — they only reach date/time after "Pick date & time".
    const hasActiveAttempt = state.attempts.some(
      (attempt) => attempt.status === "Candidate" || attempt.status === "Held",
    );
    if (hasActiveAttempt) return routeFor("results");
    return null;
  }

  async function startHuntFromLanding() {
    setError("");
    if (!isValidPhoneNumber(state.phone)) return; // inline sign-in form is showing
    // Have a number but no account for this campaign yet (auto sign-in still
    // pending): establish it now; signIn navigates onward on success.
    if (!state.userId) {
      await signIn();
      return;
    }
    const resume = resumeRoute();
    if (resume) {
      navigate(resume);
      return;
    }
    // No slot/voucher yet: resume an existing candidate (results) or spin a new one.
    await revealVouchers();
  }

  /**
   * Runs the reel for one draw. `existingAttempt` re-presents a draw the server
   * already holds instead of taking a new one — used when the visitor left the
   * page mid-spin, so the reveal still costs them a tap rather than being handed
   * over by the refresh.
   */
  async function spinToAttempt(
    sourceType: "base" | "referral_bonus",
    destination?: string,
    extraState: Partial<FlowState> = {},
    existingAttempt?: VoucherAttempt,
  ) {
    markRouletteInProgress(existingAttempt?.id ?? "pending");
    setBusy(true);
    setPendingSpinCompletion(null);
    setPendingSpinStop(null);
    stopRequested.current = false;
    stopRunning.current = false;
    setRoulettePhase("searching");
    setRouletteTargetIndex(0);
    applyRouletteOffset(0);
    setRouletteDurationMs(rouletteSpinMs);
    setRouletteItems(placeholderRouletteItems());
    setRouletteWinner(null);
    // One message for the whole spin — it must not change when the draw lands
    // mid-spin, which read as a glitch.
    setRouletteMessage("Tap the reel when you're ready to stop it.");
    try {
      await nextPaint();
      const previews = await fetchRoulettePreviews();
      if (previews.length > 0) {
        setRouletteItems(rouletteLoop(previews));
      }
      const attempt =
        existingAttempt ??
        (await api<VoucherAttempt>("/api/public/hunt/attempt", {
          method: "POST",
          body: JSON.stringify({
            campaignSlug: campaign.slug,
            phone: state.phone,
            sessionId: state.sessionId,
            sourceType,
            ...(devVoucherChoiceEnabled && state.devVoucherPoolId
              ? { devPoolId: state.devVoucherPoolId }
              : {}),
          }),
        }));
      // The server has consumed the spin, but the customer has not revealed it
      // until the reel stops and they confirm. Persist only the attempt ID so a
      // trip to Home (or a refresh) resumes the same moving reel.
      markRouletteInProgress(attempt.id);
      const winner = toRoulettePreview(attempt);
      const sequence = rouletteSequence(previews, winner);
      setRouletteItems(sequence.items);
      // Where the winner actually lands is decided on tap, in stopRoulette.
      const nextState: Partial<FlowState> = {
        attempts: mergeAttempts(state.attempts, [attempt]),
        selectedAttemptId: attempt.id,
        rouletteInProgressAttemptId: "",
        selectedSlotId: "",
        selectedDate: "",
        issued: null,
        ...extraState,
      };
      // The draw is settled, but the reel keeps free-spinning and the copy stays
      // put: it only slows down when the visitor taps it. If they already tapped
      // while the draw was in flight, honour that now.
      const stop: PendingSpinStop = { sequence, destination, nextState };
      setBusy(false);
      if (stopRequested.current) {
        stopRequested.current = false;
        void runRouletteStop(stop);
        return;
      }
      setPendingSpinStop(stop);
    } catch (caught) {
      markRouletteInProgress("");
      setBusy(false);
      setPendingSpinStop(null);
      setRouletteItems([]);
      setRouletteWinner(null);
      setRouletteTargetIndex(0);
      applyRouletteOffset(0);
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

  /**
   * Visitor tapped the reel. If the draw has already landed we coast to a stop
   * now; if it is still in flight we remember the tap and spinToAttempt honours
   * it on arrival. Either way the on-screen copy never has to change to explain
   * whether the reel is "ready" yet.
   */
  function stopRoulette() {
    if (roulettePhase !== "searching" || stopRunning.current) return;
    if (!pendingSpinStop) {
      stopRequested.current = true;
      return;
    }
    const stop = pendingSpinStop;
    setPendingSpinStop(null);
    void runRouletteStop(stop);
  }

  // Coast the reel to a stop on the already-drawn result.
  async function runRouletteStop({
    sequence,
    destination,
    nextState,
  }: PendingSpinStop) {
    const winner = sequence.items[sequence.winnerIndex];
    if (!winner) return;
    stopRunning.current = true;

    setBusy(true);
    // Leaving "searching" tears down the free-spin loop above.
    setRoulettePhase("landing");
    // No sub-message here: the "Slowing down..." heading already says it.
    setRouletteMessage("");

    const items = sequence.items;
    const count = items.length;
    const cycle = count * rouletteUnit;

    // The winner only occurs once per cycle, so chasing it would give a stop
    // distance anywhere from 0 to a full cycle — either a jarring stop or a
    // 15-second crawl. Instead, coast a fixed, natural distance and move the
    // winner to whichever card lands under the pointer. That card is ~8 ahead,
    // well off-screen, so the swap is never visible.
    const from = wrapRouletteOffset(rouletteOffsetRef.current, cycle);
    const landingIndex = Math.round(
      (-from + rouletteStopCards * rouletteUnit) / rouletteUnit,
    );
    const wrappedIndex = ((landingIndex % count) + count) % count;
    const landedItems = items.slice();
    landedItems[wrappedIndex] = winner;
    setRouletteItems(landedItems);
    setRouletteTargetIndex(wrappedIndex);

    const targetOffset = -wrappedIndex * rouletteUnit;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyRouletteOffset(targetOffset);
    } else {
      cancelRouletteAnimation();
      const to = -landingIndex * rouletteUnit;
      const distance = from - to;
      // Duration that makes the ease-out's opening speed equal the free-spin
      // speed: |x'(0)| = distance * exp / duration, solved for duration.
      const durationMs = (distance * rouletteStopEaseExp) / rouletteSpinSpeed;
      setRouletteDurationMs(Math.round(durationMs));
      await animateRouletteBetween(from, to, durationMs, rouletteStopEase);
      applyRouletteOffset(targetOffset);
    }

    setRouletteWinner(winner);
    setRoulettePhase("selected");
    // "Selected" reads as though the visitor picked it — the reel landed on it.
    setRouletteMessage(`You won ${winner.displayLabel}`);
    await sleep(rouletteSettleMs);
    setPendingSpinCompletion({ destination, nextState });
  }

  function confirmRouletteSelection() {
    if (!pendingSpinCompletion || confirming) return;
    const { destination, nextState } = pendingSpinCompletion;
    // This spin is done; the auto-start effect must not begin another one.
    spinFinished.current = true;
    setPendingSpinStop(null);

    if (destination) {
      // Document navigation. Leave the reel showing its result and keep the
      // button in a loading state — tearing the reel down here would flash the
      // "Checking your hunt..." screen and, via phase "idle", kick off a whole
      // new spin behind the outgoing page.
      setConfirming(true);
      saveAndNavigate(nextState, destination);
      return;
    }

    // Staying put: reset the reel so a later spin starts clean.
    setPendingSpinCompletion(null);
    setRouletteItems([]);
    setRouletteWinner(null);
    setRouletteTargetIndex(0);
    applyRouletteOffset(0);
    setRouletteDurationMs(rouletteSpinMs);
    setRoulettePhase("idle");
    setRouletteMessage("");
    setBusy(false);
    save(nextState);
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
          attempts: state.attempts,
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
      const pendingAttempt = findResumeAttempt(
        attempts,
        state.attempts,
        state.selectedAttemptId,
        state.rouletteInProgressAttemptId,
      );
      if (pendingAttempt) {
        const alreadyRevealed = state.attempts.some(
          (attempt) => attempt.id === pendingAttempt.id,
        );
        saveAndNavigate(
          alreadyRevealed
            ? {
                attempts: mergeAttempts(state.attempts, attempts),
                selectedAttemptId: pendingAttempt.id,
                rouletteInProgressAttemptId: "",
                shareCount: snapshot.sharesGrantedToday,
                bonusAttempts: snapshot.remainingBonusAttempts,
              }
            : {
                rouletteInProgressAttemptId: pendingAttempt.id,
                shareCount: snapshot.sharesGrantedToday,
                bonusAttempts: snapshot.remainingBonusAttempts,
              },
          routeFor(alreadyRevealed ? "results" : "roulette"),
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
      const pendingAttempt = findResumeAttempt(
        attempts,
        state.attempts,
        state.selectedAttemptId,
        state.rouletteInProgressAttemptId,
      );
      if (pendingAttempt) {
        const alreadyRevealed = state.attempts.some(
          (attempt) => attempt.id === pendingAttempt.id,
        );
        if (!alreadyRevealed) {
          await spinToAttempt(
            pendingAttempt.sourceType === "referral_bonus"
              ? "referral_bonus"
              : "base",
            routeFor("results"),
            {
              shareCount: snapshot.sharesGrantedToday,
              bonusAttempts: snapshot.remainingBonusAttempts,
            },
            pendingAttempt,
          );
          return;
        }
        if (snapshot.remainingBonusAttempts <= 0) {
          saveAndNavigate(
            {
              attempts: mergeAttempts(state.attempts, attempts),
              selectedAttemptId: pendingAttempt.id,
              rouletteInProgressAttemptId: "",
              shareCount: snapshot.sharesGrantedToday,
              bonusAttempts: snapshot.remainingBonusAttempts,
            },
            routeFor("results"),
          );
          return;
        }
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
      setTierSlotsLoading(false);
      return;
    }
    setTierSlotsLoading(true);
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
    } finally {
      setTierSlotsLoading(false);
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
    // The confirm button stays enabled even when details are missing, so a tap
    // always tells the visitor exactly what still needs filling in. Checks run in
    // the order the fields appear on the form.
    if (!state.name.trim()) {
      setError("Missing full name.");
      return;
    }
    if (!state.phone) {
      setError("Missing mobile number.");
      return;
    }
    if (campaign.mode === "restaurant" && !(Number(state.guestCount) >= 1)) {
      setError("Missing number of guests.");
      return;
    }
    if (!state.selectedAttemptId) {
      setError("Missing voucher — choose one voucher candidate first.");
      return;
    }
    if (!state.selectedSlotId) {
      setError("Missing date & time — choose an available slot first.");
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
      // Deliberately stay busy: this is a document navigation, so clearing it
      // here would drop the button back to its idle label while the browser is
      // still loading the confirmation page.
    } catch (caught) {
      setBusy(false);
      reportError(caught, "Unable to confirm voucher.");
    }
  }

  // Bottom nav is shown on every step but highlights nothing: the tabbed screens
  // (home, vouchers, more) are all standalone global pages, not steps of this flow.
  const bottomTab: "home" | "vouchers" | "more" | undefined = undefined;

  if (step === "landing") {
    return (
      <main className="mobile-flow-shell landing-flow-shell">
        <div className="mobile-app-frame landing-app-frame">
          <section className="landing-app-bar">
            <strong>Voucher Hunt</strong>
          </section>
          <section className="landing-screen">{renderStep()}</section>
          {isValidPhoneNumber(state.phone) ? (
            <BottomNav activeTab={bottomTab} />
          ) : null}
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
            step === "signin" ||
            step === "roulette" ? (
              <span className="step-back-link" aria-hidden="true" />
            ) : (
              <Link
                aria-label="Back"
                className="step-back-link"
                href={previousRoute(step)}
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
          className={`mobile-screen-card ${step === "roulette" ? "roulette-screen" : ""}`}
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
        <BottomNav activeTab={bottomTab} />
      </div>
    </main>
  );

  function renderStep() {
    if (step === "landing") {
      // Signed-out visitors are sent to the global /signin (by the server and the
      // redirect effect), so the landing only renders the signed-in hunt screen.
      if (!isValidPhoneNumber(state.phone)) {
        return <ContentSkeleton />;
      }
      const campaignImage = resolveCampaignImage(campaign);
      return (
        <>
          <article className="campaign-landing-card">
            {campaignImage ? (
              <div className="campaign-landing-media">
                <Image
                  alt={campaignImage.alt}
                  fill
                  priority
                  sizes="(max-width: 480px) calc(100vw - 72px), 352px"
                  src={campaignImage.src}
                  unoptimized={campaignImage.src.startsWith("data:")}
                />
                <span className={`campaign-landing-category mode-${campaign.mode}`}>
                  {CAMPAIGN_MODE_LABELS[campaign.mode]}
                </span>
              </div>
            ) : null}
            <div className="campaign-landing-body">
              <div>
                <span className="campaign-landing-eyebrow">Selected campaign</span>
                <h1>{campaign.title}</h1>
                <p className="campaign-landing-business">{businessName}</p>
              </div>
              <p className="campaign-landing-offer">{campaign.offerMessage}</p>
              <div className="campaign-landing-meta">
                <span>
                  <FiMapPin aria-hidden="true" />
                  {campaign.location ?? "Location to be announced"}
                </span>
                <span>
                  <FiCalendar aria-hidden="true" />
                  {formatCampaignRange(campaign.startDate, campaign.endDate)}
                </span>
              </div>
            </div>
          </article>
          <div className="landing-action-intro">
            <h2>Ready to hunt?</h2>
            <p>Spin the voucher roulette, then pick your date &amp; time.</p>
          </div>
          <div className="landing-rule-card">
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
              : resumeRoute()
                ? "Continue"
                : "Let's Hunt!"}
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
      if (roulettePhase === "idle" && !rouletteItems.length && !error) {
        return (
          <div className="roulette-page-content roulette-page-content--loading">
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
        <div className="roulette-page-content roulette-page-content--reel">
          <p className="muted hunt-subtitle roulette-lead">
            Every voucher is in the reel — watch the arrow land on your prize!
          </p>
          <div
            className={`roulette-stage roulette-page-stage ${
              isSpinning ? "is-stoppable" : ""
            }`}
            aria-hidden={isSpinning ? undefined : true}
            role={isSpinning ? "button" : undefined}
            tabIndex={isSpinning ? 0 : undefined}
            aria-label={isSpinning ? "Tap to stop the voucher reel" : undefined}
            onClick={isSpinning ? stopRoulette : undefined}
            onKeyDown={
              isSpinning
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      stopRoulette();
                    }
                  }
                : undefined
            }
          >
            {isSpinning ? (
              <span className="roulette-tap-hint">Tap to stop</span>
            ) : null}
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
                {rouletteCards}
              </div>
            </div>
          </div>
          {/* Everything below the reel lives in one zone that grows/shrinks as the
              copy and confirm button appear, without moving the reel above it. */}
          <div className="roulette-below">
            <div
              className={`roulette-result-copy ${rouletteWinner ? "is-winner" : ""}`}
            >
              <h2 className="hunt-title roulette-result-title">
                {rouletteWinner
                  ? "🎉 Voucher unlocked!"
                  : roulettePhase === "landing"
                    ? "Slowing down..."
                    : "Spinning now..."}
              </h2>
              {rouletteMessage ? (
                <p className="muted hunt-subtitle">{rouletteMessage}</p>
              ) : null}
              {error ? <p className="alert">{error}</p> : null}
            </div>
            {pendingSpinCompletion ? (
              <div className="roulette-confirm-actions roulette-page-actions">
                <button
                  aria-busy={confirming}
                  className="button full"
                  disabled={confirming}
                  onClick={confirmRouletteSelection}
                  type="button"
                >
                  {confirming ? (
                    <>
                      <span className="button-spinner" aria-hidden="true" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm Voucher"
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    if (step === "results") {
      return (
        <>
          <h1 className="mobile-h1">Your Voucher Options</h1>
          <p className="muted">
            Pick the voucher you want to continue with. Extra spins add more
            options here.
          </p>
          {!flowHydrated ? (
            <ContentSkeleton />
          ) : state.attempts.length === 0 ? (
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
              <div className="candidate-grid">
                {state.attempts.map((attempt) => {
                  const presentation = getVoucherPresentation(attempt);
                  const selected = attempt.id === state.selectedAttemptId;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`card candidate candidate-button single-result-ticket voucher-${presentation.rarity} ${
                        selected ? "selected" : ""
                      }`}
                      key={attempt.id}
                      onClick={() =>
                        save({
                          selectedAttemptId: attempt.id,
                          selectedDate: "",
                          selectedSlotId: "",
                          issued: null,
                        })
                      }
                      type="button"
                    >
                      <VoucherCard
                        benefit={attempt}
                        detail={voucherDetail(attempt)}
                      />
                      <small>Min. spend applies</small>
                    </button>
                  );
                })}
              </div>
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
                <p className="muted result-share-hint">
                  Share your link. When a friend opens it, you earn one extra
                  roulette spin.
                </p>
                <p className="muted result-share-note">
                  Extra spins earned today: {state.shareCount} /{" "}
                  {campaign.referralDailyLimit}
                </p>
              </div>
            </div>
          )}
          <Link
            aria-disabled={!selectedAttempt}
            className={`button full mobile-bottom-action ${
              selectedAttempt ? "" : "disabled-link"
            }`}
            href={selectedAttempt ? routeFor("datetime") : routeFor("results")}
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
      if (!flowHydrated) {
        return <DateTimeSkeleton slots={slots} />;
      }
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
      if (tierSlotsLoading) {
        return <DateTimeSkeleton slots={slots} />;
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
            Pick a time to use your{" "}
            <strong>{selectedAttempt?.displayLabel}</strong> voucher.
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
                      const selected = slot.id === state.selectedSlotId;
                      const low = slot.remainingCapacity <= 3;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`slot-row ${selected ? "active" : ""} ${slotSoldOut ? "sold-out" : ""}`}
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
                          <span className="slot-row-main">
                            <span className="slot-row-time">
                              {formatTime(slot.startTime)} –{" "}
                              {formatTime(slot.endTime)}
                            </span>
                            <span
                              className={`slot-row-note ${low && !slotSoldOut ? "low" : ""} ${slotSoldOut ? "gone" : ""}`}
                            >
                              {slotSoldOut
                                ? "Fully booked"
                                : low
                                  ? `Only ${slot.remainingCapacity} spots left`
                                  : `${slot.remainingCapacity} spots available`}
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="slot-row-check"
                          >
                            {selected ? <FiCheck /> : null}
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
            aria-disabled={!state.selectedSlotId}
            className={`button full mobile-bottom-action ${
              state.selectedSlotId ? "" : "disabled-link"
            }`}
            href={
              state.selectedSlotId ? routeFor("confirm") : routeFor("datetime")
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
          {!flowHydrated ? (
            <ContentSkeleton />
          ) : selectedAttempt ? (
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
            <div className="field-readonly-value">
              <span>{state.phone || "—"}</span>
            </div>
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
          {error ? <p className="alert">{error}</p> : null}
          <button
            aria-busy={busy}
            className="button full mobile-bottom-action"
            disabled={busy}
            onClick={issueFinalVoucher}
            type="button"
          >
            {busy ? (
              <>
                <span className="button-spinner" aria-hidden="true" />
                Reserving...
              </>
            ) : (
              "Confirm & Reserve"
            )}
          </button>
        </>
      );
    }

    return (
      <>
        {!flowHydrated ? (
          <ContentSkeleton />
        ) : state.issued ? (
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
              onClick={() => navigate(vouchersRoute)}
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
}: {
  activeTab?: "home" | "vouchers" | "more";
}) {
  // Home = campaign directory; Vouchers/More = global routes.
  return (
    <CustomerBottomNav
      active={activeTab}
      homeHref="/"
      vouchersHref="/vouchers"
      moreHref="/more"
    />
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
