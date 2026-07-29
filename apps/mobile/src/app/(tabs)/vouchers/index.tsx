import type { ClaimedVoucher } from "@bizflow/shared";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { listClaimedVouchers } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { VoucherTicket } from "@/components/VoucherTicket";
import { formatDate, formatTime } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/theme";

export default function VouchersScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [vouchers, setVouchers] = useState<ClaimedVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (asRefresh = false) => {
    if (!token) return;
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setVouchers(await listClaimedVouchers(token));
    } catch (caught) {
      setError(caught);
    } finally {
      if (asRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      subtitle="Your claimed rewards are securely saved to your account."
      title="My Vouchers"
    >
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateCopy}>Loading your vouchers...</Text>
        </View>
      ) : error ? (
        <ErrorState
          error={error}
          fallback="Unable to load your vouchers."
          onRetry={() => void load()}
        />
      ) : vouchers.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.icon}>
            <Icon name="shopping-bag" size={26} />
          </View>
          <Text style={styles.emptyTitle}>No claimed vouchers yet</Text>
          <Text style={styles.copy}>
            Complete a voucher hunt and your confirmed reward will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {vouchers.map((claimed) => (
            <Pressable
              accessibilityHint="Opens voucher details and QR code"
              accessibilityRole="button"
              key={claimed.voucher.id}
              onPress={() =>
                router.push({
                  pathname: "/vouchers/[voucherId]",
                  params: { voucherId: claimed.voucher.id },
                })
              }
              style={({ pressed }) => pressed && styles.pressed}
            >
              <VoucherTicket
                benefit={claimed.voucher}
                code={claimed.voucher.voucherCode}
                detail={claimed.businessName}
                footnote={`${claimed.campaignTitle} · ${formatDate(
                  claimed.slot.date,
                )} · ${formatTime(claimed.slot.startTime)}`}
                minHeight={174}
              />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 280,
  },
  stateCopy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  stateStack: {
    gap: spacing.lg,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 48,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 64,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  copy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  list: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.82,
  },
});
