import { useEffect } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/FormControls";
import { Icon } from "@/components/Icon";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

type Props = {
  balance: string;
  points: string;
  onConfirm: () => void;
};

/** Daily LP acknowledgement shown only when the server created a new award. */
export function LoyaltyAwardModal({ balance, onConfirm, points }: Props) {
  const t = useTranslation();
  const entrance = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [entrance]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: (1 - entrance.value) * 18 },
      { scale: 0.96 + entrance.value * 0.04 },
    ],
  }));

  return (
    <View
      accessibilityViewIsModal
      style={styles.backdrop}
    >
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.iconHalo}>
          <View style={styles.iconCore}>
            <Icon color={colors.surface} name="award" size={30} />
          </View>
        </View>

        <Text style={styles.eyebrow}>DAILY LOYALTY REWARD</Text>
        <Text style={styles.title}>{points} earned!</Text>
        <Text style={styles.copy}>
          Thanks for opening Voucher Hunt today. Your daily reward has been
          added to your Loyalty Points balance.
        </Text>

        <View style={styles.balancePanel}>
          <View style={styles.balanceIcon}>
            <Icon name="star" size={18} />
          </View>
          <View style={styles.balanceCopy}>
            <Text style={styles.balanceLabel}>{t("loyalty.currentBalance")}</Text>
            <Text style={styles.balanceValue}>{balance}</Text>
          </View>
        </View>

        <Button onPress={onConfirm}>{t("common.continue")}</Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(11, 29, 58, 0.48)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: 360,
    padding: spacing.xl,
    width: "100%",
    ...shadow.raised,
  },
  iconHalo: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 42,
    height: 84,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 84,
  },
  iconCore: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 26,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  copy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  balancePanel: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  balanceIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  balanceCopy: {
    flex: 1,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  balanceValue: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 22,
    marginTop: 2,
  },
});
