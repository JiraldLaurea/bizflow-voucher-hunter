import type { VoucherAttempt } from "@bizflow/shared";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ApiError,
  drawAttempt,
  getCampaignPools,
  type RoulettePreview,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, InlineError } from "@/components/FormControls";
import { HuntHeading, StepHeader } from "@/components/HuntUi";
import { getDevPoolId } from "@/dev/devTools";
import { useHunt } from "@/hunt/HuntContext";
import { RouletteReel, type RouletteReelHandle } from "@/hunt/RouletteReel";
import { subscribeToHuntReset } from "@/hunt/resetSignal";
import {
  placeholderRouletteItems,
  rouletteLoop,
  rouletteSequence,
} from "@/hunt/sequence";
import { ReelButton } from "@/hunt/ReelButton";
import { UnlockCelebration } from "@/hunt/UnlockCelebration";
import { useTranslation } from "@/i18n/LanguageContext";
import { voucherDisplayLabel } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

type Phase = "idle" | "searching" | "landing" | "selected";

/** How long the winner sits on screen before the confirm button appears. */
const SETTLE_MS = 450;

/**
 * Step 3 — the reel. The draw is decided server-side the moment the screen opens;
 * the reel free-spins until the visitor taps it, then coasts onto that result. The
 * spin is never what picks the voucher — it only has to land on it.
 */
