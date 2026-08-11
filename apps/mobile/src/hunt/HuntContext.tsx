import type { CampaignSlot, Voucher, VoucherAttempt } from "@bizflow/shared";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getCampaign,
  getHuntState,
  startHunt,
  type HuntState,
  type PublicCampaign,
  type PublicSlot,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { subscribeToHuntReset } from "@/hunt/resetSignal";
import { getVisitorSessionId } from "@/hunt/session";


export type IssuedPayload = { voucher: Voucher; slot: CampaignSlot };

/**
 * Mirrors the web's `FlowState`, minus everything that only existed to survive a
 * page reload. The web persists this to `localStorage` because each step is a
 * separate document; here the steps share one navigator, and a cold start re-reads
 * the authoritative snapshot from `GET /hunt/state`.
 */
type FlowState = {
  userId: string;
  attempts: VoucherAttempt[];
  selectedAttemptId: string;
  selectedSlotId: string;
  selectedDate: string;
  name: string;
  email: string;
  guestCount: string;
  issued: IssuedPayload | null;
  bonusAttempts: number;
  shareCount: number;
};

const emptyFlow: FlowState = {
  userId: "",
  attempts: [],
  selectedAttemptId: "",
  selectedSlotId: "",
  selectedDate: "",
  name: "",
  email: "",
  guestCount: "2",
  issued: null,
  bonusAttempts: 0,
  shareCount: 0,
};

type HuntContextValue = {
  slug: string;
  /** Campaign + business + all slots, from `GET /campaigns/[slug]`. */
  campaign: PublicCampaign | null;
  loading: boolean;
  /** Raw thrown error, so screens can tell offline apart from a server failure. */
  error: unknown;
  /** Re-runs the campaign + snapshot fetch, for a retry affordance. */
  reload: () => void;
  sessionId: string;
  flow: FlowState;
  save: (next: Partial<FlowState>) => void;
  /** Adds a freshly drawn attempt and selects it, keeping earlier spins intact. */
  addAttempt: (attempt: VoucherAttempt) => void;
  /** Registers this phone against the campaign and pulls the hunt snapshot. */
  /**
   * Starts or resumes this campaign and returns the server snapshot used to
   * decide the next screen. Returning it avoids navigating with stale React
   * state while a newly selected campaign is still being hydrated.
   */
  begin: () => Promise<HuntState | null>;
  refreshSnapshot: () => Promise<HuntState | null>;
  selectedAttempt: VoucherAttempt | undefined;
  slotById: (id: string) => PublicSlot | undefined;
};

const HuntContext = createContext<HuntContextValue | null>(null);

/** Newest-wins merge that keeps attempt order stable, as the web's does. */
function mergeAttempts(current: VoucherAttempt[], incoming: VoucherAttempt[]) {
  const byId = new Map(current.map((attempt) => [attempt.id, attempt]));
  for (const attempt of incoming) byId.set(attempt.id, attempt);
  return Array.from(byId.values());
}

function preferredAttemptId(
  attempts: VoucherAttempt[],
  currentId = "",
): string {
  const current = attempts.find((attempt) => attempt.id === currentId);
  if (current?.status === "Candidate" || current?.status === "Held") {
    return current.id;
  }
  return (
    attempts
      .slice()
      .reverse()
      .find(
        (attempt) =>
          attempt.status === "Candidate" || attempt.status === "Held",
      )?.id ??
    attempts.at(-1)?.id ??
    ""
  );
}

