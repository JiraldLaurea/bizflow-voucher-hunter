import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

/** `.summary-list` — a bordered, hairline-divided stack of label/value rows. */
export function SummaryList({ children }: { children: ReactNode }) {
  return <View style={styles.summaryList}>{children}</View>;
}

export function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryIcon}>
        <Icon name={icon} size={15} />
      </View>
      <View style={styles.summaryBody}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

/** `.info-card` — the neutral bordered panel used for empty//share states. */
export function InfoCard({ children }: { children: ReactNode }) {
  return <View style={styles.infoCard}>{children}</View>;
}

/**
 * `.slot-row` — time on the left, availability underneath, a ring on the right that
 * fills purple with a check when picked. Sold-out rows go red-tinted and disabled.
 */
export function SlotRow({
  low,
  note,
  onPress,
  selected,
  soldOut,
  time,
}: {
  low: boolean;
  note: string;
  onPress: () => void;
  selected: boolean;
  soldOut: boolean;
  time: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: soldOut, selected }}
      disabled={soldOut}
      onPress={onPress}
      style={[
        styles.slotRow,
        selected && styles.slotRowActive,
        soldOut && styles.slotRowSoldOut,
      ]}
    >
      <View style={styles.slotMain}>
        <Text style={styles.slotTime}>{time}</Text>
        <Text
          style={[
            styles.slotNote,
            low && !soldOut && styles.slotNoteLow,
            soldOut && styles.slotNoteGone,
          ]}
        >
          {note}
        </Text>
      </View>
      <View
        style={[
          styles.slotCheck,
          selected && styles.slotCheckActive,
          soldOut && styles.slotCheckSoldOut,
        ]}
      >
        {selected ? <Icon color={colors.surface} name="check" size={14} /> : null}
      </View>
    </Pressable>
  );
}

/** `.step-app-bar` — back chevron, centred title, spacer to keep the title centred. */
export function StepHeader({
  onBack,
  title,
}: {
  onBack?: () => void;
  title: string;
}) {
  const t = useTranslation();
  return (
    <View style={styles.stepBar}>
      {onBack ? (
        <Pressable
          accessibilityLabel={t("common.back")}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onBack}
          style={styles.backLink}
        >
          <Icon color={colors.ink} name="chevron-left" size={26} />
        </Pressable>
      ) : (
        <View style={styles.backLink} />
      )}
      <Text style={styles.stepTitle}>{title}</Text>
      <View style={styles.backLink} />
    </View>
  );
}

/** `.hunt-title` / `.hunt-subtitle` — the centred heading pair used across steps. */
export function HuntHeading({
  subtitle,
  title,
}: {
  subtitle?: string;
  title: string;
}) {
  return (
    <View>
      <Text style={styles.huntTitle}>{title}</Text>
      {subtitle ? <Text style={styles.huntSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** `.selected-strip` — the "current voucher + change" bar above the slot picker. */
export function SelectedStrip({
  label,
  onChange,
}: {
  label: string;
  onChange: () => void;
}) {
  const t = useTranslation();
  return (
    <View style={styles.selectedStrip}>
      <View style={styles.selectedStripSummary}>
        <View style={styles.selectedStripIcon}>
          <Icon name="tag" size={16} />
        </View>
        <View style={styles.selectedStripCopy}>
          <Text style={styles.selectedStripEyebrow}>{t("hunt.selectedVoucher")}</Text>
          <Text style={styles.selectedStripLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={t("hunt.changeVoucherLabel")}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onChange}
        style={({ pressed }) => [
          styles.selectedStripAction,
          pressed && styles.selectedStripActionPressed,
        ]}
      >
        <Icon name="repeat" size={14} />
        <Text style={styles.selectedStripActionText}>{t("hunt.change")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryList: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryRow: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  summaryIcon: {
    alignItems: "center",
    paddingTop: 2,
    width: 20,
  },
  summaryBody: {
    flex: 1,
  },
  summaryLabel: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
    marginBottom: 2,
  },
  summaryValue: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: 18,
    ...shadow.soft,
  },
  slotRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  slotRowActive: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  slotRowSoldOut: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#f7d9d9",
  },
  slotMain: {
    flex: 1,
    gap: 3,
  },
  slotTime: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  slotNote: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  slotNoteLow: {
    color: "#b45309",
  },
  slotNoteGone: {
    color: "#b91c1c",
  },
  slotCheck: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  slotCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotCheckSoldOut: {
    borderStyle: "dashed",
  },
  stepBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: spacing.sm,
  },
  backLink: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 17,
    textAlign: "center",
  },
  huntTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 28,
    marginBottom: 6,
    textAlign: "center",
  },
  huntSubtitle: {
    alignSelf: "center",
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    maxWidth: 260,
    textAlign: "center",
  },
  selectedStrip: {
    alignItems: "center",
    backgroundColor: "#f4f1ff",
    borderColor: "#ddd5ff",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 14,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectedStripSummary: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  selectedStripIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#ddd5ff",
    borderRadius: radius.md,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  selectedStripCopy: {
    flex: 1,
    gap: 2,
  },
  selectedStripEyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  selectedStripLabel: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  selectedStripAction: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#cfc4ff",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectedStripActionPressed: {
    backgroundColor: "#e9e3ff",
    transform: [{ scale: 0.98 }],
  },
  selectedStripActionText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