export default function RouletteScreen() {
  const t = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const {
    addAttempt,
    flow,
    loading,
    refreshSnapshot,
    sessionId,
    slug,
  } = useHunt();
  const issued = flow.issued;
  const reel = useRef<RouletteReelHandle>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState<RoulettePreview[]>(placeholderRouletteItems());
  const [settledIndex, setSettledIndex] = useState<number | null>(null);
  const [winner, setWinner] = useState<RoulettePreview | null>(null);
  const [error, setError] = useState("");
  const [canConfirm, setCanConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // The draw that the reel will land on, once it arrives.
  const pendingStop = useRef<{
    attempt: VoucherAttempt;
    winner: RoulettePreview;
    items: RoulettePreview[];
  } | null>(null);
  // Set when the visitor taps before the draw comes back, so the stop is honoured
  // the moment it does. Without this the tap would be silently dropped.
  const stopRequested = useRef(false);
  // Guards a double-tap from starting two competing stop animations.
  const stopRunning = useRef(false);
  const started = useRef(false);
  const drawAbort = useRef<AbortController | null>(null);
  // Invalidates draw/landing work that began before a development reset.
  const generation = useRef(0);

  const runStop = useCallback(
    async (draw: {
      attempt: VoucherAttempt;
      winner: RoulettePreview;
      items: RoulettePreview[];
    }) => {
      if (stopRunning.current) return;
      const currentGeneration = generation.current;
      stopRunning.current = true;
      // The button reports the coast itself, in place of its own label.
      setPhase("landing");

      const landedIndex = await reel.current?.stopOn(draw.winner, draw.items);
      if (generation.current !== currentGeneration) return;
      setSettledIndex(landedIndex ?? null);
      setWinner(draw.winner);
      setPhase("selected");
      addAttempt(draw.attempt);
      // The web lets the win land for a beat before offering the confirm button.
      setTimeout(() => setCanConfirm(true), SETTLE_MS);
    },
    [addAttempt],
  );

  useEffect(
    () =>
      subscribeToHuntReset(() => {
        generation.current += 1;
        drawAbort.current?.abort();
        drawAbort.current = null;
        pendingStop.current = null;
        stopRequested.current = false;
        stopRunning.current = false;
        reel.current?.reset();
        setPhase("idle");
        setSettledIndex(null);
        setWinner(null);
        setError("");
        setCanConfirm(false);
        setConfirming(false);
      }),
    [],
  );

  useEffect(() => {
    // Wait for the snapshot before drawing. Deciding while it is still in flight
    // would read `issued` as absent and spend a spin the server then refuses.
    if (loading || started.current || !token || !sessionId) return;
    // Already holding this campaign's one final voucher: drawing again would only
    // come back as E-DUPLICATE-FINAL, so show the voucher rather than a dead reel.
    if (issued) {
      started.current = true;
      router.replace({ pathname: "/campaign/[slug]/confirmation", params: { slug } });
      return;
    }
    started.current = true;
    let active = true;

    async function spin() {
      const controller = new AbortController();
      drawAbort.current?.abort();
      drawAbort.current = controller;
      setPhase("searching");
      setError("");
      reel.current?.startSpin();

      try {
        // Public pool previews fill the reel with the campaign's real vouchers.
        // A failure here is not fatal: the placeholders keep it spinning.
        const previews = await getCampaignPools(slug, token!).catch(
          () => [] as RoulettePreview[],
        );
        if (active && previews.length > 0) {
          setItems(rouletteLoop(previews));
        }

        // Dev-only override chosen in the More tab's dev panel. Resolves to "" in
        // production, and the API treats the field as optional.
        const devPoolId = await getDevPoolId(slug);
        const attempt = await drawAttempt(
          {
            campaignSlug: slug,
            sessionId,
            sourceType:
              flow.attempts.length > 0 && flow.bonusAttempts > 0
                ? "referral_bonus"
                : "base",
            ...(devPoolId ? { devPoolId } : {}),
          },
          token!,
          controller.signal,
        );
        if (!active) return;

        const drawWinner: RoulettePreview = {
          benefitType: attempt.benefitType,
          benefitValue: attempt.benefitValue,
          displayLabel: attempt.displayLabel,
          poolId: attempt.poolId,
        };
        const sequence = rouletteSequence(previews, drawWinner);
        setItems(sequence.items);

        const draw = { attempt, winner: drawWinner, items: sequence.items };
        // The draw is settled, but the reel keeps free-spinning and the copy stays
        // put — it only slows down when the visitor taps. If they already tapped
        // while the request was in flight, honour that now.
        if (stopRequested.current) {
          stopRequested.current = false;
          void runStop(draw);
          return;
        }
        pendingStop.current = draw;
      } catch (caught) {
        if (!active || controller.signal.aborted) return;
        reel.current?.reset();
        setPhase("idle");
        // A tap that was waiting on this draw has nothing left to stop.
        stopRequested.current = false;
        // A campaign switch can finish hydrating between opening this screen and
        // the draw request. If the server reports that its base spin was already
        // used, resume the campaign's authoritative attempt rather than showing
        // a dead roulette.
        if (caught instanceof ApiError && caught.code === "E-ATTEMPT-LIMIT") {
          try {
            const snapshot = await refreshSnapshot();
            if (!active) return;
            if (snapshot?.voucher) {
              router.replace({
                pathname: "/campaign/[slug]/confirmation",
                params: { slug },
              });
              return;
            }
            const activeAttempt = snapshot?.attempts.some(
              (attempt) =>
                attempt.status === "Candidate" || attempt.status === "Held",
            );
            if (activeAttempt) {
              router.replace({
                pathname: "/campaign/[slug]/results",
                params: { slug },
              });
              return;
            }
          } catch {
            // Preserve the original draw error if the recovery refresh fails.
          }
        }
        setError(
          caught instanceof Error ? caught.message : t("roulette.revealError"),
        );
      } finally {
        if (drawAbort.current === controller) drawAbort.current = null;
      }
    }

    void spin();
    return () => {
      active = false;
      drawAbort.current?.abort();
      drawAbort.current = null;
    };
  }, [
    flow.attempts.length,
    flow.bonusAttempts,
    issued,
    loading,
    router,
    refreshSnapshot,
    runStop,
    sessionId,
    slug,
    t,
    token,
  ]);

  function handleStop() {
    if (phase !== "searching" || stopRunning.current) return;
    if (!pendingStop.current) {
      // The draw has not landed yet. Move to the coasting state anyway so the
      // press is visibly acknowledged; `spin` honours the request when it does.
      stopRequested.current = true;
      setPhase("landing");
      return;
    }
    const draw = pendingStop.current;
    pendingStop.current = null;
    void runStop(draw);
  }

  function confirmVoucher() {
    setConfirming(true);
    router.push({ pathname: "/campaign/[slug]/results", params: { slug } });
  }

  const stopping = phase === "landing";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader title={t("roulette.title")} />
      <View style={styles.body}>
        <Text style={styles.lead}>{t("roulette.intro")}</Text>

        {/* The reel itself is no longer the target — the button below it is, so
            there is one obvious way to stop and it is not the moving artwork. */}
        <View style={styles.reelWrap}>
          <RouletteReel items={items} ref={reel} settledIndex={settledIndex} />
        </View>

        {/* One fixed-height zone under the reel, so the reel never moves as this
            swaps between stop control, result and error. */}
        <View style={styles.below}>
          {error ? (
            <>
              <HuntHeading title={t("roulette.spinUnavailable")} />
              <InlineError message={error} />
              <View style={styles.action}>
                <Button
                  variant="secondary"
                  onPress={() =>
                    router.replace({ pathname: "/campaign/[slug]", params: { slug } })
                  }
                >
                  {t("results.returnCampaign")}
                </Button>
              </View>
            </>
          ) : (
            <>
              {/* One button, one position, from the first frame to the last. It
                  is the same decision changing hands as the spin resolves, so a
                  second button appearing lower down would read as the screen
                  rearranging itself at the moment it should feel settled. */}
              <ReelButton
                accessibilityLabel={
                  winner ? undefined : t("roulette.tapToStopLabel")
                }
                disabled={winner ? !canConfirm : phase === "idle"}
                label={
                  winner
                    ? confirming
                      ? t("roulette.confirming")
                      : t("roulette.confirm")
                    : stopping
                      ? t("roulette.slowing")
                      : t("roulette.stopReel")
                }
                loading={winner ? confirming : stopping}
                onPress={winner ? confirmVoucher : handleStop}
              />

              {/* The caption under it carries whatever the button is not saying:
                  how to play while spinning, and the win once it lands. The
                  voucher itself is on the ticket above, so this only has to
                  report that the spin resolved — the prize label rides along for
                  screen readers, which cannot scan the reel the way the eye can. */}
              {winner ? (
                <Text
                  accessibilityLabel={t("roulette.youWon", {
                    label: voucherDisplayLabel(t, winner),
                  })}
                  style={styles.unlocked}
                >
                  {t("roulette.unlocked")}
                </Text>
              ) : (
                <Text style={styles.hint}>
                  {stopping ? t("roulette.slowingHint") : t("roulette.stopHint")}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
      {winner ? <UnlockCelebration /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  lead: {
    alignSelf: "center",
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
    maxWidth: 280,
    paddingHorizontal: 18,
    textAlign: "center",
  },
  below: {
    // Fixed, and sized for the tallest state — now the failed-spin one, since
    // the win is a single line. Letting it size to its content moved the reel
    // every time the copy changed.
    height: 180,
    marginTop: spacing.lg,
    paddingHorizontal: 18,
  },
  /** Same 14pt offset as `hint`, so the caption line does not shift as the two
      swap under a button that is holding still. */
  unlocked: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.6,
    lineHeight: 19,
    marginTop: 14,
    textAlign: "center",
    textTransform: "uppercase",
  },
  hint: {
    alignSelf: "center",
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    maxWidth: 280,
    textAlign: "center",
  },
  reelWrap: {
    overflow: "visible",
    position: "relative",
    width: "100%",
  },
  action: {
    marginTop: spacing.lg,
  },
});
