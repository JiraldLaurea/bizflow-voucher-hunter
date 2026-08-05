import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Icon } from "@/components/Icon";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, spacing } from "@/theme";

/**
 * One-tap copy, confirmed by the icon turning into a tick for a moment.
 *
 * Deliberately not a toast: these codes appear inside scrolling lists and on
 * tickets, where a message elsewhere on screen leaves it ambiguous which code
 * was copied.
 */
export function CopyButton({
  color = colors.primary,
  label,
  size = 16,
  value,
}: {
  color?: string;
  /** What is being copied, for the screen-reader hint. */
  label: string;
  size?: number;
  value: string;
}) {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await Clipboard.setStringAsync(value);
      setFailed(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setFailed(true);
    }
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 1600);
  }, [value]);

  return (
    <Pressable
      accessibilityHint={t("common.copyHint", { label })}
      accessibilityLabel={value}
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => void copy()}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon
        color={failed ? colors.alertText : color}
        name={copied ? "check" : failed ? "alert-circle" : "copy"}
        size={size}
      />
    </Pressable>
  );
}

/** A labelled row — "Voucher code    RWD-975A4F ⧉" — for detail lists. */
export function CopyableCode({
  label,
  style,
  value,
}: {
  label: string;
  /** This is the whole row, so callers pass their own spacing rather than
   *  wrapping it — a row nested in a row collapses to content width and the
   *  value stops aligning with the rest of the column. */
  style?: StyleProp<ViewStyle>;
  value: string;
}) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>
        <Text style={styles.code}>{value}</Text>
        <CopyButton label={label} value={value} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  value: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  code: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  button: {
    borderRadius: radius.sm,
    padding: 2,
  },
  pressed: {
    opacity: 0.55,
  },
});
