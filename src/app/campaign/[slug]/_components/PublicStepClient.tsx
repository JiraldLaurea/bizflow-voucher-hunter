"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FaStore, FaUtensils } from "react-icons/fa";
import {
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiGift,
  FiHome,
  FiRefreshCw,
  FiShield,
  FiShoppingBag,
  FiTag,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { api } from "@/lib/api-client";
import type {
  Campaign,
  CampaignSlot,
  Voucher,
  VoucherAttempt,
} from "@/types/voucher";

type PublicSlot = CampaignSlot & { remainingPoolQuantity: number };
type PublicStep =
  | "landing"
  | "date"
  | "time"
  | "hunt"
  | "results"
  | "share"
  | "confirm"
  | "confirmation";
type IssuedPayload = { voucher: Voucher; slot: CampaignSlot };

type FlowState = {
  selectedDate: string;
  selectedSlotId: string;
  sessionId: string;
  name: string;
  phone: string;
  email: string;
  guestCount: string;
  attempts: VoucherAttempt[];
  selectedAttemptId: string;
  issued: IssuedPayload | null;
  shareCount: number;
};

type Props = {
  step: PublicStep;
  campaign: Campaign;
  businessName: string;
  businessLogo: string;
  slots: PublicSlot[];
};

const steps: Array<{ id: PublicStep; label: string; href: string }> = [
  { id: "landing", label: "Campaign Landing", href: "" },
  { id: "date", label: "Select Date", href: "date" },
  { id: "time", label: "Select Time", href: "time" },
  { id: "hunt", label: "Hunt Intro", href: "hunt" },
  { id: "results", label: "Voucher Results", href: "results" },
  { id: "share", label: "Share for Extra Chance", href: "share" },
  { id: "confirm", label: "Confirm & Details", href: "confirm" },
  { id: "confirmation", label: "Confirmation", href: "confirmation" },
];

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

function initialState(slots: PublicSlot[]): FlowState {
  const firstAvailable = slots.find(
    (slot) => slot.status === "active" && slot.remainingCapacity > 0,
  );
  return {
    selectedDate: firstAvailable?.date ?? slots[0]?.date ?? "",
    selectedSlotId: firstAvailable?.id ?? "",
    sessionId: "",
    name: "",
    phone: "",
    email: "",
    guestCount: "2",
    attempts: [],
    selectedAttemptId: "",
    issued: null,
    shareCount: 0,
  };
}

export function PublicStepClient({ step, campaign, slots }: Props) {
  const router = useRouter();
  const storageKey = `bizflow-flow-${campaign.slug}`;
  const [state, setState] = useState<FlowState>(() => initialState(slots));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const sessionKey = "bizflow-session";
    const sessionId =
      window.localStorage.getItem(sessionKey) ?? crypto.randomUUID();
    window.localStorage.setItem(sessionKey, sessionId);
    if (saved) {
      setState({ ...initialState(slots), ...JSON.parse(saved), sessionId });
      return;
    }
    setState({ ...initialState(slots), sessionId });
  }, [slots, storageKey]);

  function save(next: Partial<FlowState>) {
    setState((current) => {
      const updated = { ...current, ...next };
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }

  const currentStepNumber = steps.findIndex((item) => item.id === step) + 1;
  const selectedSlot = slots.find((slot) => slot.id === state.selectedSlotId);
  const selectedAttempt = state.attempts.find(
    (attempt) => attempt.id === state.selectedAttemptId,
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

  function previousRoute(current: PublicStep) {
    const index = steps.findIndex((item) => item.id === current);
    return routeFor(steps[Math.max(0, index - 1)].id);
  }

  function pageTitle() {
    return steps[currentStepNumber - 1]?.label ?? "Voucher Hunt";
  }

  async function startHunting() {
    setError("");
    if (!state.selectedSlotId) {
      setError("Choose an available date and time first.");
      return;
    }
    if (!state.phone) {
      setError(
        "Enter your mobile number so we can enforce one final voucher per user.",
      );
      return;
    }
    setBusy(true);
    try {
      await api("/api/public/hunt/start", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          slotId: state.selectedSlotId,
          phone: state.phone,
          sessionId: state.sessionId,
          name: state.name || "Voucher Hunter",
          email: state.email,
        }),
      });
      const attempts: VoucherAttempt[] = [];
      for (let index = 0; index < campaign.baseAttempts; index += 1) {
        attempts.push(
          await api<VoucherAttempt>("/api/public/hunt/attempt", {
            method: "POST",
            body: JSON.stringify({
              campaignSlug: campaign.slug,
              slotId: state.selectedSlotId,
              phone: state.phone,
              sessionId: state.sessionId,
            }),
          }),
        );
      }
      save({ attempts, selectedAttemptId: attempts[0]?.id ?? "" });
      router.push(routeFor("results"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start voucher hunt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function issueFinalVoucher() {
    setError("");
    if (!state.selectedAttemptId) {
      setError("Choose one voucher candidate first.");
      return;
    }
    if (!state.name || !state.phone) {
      setError("Name and mobile number are required.");
      return;
    }
    setBusy(true);
    try {
      const issued = await api<IssuedPayload>("/api/public/hunt/select", {
        method: "POST",
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          attemptId: state.selectedAttemptId,
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
      save({ issued });
      router.push(routeFor("confirmation"));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to confirm voucher.",
      );
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
            {step === "results" ? (
              <span className="step-back-link" aria-hidden="true" />
            ) : (
              <Link
                aria-label="Back"
                className="step-back-link"
                href={previousRoute(step)}
              >
                <FiChevronLeft aria-hidden="true" />
              </Link>
            )}
            <strong>{pageTitle()}</strong>
            <span className="step-bar-spacer" />
          </div>
        </section>
        <section className="mobile-screen-card">
          {step !== "date" &&
          step !== "hunt" &&
          step !== "time" &&
          step !== "results" ? (
            <>
              <p className="step-eyebrow">Step {currentStepNumber} of 8</p>
              <h1 className="mobile-h1">{pageTitle()}</h1>
            </>
          ) : null}
          {renderStep()}
        </section>
      </div>
    </main>
  );

  function renderStep() {
    if (step === "landing") {
      return (
        <>
          <CampaignTabs campaignMode={campaign.mode} variant="landing" />
          <h1 className="landing-title">
            Choose your time and hunt for a voucher
          </h1>
          <p className="landing-copy">
            Reserve a date and time, then get 3 chances to hunt for amazing
            vouchers!
          </p>
          <div className="landing-hero-art" aria-hidden="true" />
          <div className="landing-rule-card">
            <RuleRow
              icon={<FiShield aria-hidden="true" />}
              text="See remaining vouchers before you play"
            />
            <RuleRow
              icon={<FiClock aria-hidden="true" />}
              text="You get 3 chances to reveal vouchers"
            />
            <RuleRow
              icon={<FiShield aria-hidden="true" />}
              text="Pick 1 final voucher per reservation"
            />
          </div>
          <Link
            className="button full landing-primary-action"
            href={routeFor("date")}
          >
            Let&apos;s Hunt!
          </Link>
          <BottomNav routeFor={routeFor} />
        </>
      );
    }

    if (step === "date") {
      return (
        <>
          <p className="date-helper">
            Choose a date to see available time slots and voucher counts.
          </p>
          <h2 className="date-list-title">
            Available Dates & Remaining Vouchers
          </h2>
          <div className="date-list refined-date-list">
            {dates.map((day) => (
              <button
                className={`date-card refined-date-card ${day.date === state.selectedDate ? "active" : ""} ${day.remaining <= 0 ? "sold-out" : ""}`}
                disabled={day.remaining <= 0}
                key={day.date}
                onClick={() => selectDate(day.date)}
                type="button"
              >
                <strong>{formatShortDate(day.date)}</strong>
                <span
                  className={`badge ${day.remaining <= 5 ? "warning" : ""} ${day.remaining <= 0 ? "danger" : ""}`}
                >
                  {day.remaining > 0
                    ? `${day.remaining} vouchers left`
                    : "Sold Out"}
                </span>
                <FiChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="realtime-note">
            <FiRefreshCw aria-hidden="true" />
            Voucher counts update in real-time.
          </p>
          <div className="mobile-actions">
            <Link className="button secondary full" href={routeFor("landing")}>
              Back
            </Link>
            <Link className="button full" href={routeFor("time")}>
              Continue
            </Link>
          </div>
        </>
      );
    }

    if (step === "time") {
      return (
        <>
          <p className="date-helper">
            Choose an available slot. Remaining vouchers are visible before
            the challenge.
          </p>
          <div className="selected-strip">
            <strong>
              {state.selectedDate
                ? formatDate(state.selectedDate)
                : "No date selected"}
            </strong>
            <Link className="button tertiary" href={routeFor("date")}>
              Change
            </Link>
          </div>
          <div className="slot-list">
            {daySlots.map((slot) => {
              const soldOut =
                slot.remainingCapacity <= 0 ||
                slot.status !== "active" ||
                slot.remainingPoolQuantity <= 0;
              return (
                <button
                  className={`slot-row ${slot.id === state.selectedSlotId ? "active" : ""} ${soldOut ? "sold-out" : ""}`}
                  disabled={soldOut}
                  key={slot.id}
                  onClick={() =>
                    save({
                      selectedSlotId: slot.id,
                      attempts: [],
                      selectedAttemptId: "",
                      issued: null,
                    })
                  }
                  type="button"
                >
                  <strong>{formatTime(slot.startTime)}</strong>
                  <span
                    className={`badge ${slot.remainingCapacity <= 3 ? "warning" : ""} ${soldOut ? "danger" : ""}`}
                  >
                    {soldOut
                      ? "Sold Out"
                      : `${slot.remainingCapacity} slots left`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mobile-actions">
            <Link className="button secondary full" href={routeFor("date")}>
              Back
            </Link>
            <Link
              className={`button full ${state.selectedSlotId ? "" : "disabled-link"}`}
              href={state.selectedSlotId ? routeFor("hunt") : routeFor("time")}
            >
              Continue
            </Link>
          </div>
        </>
      );
    }

    if (step === "hunt") {
      return (
        <>
          <GiftIllustration />
          <h2 className="hunt-title">Ready to Hunt!</h2>
          <p className="muted hunt-subtitle">
            You have <strong>{campaign.baseAttempts}</strong> chances to hunt for
            vouchers.
          </p>
          <div className="summary-list">
            <SummaryRow
              icon={<FiCalendar aria-hidden="true" />}
              label="Date"
              value={
                selectedSlot ? formatDate(selectedSlot.date) : "Select a date"
              }
            />
            <SummaryRow
              icon={<FiClock aria-hidden="true" />}
              label="Time"
              value={
                selectedSlot
                  ? `${formatTime(selectedSlot.startTime)} to ${formatTime(selectedSlot.endTime)}`
                  : "Select a time"
              }
            />
            <SummaryRow
              icon={<FiTag aria-hidden="true" />}
              label="Category"
              value={
                campaign.mode === "restaurant" ? "Restaurant" : "Online Shop"
              }
            />
            <SummaryRow
              icon={<FiShoppingBag aria-hidden="true" />}
              label="Available Vouchers"
              value={
                selectedSlot
                  ? `${selectedSlot.remainingCapacity} slots left`
                  : "Select a slot"
              }
            />
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            <span>Mobile Number</span>
            <input
              value={state.phone}
              onChange={(event) => save({ phone: event.target.value })}
              placeholder="+639171234567"
            />
          </label>
          <p className="limited-note">
            Slot can reserve 1 final voucher from the revealed options.
          </p>
          {error ? <p className="alert">{error}</p> : null}
          <button
            className="button full mobile-bottom-action"
            disabled={busy || !state.phone}
            onClick={startHunting}
            type="button"
          >
            Start Hunting
          </button>
        </>
      );
    }

    if (step === "results") {
      return (
        <>
          <h1 className="mobile-h1">
            Your {campaign.baseAttempts} Hunt Results
          </h1>
          <p className="muted">Pick 1 voucher you like best.</p>
          {state.attempts.length === 0 ? (
            <div className="info-card">
              <p>No voucher candidates yet.</p>
              <Link className="button full" href={routeFor("hunt")}>
                Start Hunt
              </Link>
            </div>
          ) : (
            <div className="candidate-grid">
              {state.attempts.map((attempt, index) => {
                const isSelected = state.selectedAttemptId === attempt.id;
                return (
                  <button
                    className={`card candidate candidate-button ${index === 0 ? "purple" : index === 1 ? "red" : "orange"} ${
                      isSelected ? "selected" : ""
                    }`}
                    key={attempt.id}
                    onClick={() => save({ selectedAttemptId: attempt.id })}
                    type="button"
                  >
                    <span
                      className={`radio ${isSelected ? "radio-selected" : ""}`}
                    >
                      {isSelected ? (
                        <FiCheckCircle aria-hidden="true" />
                      ) : null}
                    </span>
                    <h3>{attempt.displayLabel}</h3>
                    <p>
                      {attempt.benefitType === "free_item"
                        ? "Any dessert"
                        : "On selected items"}
                    </p>
                    <small>Min. spend applies</small>
                  </button>
                );
              })}
            </div>
          )}
          <Link
            className={`button full mobile-bottom-action ${state.selectedAttemptId ? "" : "disabled-link"}`}
            href={
              state.selectedAttemptId
                ? routeFor("share")
                : routeFor("results")
            }
          >
            Continue
          </Link>
        </>
      );
    }

    if (step === "share") {
      return (
        <>
          <div className="share-visual">
            <FiGift aria-hidden="true" />
          </div>
          <h2>Share with friends and get 1 extra chance</h2>
          <p className="muted">
            Share your link. When a friend joins and passes checks, you get 1
            extra chance.
          </p>
          <div className="info-card share-count">
            <p className="muted">Extra chances earned today</p>
            <strong>
              {state.shareCount} / {campaign.referralDailyLimit}
            </strong>
            <p className="muted">
              Up to {campaign.referralDailyLimit} extra chances per day.
            </p>
          </div>
          <button
            className="button full"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              save({
                shareCount: Math.min(
                  campaign.referralDailyLimit,
                  state.shareCount + 1,
                ),
              });
            }}
            type="button"
          >
            Share Now
          </button>
          <Link
            className="button secondary full mobile-button-gap"
            href={routeFor("confirm")}
          >
            Skip for Now
          </Link>
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
            <article className="card candidate purple confirm-ticket">
              <h3>{selectedAttempt.displayLabel}</h3>
              <p>Selected Voucher</p>
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
          <p className="fine-print">
            Mobile number is locked after hunting starts.
          </p>
          <label className="field">
            <span>Email Optional</span>
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
            className="button full mobile-bottom-action"
            disabled={
              busy || !state.name || !state.phone || !state.selectedAttemptId
            }
            onClick={issueFinalVoucher}
            type="button"
          >
            Confirm & Reserve
          </button>
          <p className="fine-print">One final voucher per user.</p>
        </>
      );
    }

    return (
      <>
        {state.issued ? (
          <div className="success-box">
            <div className="checkmark">✓</div>
            <h2>Reservation Confirmed!</h2>
            <p className="muted">
              Here&apos;s your voucher code. Show this QR code at the outlet.
            </p>
            <article className="card candidate purple">
              <h3>{state.issued.voucher.displayLabel}</h3>
              <p>Voucher Code</p>
              <p className="code" style={{ color: "#fff" }}>
                {state.issued.voucher.voucherCode}
              </p>
            </article>
            <div className="qr-box" aria-label="Mock QR code" />
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
              onClick={() => {
                window.localStorage.removeItem(storageKey);
                router.push(routeFor("landing"));
              }}
              type="button"
            >
              View My Vouchers
            </button>
          </div>
        ) : (
          <div className="info-card">
            <p>No confirmed voucher found on this device.</p>
            <Link className="button full" href={routeFor("landing")}>
              Start Again
            </Link>
          </div>
        )}
      </>
    );
  }

  function selectDate(date: string) {
    const nextSlot = slots.find(
      (slot) =>
        slot.date === date &&
        slot.status === "active" &&
        slot.remainingCapacity > 0,
    );
    save({
      selectedDate: date,
      selectedSlotId: nextSlot?.id ?? "",
      attempts: [],
      selectedAttemptId: "",
      issued: null,
    });
  }
}

function CampaignTabs({
  campaignMode,
  variant = "default",
}: {
  campaignMode: Campaign["mode"];
  variant?: "default" | "landing";
}) {
  return (
    <div
      className={
        variant === "landing" ? "landing-tabs" : "persistent-campaign-tabs"
      }
    >
      <Link
        className={`${variant === "landing" ? "landing-tab" : "persistent-campaign-tab"} ${campaignMode === "restaurant" ? "active" : ""}`}
        href="/campaign/july-dinner"
      >
        <FaUtensils aria-hidden="true" />
        Restaurant
      </Link>
      <Link
        className={`${variant === "landing" ? "landing-tab" : "persistent-campaign-tab"} ${campaignMode === "online_shop" ? "active" : ""}`}
        href="/campaign/8pm-drop"
      >
        <FaStore aria-hidden="true" />
        Online Shop
      </Link>
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
      <rect x="128" y="34" width="8" height="8" rx="2" fill="#f59e0b" transform="rotate(24 132 38)" />
      <rect x="34" y="98" width="8" height="8" rx="2" fill="#7c4dff" transform="rotate(-18 38 102)" />
      <rect x="158" y="118" width="8" height="8" rx="2" fill="#ef4444" transform="rotate(30 162 122)" />
      <path d="M62 30 q6 6 0 12" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M150 108 q6 6 0 12" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
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

function BottomNav({ routeFor }: { routeFor: (step: PublicStep) => string }) {
  return (
    <nav className="landing-bottom-nav" aria-label="Customer navigation">
      <Link className="active" href={routeFor("landing")}>
        <FiHome aria-hidden="true" />
        Home
      </Link>
      <Link href={routeFor("confirmation")}>
        <FiShoppingBag aria-hidden="true" />
        My Vouchers
      </Link>
      <Link href={routeFor("share")}>
        <FiUsers aria-hidden="true" />
        Invite
      </Link>
      <Link href={routeFor("confirm")}>
        <FiUser aria-hidden="true" />
        Profile
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
