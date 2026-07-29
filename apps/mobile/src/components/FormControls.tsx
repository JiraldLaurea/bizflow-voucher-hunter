import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, PropsWithChildren } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/Icon";
import { useOverlay } from "@/components/OverlayHost";
import { colors, fonts, palette, radius, shadow, spacing } from "@/theme";

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  hint?: string;
};

/** `.field` — muted label above a 46pt bordered input. */
export function Field({ hint, label, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.input, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** `.field-readonly-value` — fixed info (the signed-in phone), not an input. */
export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readonly}>
        <Text style={styles.readonlyText}>{value}</Text>
      </View>
    </View>
  );
}

type ButtonProps = PropsWithChildren<{
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "tertiary";
}>;

/**
 * `.button` and its `.secondary` / `.tertiary` variants. Primary is the purple
 * gradient with a lifted shadow; the web keeps a disabled primary fully opaque in a
 * desaturated purple (`.hunt-start-button:disabled`) rather than fading it out.
 */
export function Button({
  children,
  disabled = false,
  loading = false,
  loadingLabel,
  onPress,
  variant = "primary",
}: ButtonProps) {
  const inactive = disabled || loading;
  const label = loading && loadingLabel ? loadingLabel : children;

  if (variant === "primary") {
    return (
      <Pressable
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
          colors={inactive ? ["#b5a3ff", "#a68cff"] : [palette.purple, palette.purple2]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
        {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
        <Text style={[styles.buttonText, styles.primaryText]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" ? styles.secondary : styles.tertiary,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      <Text
        style={[
          styles.buttonText,
          variant === "secondary" ? styles.secondaryText : styles.tertiaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export type SelectOption = { label: string; value: string };

type SelectProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown when nothing matches `value`. */
  placeholder?: string;
  disabled?: boolean;
};

/**
 * The web's `.field select`: a 46pt bordered box with a chevron that opens a list.
 *
 * React Native has no `<select>`, and `@expo/ui`'s Picker renders a platform button
 * whose closed state cannot be styled to match. Since the closed state is what is on
 * screen almost all the time, the trigger is reproduced exactly here and the options
 * open in a sheet.
 */
export function Select({
  disabled = false,
  label,
  onChange,
  options,
  placeholder = "Select…",
  value,
}: SelectProps) {
  // `mounted` keeps the sheet rendered through its closing animation; `progress`
  // drives the motion. Tying both to one flag would rip the sheet away the instant
  // it started sliding out.
  const [mounted, setMounted] = useState(false);
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(360);
  const selected = options.find((option) => option.value === value);
  const { dismiss, present } = useOverlay();
  const overlayKey = useId();

  const openSheet = useCallback(() => {
    setMounted(true);
    progress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const closeSheet = useCallback(() => {
    progress.value = withTiming(
      0,
      { duration: 150, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  // Android's back gesture should dismiss the sheet, not leave the screen —
  // the behaviour `Modal`'s `onRequestClose` used to provide.
  useEffect(() => {
    if (!mounted) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSheet();
      return true;
    });
    return () => subscription.remove();
  }, [closeSheet, mounted]);

  useEffect(() => {
    if (!mounted) {
      dismiss(overlayKey);
      return;
    }
    // Re-presented whenever the rendered content changes, since the overlay host
    // holds a snapshot of the node rather than re-rendering it itself.
    present(
      overlayKey,
      <>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.backdropPress} onPress={closeSheet} />
        </Animated.View>
        <Animated.View
          onLayout={(event) => {
            // Slide exactly its own height so the sheet always starts fully
            // offscreen, whatever the option count.
            sheetHeight.value = event.nativeEvent.layout.height;
          }}
          style={[styles.sheet, sheetStyle]}
        >
          <Text style={styles.sheetTitle}>{label}</Text>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.sheetListContent}
            style={styles.sheetList}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    closeSheet();
                  }}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    isSelected && styles.sheetRowSelected,
                    pressed && styles.sheetRowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetRowText,
                      isSelected && styles.sheetRowTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </>,
    );
  }, [
    backdropStyle,
    closeSheet,
    dismiss,
    label,
    mounted,
    onChange,
    options,
    overlayKey,
    present,
    sheetHeight,
    sheetStyle,
    value,
  ]);

  // Leaving the screen while open must not strand the overlay on screen.
  useEffect(() => () => dismiss(overlayKey), [dismiss, overlayKey]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: mounted }}
        disabled={disabled}
        onPress={openSheet}
        style={({ pressed }) => [
          styles.input,
          styles.selectTrigger,
          disabled && styles.inactive,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text numberOfLines={1} style={styles.selectValue}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon color={colors.textMuted} name="chevron-down" size={18} />
      </Pressable>

    </View>
  );
}

/**
 * `.alert` — amber, not red. The web uses it for recoverable problems in the flow
 * (a sold-out slot, a spin that could not start), so it warns rather than errors.
 */
export function InlineError({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.alert}>
      <Text style={styles.alertText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  readonly: {
    alignItems: "center",
    backgroundColor: colors.page,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  readonlyText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  button: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 46,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    width: "100%",
  },
  gradient: {
    borderRadius: radius.sm,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: "#cbd3e1",
    borderWidth: 1,
  },
  tertiary: {
    backgroundColor: "transparent",
    minHeight: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: "auto",
  },
  inactive: {
    opacity: 0.52,
  },
  pressed: {
    opacity: 0.86,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: "center",
  },
  primaryText: {
    color: colors.surface,
  },
  secondaryText: {
    color: colors.ink,
  },
  tertiaryText: {
    color: colors.primary,
  },
  selectTrigger: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  selectValue: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  /** Stands in for the web's chevron background-image on `.field select`. */
  backdrop: {
    backgroundColor: "rgba(11, 29, 58, 0.45)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "70%",
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  sheetTitle: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetListContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetRowSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  sheetRowPressed: {
    backgroundColor: colors.page,
  },
  sheetRowText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  sheetRowTextSelected: {
    fontFamily: fonts.bold,
  },
  radioOuter: {
    alignItems: "center",
    borderColor: colors.textMuted,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  radioInner: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  alert: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.alertBorder,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  alertText: {
    color: colors.alertText,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
