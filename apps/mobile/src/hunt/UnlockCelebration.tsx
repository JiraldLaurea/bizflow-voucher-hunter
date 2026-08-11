import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { palette } from "@/theme";

type ConfettiSpec = {
  color: string;
  delay: number;
  drift: number;
  duration: number;
  id: number;
  round: boolean;
  rotation: number;
  size: number;
  startY: number;
  x: number;
};

const CONFETTI_COLORS = [
  "#ff4da6",
  "#32c96f",
  "#5cc8ff",
  "#ffb02e",
  palette.purple,
  "#ffcf54",
  "#ff5d5d",
];

/** A fresh, irregular shower for every win rather than a repeated particle grid. */
function createConfetti(): ConfettiSpec[] {
  const count = 64 + Math.floor(Math.random() * 25);

  return Array.from({ length: count }, (_, index) => {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const size = 7 + Math.random() * 5;

    return {
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      // The first drops begin at once. The rest keep entering for more than
      // three seconds, so this reads as rainfall rather than one release.
      delay:
        index < 8
          ? index * 65
          : 160 + Math.floor(Math.random() * 3_200),
      drift: direction * (18 + Math.random() * 48),
      duration: 2_150 + Math.floor(Math.random() * 950),
      id: index,
      round: Math.random() < 0.18,
      rotation: direction * (480 + Math.random() * 900),
      size,
      startY: -18 - Math.random() * 54,
      x: 0.02 + Math.random() * 0.96,
    };
  });
}

function ConfettiPiece({
  height,
  spec,
  width,
}: {
  height: number;
  spec: ConfettiSpec;
  width: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const fall = withTiming(1, {
      duration: spec.duration,
      easing: Easing.linear,
    });
    progress.value = spec.delay > 0 ? withDelay(spec.delay, fall) : fall;
    return () => cancelAnimation(progress);
  }, [progress, spec.delay, spec.duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const opacity =
      value === 0
        ? 0
        : value > 0.9
          ? Math.max(0, (1 - value) / 0.1)
          : 1;
    const sway = Math.sin(value * Math.PI * 3) * spec.drift * 0.45;
    const flutter = 0.42 + Math.abs(Math.cos(value * Math.PI * 7)) * 0.58;

    return {
      opacity,
      transform: [
        { translateX: spec.drift * value + sway },
        { translateY: (height - spec.startY + 56) * value },
        { rotate: `${spec.rotation * value}deg` },
        { scaleX: flutter },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: spec.color,
          borderRadius: spec.round ? spec.size : 2,
          height: spec.round ? spec.size : spec.size * 1.45,
          left: spec.x * width,
          top: spec.startY,
          width: spec.round ? spec.size : spec.size * 0.72,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * A UI-thread celebration mounted over the entire roulette screen once the
 * selected ticket lands. It is pointer-free, so the confirm action remains
 * available while several rows of confetti rain past it.
 */
export function UnlockCelebration() {
  const { height, width } = useWindowDimensions();
  const confetti = useMemo(createConfetti, []);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {confetti.map((spec) => (
        <ConfettiPiece
          height={height}
          key={spec.id}
          spec={spec}
          width={width}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    elevation: 100,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 100,
  },
  piece: {
    position: "absolute",
  },
});
