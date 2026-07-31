import type { VoucherAttempt } from "@bizflow/shared";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
import { RouletteReel, TapHint, type RouletteReelHandle } from "@/hunt/RouletteReel";
import { subscribeToHuntReset } from "@/hunt/resetSignal";
import {
  placeholderRouletteItems,
  rouletteLoop,
  rouletteSequence,
} from "@/hunt/sequence";
import { UnlockCelebration } from "@/hunt/UnlockCelebration";
import { useTranslation } from "@/i18n/LanguageContext";
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
  const [message, setMessage] = useState("");
  const [winner, setWinner] = useState<RoulettePreview | null>(null);
  const [error, setError] = useState("");
  const [canConfirm, setCanConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const resultEntrance = useSharedValue(0);

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
      setPhase("landing");
      // No sub-message here: the "Slowing down..." heading already says it.
      setMessage("");

      const landedIndex = await reel.current?.stopOn(draw.winner, draw.items);
      if (generation.current !== currentGeneration) return;
      setSettledIndex(landedIndex ?? null);
      setWinner(draw.winner);
      setPhase("selected");
      // "Selected" reads as though the visitor picked it — the reel landed on it.
      setMessage(t("roulette.youWon", { label: draw.winner.displayLabel }));
      addAttempt(draw.attempt);
      // The web lets the win land for a beat before offering the confirm button.
      setTimeout(() => setCanConfirm(true), SETTLE_MS);
    },
    [addAttempt, t],
  );

  useEffect(
    () =>
      subscribeToHuntReset((resetSlug) => {
        if (resetSlug !== slug) return;
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
        setMessage("");
        setError("");
        setCanConfirm(false);
        setConfirming(false);
      }),
    [slug],
  );

  useEffect(() => {
    if (!winner) {
      resultEntrance.value = 0;
      return;
    }
    resultEntrance.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.back(1.35)),
    });
  }, [resultEntrance, winner]);

  const hasWinner = winner !== null;
  const resultStyle = useAnimatedStyle(() => ({
    opacity: hasWinner ? resultEntrance.value : 1,
    transform: [
      {
        translateY: hasWinner ? (1 - resultEntrance.value) * 8 : 0,
      },
      {
        scale: hasWinner ? 0.92 + resultEntrance.value * 0.08 : 1,
      },
    ],
  }), [hasWinner]);

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
      // One message for the whole spin — changing it when the draw lands mid-spin
      // reads as a glitch.
      setMessage(t("roulette.spinningHint"));
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
        setMessage("");
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

  function handleTap() {
    if (phase !== "searching" || stopRunning.current) return;
    if (!pendingStop.current) {
      stopRequested.current = true;
      return;
    }
    const draw = pendingStop.current;
    pendingStop.current = null;
    void runStop(draw);
  }

  const spinning = phase === "searching";
  // A failed draw drops the phase back to idle with the reel stopped, so the
  // heading must not keep claiming it is spinning.
  const title = error
    ? t("roulette.spinUnavailable")
    : winner
      ? "🎉 Voucher unlocked!"
      : phase === "landing"
        ? t("roulette.slowing")
        : t("roulette.spinning");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader title={t("roulette.title")} />
      <View style={styles.body}>
        <Text style={styles.lead}>
          Every voucher is in the reel — watch the arrow land on your prize!
        </Text>

        <View style={styles.reelWrap}>
          <Pressable
            accessibilityLabel={spinning ? t("roulette.tapToStopLabel") : undefined}
            accessibilityRole={spinning ? "button" : undefined}
            disabled={!spinning}
            onPress={handleTap}
          >
            <RouletteReel items={items} ref={reel} settledIndex={settledIndex} />
          </Pressable>
          {winner ? <UnlockCelebration /> : null}
        </View>
        {/* Keep this slot mounted after the reel stops. Removing it changed the
            body's measured height and made the entire roulette jump vertically. */}
        <TapHint visible={spinning} />

        {/* Everything below the reel lives in one zone that grows as the copy and
            confirm button appear, without moving the reel above it. */}
        <View style={styles.below}>
          <Animated.View style={resultStyle}>
            <HuntHeading subtitle={message || undefined} title={title} />
          </Animated.View>
          {error ? <InlineError message={error} /> : null}
          {error ? (
            <View style={styles.action}>
              <Button
                variant="secondary"
                onPress={() =>
                  router.replace({ pathname: "/campaign/[slug]", params: { slug } })
                }
              >
                Back to campaign
              </Button>
            </View>
          ) : null}
          {winner && canConfirm ? (
            <View style={styles.action}>
              <Button
                loading={confirming}
                loadingLabel={t("roulette.confirming")}
                onPress={() => {
                  setConfirming(true);
                  router.push({
                    pathname: "/campaign/[slug]/results",
                    params: { slug },
                  });
                }}
              >
                Confirm Voucher
              </Button>
            </View>
          ) : null}
        </View>
      </View>
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
    height: 190,
    marginTop: spacing.xl,
    paddingHorizontal: 18,
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
