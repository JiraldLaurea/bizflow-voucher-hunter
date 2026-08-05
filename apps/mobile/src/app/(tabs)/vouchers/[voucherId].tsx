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

import { getCampaign, listClaimedVouchers, type PublicCampaign } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { BusinessDetailsCard } from "@/components/BusinessDetailsCard";
import { Button, InlineError } from "@/components/FormControls";
import { Icon, type IconName } from "@/components/Icon";
import { SummaryList, SummaryRow } from "@/components/HuntUi";
import { VoucherTicket } from "@/components/VoucherTicket";
import {
  formatDate,
  formatTime,
  localeFor,
  voucherDetail,
  voucherStatusLabel,
} from "@/lib/format";
import { useLanguage } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

export default function VoucherDetailScreen() {
  const { language, t } = useLanguage();
  const locale = localeFor(language);
  const router = useRouter();
  const params = useLocalSearchParams<{ voucherId: string }>();
  const voucherId = Array.isArray(params.voucherId)
    ? params.voucherId[0]
    : params.voucherId;
  const { token } = useAuth();
  const [claimed, setClaimed] = useState<ClaimedVoucher | null>(null);
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !voucherId) return;
    setLoading(true);
    setError("");
    try {
      const vouchers = await listClaimedVouchers(token);
      const match = vouchers.find((item) => item.voucher.id === voucherId);
      if (!match) throw new Error(t("vouchers.notFound"));
      setClaimed(match);
      try {
        setCampaign(await getCampaign(match.campaignSlug, token));
      } catch {
        // The issued voucher remains usable if optional venue enrichment fails.
        setCampaign(null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("vouchers.loadOneError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t, token, voucherId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t("vouchers.goBack")}
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Icon color={colors.ink} name="chevron-left" size={26} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("vouchers.detailsTitle")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error || !claimed ? (
        <View style={styles.errorState}>
          <InlineError message={error || t("vouchers.notFound")} />
          <Button variant="secondary" onPress={() => void load()}>
            {t("common.retry")}
          </Button>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contextCard}>
            <SummaryList>
              <SummaryRow icon="flag" label={t("common.campaign")} value={claimed.campaignTitle} />
              <SummaryRow icon="briefcase" label={t("common.business")} value={claimed.businessName} />
            </SummaryList>
          </View>

          <VoucherTicket
            benefit={claimed.voucher}
            code={claimed.voucher.voucherCode}
            copyable
            detail={voucherDetail(t, claimed.voucher)}
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
            {t("vouchers.qrInstruction")}
          </Text>

          <View style={styles.details}>
            <DetailRow
              icon="calendar"
              label={t("common.date")}
              value={formatDate(claimed.slot.date, locale)}
            />
            <DetailRow
              icon="clock"
              label={t("common.time")}
              value={`${formatTime(claimed.slot.startTime, locale)} – ${formatTime(
                claimed.slot.endTime,
                locale,
              )}`}
            />
            <DetailRow
              icon="check-circle"
              label={t("vouchers.status")}
              value={voucherStatusLabel(t, claimed.voucher.status)}
            />
            <DetailRow
              icon="alert-circle"
              label={t("vouchers.expires")}
              value={new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(claimed.voucher.expiresAt))}
            />
          </View>

          <BusinessDetailsCard business={campaign?.business} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon name={icon} size={16} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
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
  contextCard: {
    marginBottom: spacing.xl,
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
    alignItems: "flex-start",
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: spacing.lg,
  },
  detailIcon: {
    alignItems: "center",
    paddingTop: 1,
    width: 20,
  },
  detailCopy: {
    flex: 1,
    gap: spacing.xs,
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
