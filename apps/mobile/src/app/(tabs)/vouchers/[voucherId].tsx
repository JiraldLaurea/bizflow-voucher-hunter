import type { ClaimedVoucher } from "@bizflow/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { listClaimedVouchers } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, InlineError } from "@/components/FormControls";
import { Icon } from "@/components/Icon";
import { VoucherTicket } from "@/components/VoucherTicket";
import { formatDate, formatTime, voucherDetail } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

export default function VoucherDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ voucherId: string }>();
  const voucherId = Array.isArray(params.voucherId)
    ? params.voucherId[0]
    : params.voucherId;
  const { token } = useAuth();
  const [claimed, setClaimed] = useState<ClaimedVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !voucherId) return;
    setLoading(true);
    setError("");
    try {
      const vouchers = await listClaimedVouchers(token);
      const match = vouchers.find((item) => item.voucher.id === voucherId);
      if (!match) throw new Error("This voucher could not be found.");
      setClaimed(match);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load this voucher.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, voucherId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Icon color={colors.ink} name="chevron-left" size={26} />
        </Pressable>
        <Text style={styles.headerTitle}>Voucher Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error || !claimed ? (
        <View style={styles.errorState}>
          <InlineError message={error || "This voucher could not be found."} />
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.business}>{claimed.businessName}</Text>
          <Text style={styles.campaign}>{claimed.campaignTitle}</Text>

          <VoucherTicket
            benefit={claimed.voucher}
            code={claimed.voucher.voucherCode}
            detail={voucherDetail(claimed.voucher)}
            selected
          />

          <View style={[styles.qrCard, shadow.soft]}>
            <QRCode
              backgroundColor={colors.surface}
              color={colors.ink}
              quietZone={8}
              size={190}
              value={claimed.voucher.qrToken}
            />
          </View>
          <Text style={styles.qrHint}>
            Show this QR code to partner staff when redeeming your voucher.
          </Text>

          <View style={styles.details}>
            <DetailRow label="Date" value={formatDate(claimed.slot.date)} />
            <DetailRow
              label="Time"
              value={`${formatTime(claimed.slot.startTime)} – ${formatTime(
                claimed.slot.endTime,
              )}`}
            />
            <DetailRow label="Status" value={claimed.voucher.status} />
            <DetailRow
              label="Expires"
              value={new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(claimed.voucher.expiresAt))}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: spacing.lg,
  },
  back: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  errorState: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 48,
  },
  business: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: "center",
  },
  campaign: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  qrCard: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  qrHint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    textAlign: "center",
  },
  details: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xl,
    overflow: "hidden",
  },
  detailRow: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  detailLabel: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  detailValue: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
