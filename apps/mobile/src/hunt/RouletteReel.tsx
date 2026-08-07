import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { RoulettePreview } from "@/api/client";
import { VoucherTicket } from "@/components/VoucherTicket";
import { useTranslation } from "@/i18n/LanguageContext";
import { voucherDetail } from "@/lib/format";
import { colors, radius } from "@/theme";

/* Reel geometry and motion constants — copied from the web `PublicStepClient` so
   the spin feels identical. Changing one here means changing it there too. */
const CARD_WIDTH = 304;
const GAP = 12;
/** Distance from one card to the next — the reel's fundamental unit. */
const UNIT = CARD_WIDTH + GAP;
/** Constant free-spin velocity in px/ms (~4.5 cards a second). */
const SPIN_SPEED = 1.45;
/** How far the reel coasts after the tap, in cards. */
const STOP_CARDS = 12;
/**
 * Exponent 2 is exactly constant deceleration — velocity decays linearly to zero,
 * the way a real reel loses speed to friction. It also makes the coast's opening
 * speed derivable, which is what lets `stopOn` pick a duration that starts at
 * exactly the free-spin speed instead of lurching faster first.
 */
const STOP_EASE_EXP = 2;

/**
 * Fold a running offset back into a single reel cycle. The track renders its items
 * twice, so a wrapped offset always has a full screen of cards to its right and the
 * jump from one cycle to the next is invisible — that is what makes the spin loop
 * seamlessly instead of snapping back to the first voucher.
 */
function wrapOffset(offset: number, cycle: number) {
  "worklet";
  if (cycle <= 0) return 0;
  return -(((-offset % cycle) + cycle) % cycle);
}

export type RouletteReelHandle = {
  /** Begins the indefinite constant-speed free spin. */
  startSpin: () => void;
  /**
   * Coasts to a stop with `winner` under the pointer. Resolves once settled,
   * returning the index it landed on.
   *
   * `sourceItems` is passed explicitly rather than read from the prop because the
   * visitor can tap before the draw returns: the caller then sets the sequence and
   * stops in the same tick, so the rendered prop is still a render behind.
   */
  stopOn: (winner: RoulettePreview, sourceItems: RoulettePreview[]) => Promise<number>;
  reset: () => void;
};

type Props = {
  items: RoulettePreview[];
  /** Highlights the landed card once the reel has settled. */
  settledIndex: number | null;
};

function WinnerRouletteCard({ item }: { item: RoulettePreview }) {
  const t = useTranslation();
  const pop = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    pop.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.back(1.55)),
    });
    shine.value = withDelay(
      260,
      withTiming(1, {
        duration: 820,
        easing: Easing.out(Easing.cubic),
      }),
    );

    return () => {
      cancelAnimation(pop);
      cancelAnimation(shine);
    };
  }, [pop, shine]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - pop.value) * 8 },
      { scale: 0.94 + pop.value * 0.06 },
    ],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: Math.sin(shine.value * Math.PI) * 0.58,
    transform: [
      { translateX: -100 + shine.value * (CARD_WIDTH + 190) },
      { rotate: "18deg" },
    ],
  }));

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <View pointerEvents="none" style={styles.winnerFrame} />
      <VoucherTicket
        benefit={item}
        detail={voucherDetail(t, item)}
        minHeight={172}
        selected
        width={CARD_WIDTH}
      />
      <View pointerEvents="none" style={styles.shineClip}>
        <Animated.View style={[styles.shine, shineStyle]} />
      </View>
    </Animated.View>
  );
}

