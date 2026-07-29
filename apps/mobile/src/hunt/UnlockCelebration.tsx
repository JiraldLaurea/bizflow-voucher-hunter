import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors, palette, radius } from "@/theme";

type ConfettiSpec = {
  color: string;
  delay: number;
  fall: number;
  rotation: number;
  size: number;
  x: number;
  y: number;
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

/** Fixed values keep every celebration intentional and avoid random render churn. */
const CONFETTI: ConfettiSpec[] = Array.from({ length: 26 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  const lane = Math.floor(index / 2);
  return {
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    delay: (index % 5) * 24,
    fall: 116 + (index % 4) * 22,
    rotation: side * (160 + (index % 6) * 65),
    size: 6 + (index % 3) * 2,
    x: side * (42 + lane * 12),
    y: 62 + (index % 5) * 13,
  };
});

function ConfettiPiece({ spec }: { spec: ConfettiSpec }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withTiming(1, {
        duration: 1_180,
        easing: Easing.out(Easing.cubic),
      }),
    );
    return () => cancelAnimation(progress);
  }, [progress, spec.delay]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const opacity =
      value < 0.12
        ? value / 0.12
        : value > 0.76
          ? Math.max(0, (1 - value) / 0.24)
          : 1;
    const scale = value < 0.16 ? 0.45 + value * 4 : 1;

    return {
      opacity,
      transform: [
        { translateX: spec.x * value },
        {
          translateY:
            -spec.y * value + spec.fall * value * value,
        },
        { rotate: `${spec.rotation * value}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: spec.color,
          borderRadius: spec.size % 3 === 0 ? radius.pill : 2,
          height: spec.size,
          width: spec.size * (spec.size % 2 === 0 ? 0.7 : 1),
        },
        animatedStyle,
      ]}
    />
  );
}

function CelebrationRing({
  color,
  delay,
}: {
  color: string;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      }),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (1 - progress.value) * 0.58),
    transform: [{ scale: 0.35 + progress.value * 2.15 }],
  }));

  return (
    <Animated.View
      style={[styles.ring, { borderColor: color }, animatedStyle]}
    />
  );
}

/**
 * A UI-thread celebration mounted over the reel once the selected ticket lands.
 * It is absolute and pointer-free, so it cannot resize or block the roulette.
 */
export function UnlockCelebration() {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <CelebrationRing color={colors.primary} delay={0} />
      <CelebrationRing color="#ffcf54" delay={110} />
      {CONFETTI.map((spec, index) => (
        <ConfettiPiece key={`${spec.x}-${index}`} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    overflow: "visible",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  piece: {
    left: "50%",
    marginLeft: -4,
    marginTop: -4,
    position: "absolute",
    top: "50%",
  },
  ring: {
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 74,
    left: "50%",
    marginLeft: -37,
    marginTop: -37,
    position: "absolute",
    top: "50%",
    width: 74,
  },
});
