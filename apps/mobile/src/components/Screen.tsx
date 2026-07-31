import type { PropsWithChildren, ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, spacing } from "@/theme";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}>;

export function Screen({
  children,
  footer,
  onRefresh,
  refreshing = false,
  subtitle,
  title,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={onRefresh}
              progressBackgroundColor={colors.surface}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <View style={styles.heading}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function BrandMark() {
  const t = useTranslation();
  return (
    <View style={styles.brand}>
      <View style={styles.brandIcon}>
        <Text style={styles.brandPercent}>%</Text>
      </View>
      <View>
        <Text style={styles.brandName}>Voucher Hunt</Text>
        <Text style={styles.brandCaption}>{t("brand.caption")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  heading: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  brandIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  brandPercent: {
    color: colors.surface,
    fontSize: 20,
    fontFamily: fonts.extrabold,
  },
  brandName: {
    color: colors.ink,
    fontSize: 19,
    fontFamily: fonts.extrabold,
  },
  brandCaption: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