export const RouletteReel = forwardRef<RouletteReelHandle, Props>(
  function RouletteReel({ items, settledIndex }, ref) {
    const t = useTranslation();
    const { width } = useWindowDimensions();
    const offset = useSharedValue(0);
    const spinning = useSharedValue(false);
    // The stop swaps the winner onto whichever card lands under the pointer, so
    // the reel owns its own copy of the list rather than rendering the prop.
    const [reelItems, setReelItems] = useState(items);
    const itemsRef = useRef(items);
    // Always points at the sequence currently painted on screen. The final draw
    // sequence may arrive between frames, but a stop must continue from what the
    // visitor can actually see rather than swapping the whole strip beneath them.
    const renderedItemsRef = useRef(items);

    useEffect(() => {
      if (itemsRef.current === items) return;
      itemsRef.current = items;
      renderedItemsRef.current = items;
      setReelItems(items);
    }, [items]);

    const count = reelItems.length;
    const cycle = count * UNIT;
    const cycleValue = useSharedValue(cycle);
    // Assigned in an effect, not during render: Reanimated's strict mode warns on
    // shared-value writes from the render phase, since the UI thread can read a
    // value React may still discard.
    useEffect(() => {
      cycleValue.value = cycle;
    }, [cycle, cycleValue]);

    // Drives the free spin. Reanimated's frame callback runs on the UI thread, so
    // the reel keeps its constant velocity even while JS is busy with the draw
    // request — the web's rAF loop competes with the same work on one thread.
    useFrameCallback((frame) => {
      if (!spinning.value) return;
      // A delayed frame should not teleport the reel forward. Limiting catch-up
      // to two frames trades an imperceptible speed dip for visibly smooth motion.
      const delta = Math.min(frame.timeSincePreviousFrame ?? 16, 32);
      offset.value = offset.value - delta * SPIN_SPEED;
    }, true);

    useImperativeHandle(
      ref,
      () => ({
        startSpin() {
          offset.value = 0;
          spinning.value = true;
        },
        stopOn(winner, sourceItems) {
          return new Promise<number>((resolve) => {
            spinning.value = false;
            const visibleItems =
              renderedItemsRef.current.length > 0
                ? renderedItemsRef.current
                : sourceItems;
            const stopCount = visibleItems.length;
            const stopCycle = stopCount * UNIT;
            cycleValue.value = stopCycle;
            // Keep the raw running position. Normalising it back into the first
            // reel cycle is visually equivalent in theory, but Android can expose
            // that cycle swap as a small one-frame horizontal snap.
            const rawFrom = offset.value;
            const wrappedFrom = wrapOffset(rawFrom, stopCycle);

            // The winner occurs once per cycle, so chasing it would give a stop
            // distance anywhere from zero to a full cycle — either a jarring stop
            // or a long crawl. Instead coast a fixed, natural distance and move
            // the winner to whichever card lands under the pointer. That card is
            // ~12 ahead, well off-screen, so the swap is never visible.
            const landingIndex = Math.round(
              (-wrappedFrom + STOP_CARDS * UNIT) / UNIT,
            );
            const wrappedIndex = ((landingIndex % stopCount) + stopCount) % stopCount;
            const landed = visibleItems.slice();
            landed[wrappedIndex] = winner;
            // Adopting `sourceItems` as the ref's value stops the prop-sync below
            // from immediately overwriting the landed card once the parent renders.
            itemsRef.current = sourceItems;
            renderedItemsRef.current = landed;
            setReelItems(landed);

            const wrappedTarget = -landingIndex * UNIT;
            const distance = wrappedFrom - wrappedTarget;
            // Move forward from the exact raw offset already on screen. The track
            // continues to wrap this value for rendering, so no cycle reset is
            // needed either at the tap or after settling.
            const rawTarget = rawFrom - distance;
            // Duration that makes the ease-out's opening speed equal the free-spin
            // speed: |x'(0)| = distance * exp / duration, solved for duration.
            const duration = (distance * STOP_EASE_EXP) / SPIN_SPEED;

            offset.value = withTiming(
              rawTarget,
              { duration, easing: Easing.out(Easing.quad) },
              () => {
                "worklet";
                runOnJS(resolve)(wrappedIndex);
              },
            );
          });
        },
        reset() {
          spinning.value = false;
          cancelAnimation(offset);
          offset.value = 0;
          renderedItemsRef.current = itemsRef.current;
          setReelItems(itemsRef.current);
        },
      }),
      [cycleValue, offset, spinning],
    );

    const trackStyle = useAnimatedStyle(() => ({
      // Keep the active reel in the middle copy. Landing exactly at offset zero
      // would otherwise put the winner at the start of the track with no card to
      // render on its left.
      transform: [
        {
          translateX:
            wrapOffset(offset.value, cycleValue.value) - cycleValue.value,
        },
      ],
    }));

    // Render the previous, active and next cycles so a settled voucher always has
    // a neighbour on both sides, including at the exact cycle boundary.
    const cards = useMemo(
      () =>
        [...reelItems, ...reelItems, ...reelItems].map((item, index) => {
          const selected =
            settledIndex !== null &&
            index % Math.max(1, reelItems.length) === settledIndex;

          if (selected) {
            return (
              <WinnerRouletteCard
                item={item}
                key={`${item.displayLabel}-${index}`}
              />
            );
          }

          return (
            <View key={`${item.displayLabel}-${index}`} style={styles.card}>
              <VoucherTicket
                benefit={item}
                detail={voucherDetail(t, item)}
                minHeight={172}
                motionOptimized
                width={CARD_WIDTH}
              />
            </View>
          );
        }),
      [reelItems, settledIndex, t],
    );

    // Centres card 0 under the pointer, which is what the offsets assume.
    const sidePadding = Math.max(0, (width - CARD_WIDTH) / 2);
    const pointerOffset = useSharedValue(0);

    useEffect(() => {
      pointerOffset.value = withRepeat(
        withSequence(
          withTiming(5, {
            duration: 420,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: 420,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, { duration: 180 }),
        ),
        -1,
        false,
      );
      return () => cancelAnimation(pointerOffset);
    }, [pointerOffset]);

    const pointerStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: pointerOffset.value },
        { scale: 1 + pointerOffset.value * 0.012 },
      ],
    }));

    return (
      <View style={styles.stage}>
        <Animated.View style={[styles.pointer, pointerStyle]} />
        <View style={styles.clip}>
          <Animated.View
            style={[styles.track, { paddingHorizontal: sidePadding }, trackStyle]}
          >
            {cards}
          </Animated.View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  stage: {
    backgroundColor: "#f7f4ff",
    borderBottomColor: "rgba(92, 61, 255, 0.18)",
    borderBottomWidth: 1,
    borderTopColor: "rgba(92, 61, 255, 0.18)",
    borderTopWidth: 1,
    justifyContent: "center",
    minHeight: 250,
    overflow: "hidden",
    paddingBottom: 36,
    paddingTop: 42,
    width: "100%",
  },
  clip: {
    marginBottom: -30,
    marginTop: -16,
    overflow: "hidden",
    paddingBottom: 30,
    paddingTop: 16,
    width: "100%",
  },
  track: {
    flexDirection: "row",
    gap: GAP,
  },
  card: {
    position: "relative",
    width: CARD_WIDTH,
  },
  winnerFrame: {
    borderColor: "rgba(124, 77, 255, 0.42)",
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    bottom: -5,
    left: -5,
    position: "absolute",
    right: -5,
    top: -5,
  },
  shineClip: {
    borderRadius: radius.lg,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  shine: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    bottom: -45,
    position: "absolute",
    top: -45,
    width: 54,
  },
  pointer: {
    borderLeftColor: "transparent",
    borderLeftWidth: 11,
    borderRightColor: "transparent",
    borderRightWidth: 11,
    borderTopColor: colors.primary,
    borderTopWidth: 18,
    height: 0,
    left: "50%",
    marginLeft: -11,
    position: "absolute",
    top: 13,
    width: 0,
    zIndex: 5,
  },
});
