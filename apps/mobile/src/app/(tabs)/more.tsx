/*
 * The Phase 2 placeholder is retained below only as migration history. Keeping it
 * commented avoids shipping two More screen implementations while the route stays
 * a tiny, conventional Expo Router re-export.
 *
import { toDisplayPhone } from "@bizflow/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, InlineError } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { colors, fonts, radius, spacing } from "@/theme";

export function MoreScreenLegacy() {
  const { phone, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (signOutError) {
      setError(
        signOutError instanceof ApiError
          ? signOutError.message
          : "Your local session could not be cleared. Please try again.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Screen subtitle="Manage your customer session and account." title="More">
      <View style={styles.accountCard}>
        <View style={styles.accountIcon}>
          <Text style={styles.accountInitial}>C</Text>
        </View>
        <View style={styles.accountText}>
          <Text style={styles.accountLabel}>Signed in customer</Text>
          <Text style={styles.phone}>{phone ? toDisplayPhone(phone) : "—"}</Text>
          <View style={styles.secureRow}>
            <View style={styles.secureDot} />
            <Text style={styles.secureText}>Secure mobile session</Text>
          </View>
        </View>
      </View>

      <View style={styles.comingSoon}>
        <Text style={styles.comingTitle}>Loyalty Points</Text>
        <Text style={styles.comingCopy}>
          Earn Loyalty Points and redeem them through participating partner
          offers.
        </Text>
      </View>

      {error ? <InlineError message={error} /> : null}
      <Button loading={isSigningOut} onPress={() => void handleSignOut()} variant="secondary">
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  accountIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  accountInitial: {
    color: colors.primary,
    fontSize: 20,
    fontFamily: fonts.extrabold,
  },
  accountText: {
    flex: 1,
    gap: spacing.xs,
  },
  accountLabel: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  phone: {
    color: colors.ink,
    fontSize: 19,
    fontFamily: fonts.bold,
  },
  secureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  secureDot: {
    backgroundColor: colors.success,
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  secureText: {
    color: colors.success,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  comingSoon: {
    backgroundColor: colors.page,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  comingTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.bold,
  },
  comingCopy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
});
*/

export { default } from "@/screens/MoreScreen";
