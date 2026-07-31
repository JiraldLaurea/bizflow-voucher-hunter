import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/FormControls";
import { Icon } from "@/components/Icon";
import { StepHeader, SummaryList, SummaryRow } from "@/components/HuntUi";
import { VoucherTicket } from "@/components/VoucherTicket";
import { useHunt } from "@/hunt/HuntContext";
import { formatDate, formatTime } from "@/lib/format";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, palette, radius, spacing } from "@/theme";

/** Step 7 — the issued voucher and the QR the outlet scans. */
export default function ConfirmationScreen() {
  const t = useTranslation();
  const router = useRouter();
  const { flow } = useHunt();
  const issued = flow.issued;

  if (!issued) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <StepHeader title={t("confirmation.stepTitle")} />
        <View style={styles.content}>
          <Text style={styles.lead}>{t("confirmation.noVoucher")}</Text>
          <Button onPress={() => router.replace("/")}>{t("confirmation.backToCampaigns")}</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader title={t("confirmation.stepTitle")} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.check}>
          <Icon color={colors.success} name="check" size={38} />
        </View>
        <Text style={styles.title}>{t("confirmation.reservationConfirmed")}</Text>
        <Text style={styles.lead}>
          Here&apos;s your voucher code. Show this QR code at the outlet.
        </Text>

        <VoucherTicket
          benefit={issued.voucher}
          code={issued.voucher.voucherCode}
          detail={t("confirmation.yourReward")}
        />

        {/* The QR encodes the voucher's `qrToken`, which is what the staff
            validation screen on the web scans. */}
        <View style={styles.qr}>
          <QRCode
            backgroundColor={palette.surface}
            color={palette.navy}
            size={164}
            value={issued.voucher.qrToken}
          />
        </View>

        <SummaryList>
          <SummaryRow icon="calendar" label={t("common.date")} value={formatDate(issued.slot.date)} />
          <SummaryRow
            icon="clock"
            label={t("common.time")}
            value={formatTime(issued.slot.startTime)}
          />
          <SummaryRow icon="check-circle" label={t("confirmation.status")} value={issued.voucher.status} />
        </SummaryList>

        <View style={styles.action}>
          <Button onPress={() => router.replace("/vouchers")}>
            View my vouchers
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 48,
    paddingTop: 26,
  },
  check: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    height: 76,
    justifyContent: "center",
    marginBottom: 14,
    width: 76,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 24,
    marginBottom: 6,
    textAlign: "center",
  },
  lead: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  qr: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    marginVertical: spacing.lg,
    minHeight: 180,
    padding: 8,
    width: 180,
  },
  action: {
    marginTop: spacing.xl,
  },
});
