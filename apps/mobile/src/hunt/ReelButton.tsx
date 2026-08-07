import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, palette, radius, shadow } from "@/theme";

/**
 * The roulette's one action, in the one place it ever appears.
 *
 * Stopping the reel and confirming the voucher are the same slot at different
 * moments, so they are the same control: only the label changes as the spin
 * resolves. Two differently shaped buttons swapping places under the reel read
 * as the screen rearranging itself at the exact moment it should feel settled.
 *
 * Bigger and rounder than the shared `Button` on purpose — this is the only
 * thing to press on the screen, not one control among several in a form.
 *
 * Deliberately still. The reel above it is already moving at four cards a
 * second, and a button that pulses alongside it competes for the same attention
 * rather than offering somewhere to put it.
 */
export function ReelButton({
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  onPress,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  /** Shows the spinner beside the label; also blocks the press. */
  loading?: boolean;
  onPress: () => void;
}) {
  const inactive = disabled || loading;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: inactive }}
        disabled={inactive}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          !inactive && shadow.button,
          pressed && !inactive && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={
            inactive ? ["#b5a3ff", "#a68cff"] : [palette.purple, palette.purple2]
          }
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
        {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 58,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: "100%",
  },
  gradient: {
    borderRadius: radius.pill,
  },
  /** Opacity only — the same press feedback the shared `Button` gives. */
  pressed: {
    opacity: 0.86,
  },
  label: {
    color: colors.surface,
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 0.2,
  },
});
