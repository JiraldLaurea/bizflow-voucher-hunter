import { StyleSheet, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { Button } from "@/components/FormControls";
import { Icon } from "@/components/Icon";
import { colors, fonts, radius, spacing } from "@/theme";

/**
 * Turns a thrown error into copy a customer can act on.
 *
 * The app is useless without connectivity — every screen is server-backed — so a
 * dropped connection has to read as "you are offline", not as a generic failure
 * that looks like the campaign is broken.
 */
export function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "E-NETWORK") {
      return {
        title: "You're offline",
        message:
          "Voucher Hunt needs a connection. Check your signal or Wi-Fi and try again.",
        offline: true,
      };
    }
    if (error.code === "E-MOBILE-CONFIG") {
      return { title: "Setup needed", message: error.message, offline: false };
    }
    return { title: "Something went wrong", message: error.message, offline: false };
  }
  return {
    title: "Something went wrong",
    message: error instanceof Error ? error.message : fallback,
    offline: false,
  };
}

type ErrorStateProps = {
  error: unknown;
  fallback: string;
  onRetry?: () => void;
};

/** Full-panel failure state with a retry, for screens whose content did not load. */
export function ErrorState({ error, fallback, onRetry }: ErrorStateProps) {
  const described = describeError(error, fallback);

  return (
    <View style={styles.card}>
      <View style={[styles.icon, described.offline && styles.offlineIcon]}>
        <Icon
          color={described.offline ? colors.primary : colors.alertText}
          name={described.offline ? "wifi-off" : "alert-triangle"}
          size={24}
        />
      </View>
      <Text style={styles.title}>{described.title}</Text>
      <Text style={styles.copy}>{described.message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button variant="secondary" onPress={onRetry}>
            Try again
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 56,
  },
  offlineIcon: {
    backgroundColor: colors.primarySoft,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: "center",
  },
  copy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  action: {
    marginTop: spacing.sm,
    width: "100%",
  },
});