export function HuntProvider({ children, slug }: PropsWithChildren<{ slug: string }>) {
  const { token } = useAuth();
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  // Bumped to re-run the load effect without duplicating its body.
  const [reloadToken, setReloadToken] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [flow, setFlow] = useState<FlowState>(emptyFlow);
  // Read by callbacks that must not re-create themselves on every flow change.
  const flowRef = useRef(flow);
  flowRef.current = flow;

  useEffect(() => {
    let active = true;

    async function load() {
      if (!token) return;
      setLoading(true);
      setError(null);
      // Belt and braces alongside the provider's `key`: whatever is in state
      // describes the previous campaign, and showing any of it against a new slug
      // is wrong — an issued voucher most of all.
      setCampaign(null);
      setFlow(emptyFlow);
      try {
        const [session, publicCampaign] = await Promise.all([
          getVisitorSessionId(),
          getCampaign(slug, token),
        ]);
        if (!active) return;
        setSessionId(session);
        setCampaign(publicCampaign);

        // A returning visitor may already have attempts, or even a final voucher.
        // 404 just means they have not started this campaign yet.
        try {
          const snapshot = await getHuntState(slug, token);
          if (!active) return;
          // A campaign allows one final voucher per phone. Carrying it into the
          // flow is what stops the roulette from drawing again and failing with
          // E-DUPLICATE-FINAL — the spin is refused server-side either way, so the
          // app has to route to the issued voucher instead of asking for another.
          const issuedSlot = snapshot.voucher
            ? publicCampaign.slots.find((slot) => slot.id === snapshot.voucher?.slotId)
            : undefined;
          setFlow((current) => ({
            ...current,
            userId: snapshot.user.id,
            attempts: snapshot.attempts,
            selectedAttemptId: preferredAttemptId(
              snapshot.attempts,
              current.selectedAttemptId,
            ),
            bonusAttempts: snapshot.remainingBonusAttempts,
            shareCount: snapshot.sharesGrantedToday,
            name: current.name || snapshot.user.name || "",
            email: current.email || snapshot.user.email || "",
            issued:
              snapshot.voucher && issuedSlot
                ? { voucher: snapshot.voucher, slot: issuedSlot }
                : current.issued,
          }));
        } catch {
          // No hunt session yet — the landing screen's CTA creates one.
        }
      } catch (caught) {
        if (active) setError(caught);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadToken, slug, token]);

  useEffect(
    () =>
      subscribeToHuntReset(() => {
        // The reset endpoint already cleared the authoritative server state.
        // Drop every local continuation marker so the campaign CTA starts a
        // fresh roulette instead of routing to a stale Results screen.
        setFlow({ ...emptyFlow });
        setError(null);
      }),
    [],
  );

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const save = useCallback((next: Partial<FlowState>) => {
    setFlow((current) => ({ ...current, ...next }));
  }, []);

  const addAttempt = useCallback((attempt: VoucherAttempt) => {
    setFlow((current) => ({
      ...current,
      attempts: mergeAttempts(current.attempts, [attempt]),
      selectedAttemptId: attempt.id,
      // A new draw invalidates any slot picked against the previous one.
      selectedSlotId: "",
      selectedDate: "",
      issued: null,
    }));
  }, []);

  const begin = useCallback(async () => {
    if (!token || !sessionId) return null;
    const state = await startHunt({ campaignSlug: slug, sessionId }, token);
    const issuedSlot = state.voucher
      ? campaign?.slots.find((slot) => slot.id === state.voucher?.slotId)
      : undefined;
    setFlow((current) => ({
      ...current,
      userId: state.user.id,
      attempts: state.attempts,
      selectedAttemptId: preferredAttemptId(
        state.attempts,
        current.selectedAttemptId,
      ),
      bonusAttempts: state.remainingBonusAttempts,
      shareCount: state.sharesGrantedToday,
      name: current.name || state.user.name || "",
      email: current.email || state.user.email || "",
      issued:
        state.voucher && issuedSlot
          ? { voucher: state.voucher, slot: issuedSlot }
          : null,
    }));
    return state;
  }, [campaign, sessionId, slug, token]);

  const refreshSnapshot = useCallback(async () => {
    if (!token) return null;
    const snapshot = await getHuntState(slug, token);
    const issuedSlot = snapshot.voucher
      ? campaign?.slots.find((slot) => slot.id === snapshot.voucher?.slotId)
      : undefined;
    setFlow((current) => ({
      ...current,
      userId: snapshot.user.id,
      attempts: snapshot.attempts,
      selectedAttemptId: preferredAttemptId(
        snapshot.attempts,
        current.selectedAttemptId,
      ),
      bonusAttempts: snapshot.remainingBonusAttempts,
      shareCount: snapshot.sharesGrantedToday,
      name: current.name || snapshot.user.name || "",
      email: current.email || snapshot.user.email || "",
      issued:
        snapshot.voucher && issuedSlot
          ? { voucher: snapshot.voucher, slot: issuedSlot }
          : null,
    }));
    return snapshot;
  }, [campaign, slug, token]);

  const selectedAttempt = useMemo(
    () => flow.attempts.find((attempt) => attempt.id === flow.selectedAttemptId),
    [flow.attempts, flow.selectedAttemptId],
  );

  const slotById = useCallback(
    (id: string) => campaign?.slots.find((slot) => slot.id === id),
    [campaign],
  );

  const value = useMemo(
    () => ({
      slug,
      campaign,
      loading,
      error,
      reload,
      sessionId,
      flow,
      save,
      addAttempt,
      begin,
      refreshSnapshot,
      selectedAttempt,
      slotById,
    }),
    [
      addAttempt,
      begin,
      campaign,
      error,
      flow,
      reload,
      loading,
      refreshSnapshot,
      save,
      selectedAttempt,
      sessionId,
      slotById,
      slug,
    ],
  );

  return <HuntContext.Provider value={value}>{children}</HuntContext.Provider>;
}

export function useHunt(): HuntContextValue {
  const value = useContext(HuntContext);
  if (!value) {
    throw new Error("useHunt must be used inside HuntProvider");
  }
  return value;
}
