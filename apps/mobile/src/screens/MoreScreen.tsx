import { toDisplayPhone } from "@bizflow/shared";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  buildDeleteAccountUrl,
  buildReferralLink,
  convertRewardCredit,
  getReferralLinkIdentity,
  getOrCreateRewardWallet,
  type RewardWalletSnapshot,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Field, InlineError } from "@/components/FormControls";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { NotificationSettings } from "@/components/NotificationSettings";
import { DevToolsPanel } from "@/dev/DevToolsPanel";
import { getVisitorSessionId } from "@/hunt/session";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

export default function MoreScreen() {
  const { phone, signOut, token } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [wallet, setWallet] = useState<RewardWalletSnapshot | null>(null);
  const [walletBusy, setWalletBusy] = useState(true);
  const [convertAmount, setConvertAmount] = useState("");
  const [expandedVoucherId, setExpandedVoucherId] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [referralBusy, setReferralBusy] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!token) return;
    setWalletBusy(true);
    setError("");
    try {
      setWallet(await getOrCreateRewardWallet(token));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load Loyalty Points.",
      );
    } finally {
      setWalletBusy(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet]),
  );

  async function handleConvert() {
    if (!token || !wallet) return;
    if (!convertAmount.trim()) {
      setError("Enter an amount to convert.");
      return;
    }
    setWalletBusy(true);
    setError("");
    setNotice("");
    try {
      await convertRewardCredit(
        { walletSecret: wallet.walletSecret, amount: convertAmount.trim() },
        token,
      );
      setConvertAmount("");
      setNotice("Loyalty Points converted into an LP voucher.");
      setWallet(await getOrCreateRewardWallet(token));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to convert Loyalty Points.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setError("Your local session could not be cleared. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await Clipboard.setStringAsync(value);
      setError("");
      setNotice(`${label} copied.`);
    } catch {
      setNotice("");
      setError(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  async function shareDailyReferral() {
    if (!token) return;
    setReferralBusy(true);
    setError("");
    setNotice("");
    try {
      const sessionId = await getVisitorSessionId();
      const referral = await getReferralLinkIdentity(token, sessionId);
      const link = buildReferralLink(
        referral.campaignSlug,
        referral.referrerUserId,
      );
      await Share.share({
        message:
          `Try Voucher Hunt with my link. Open it to join and help me earn 10 LP:\n${link}`,
        title: "Voucher Hunt referral",
      });
      setNotice(
        "Referral link shared. You’ll earn 10 LP when one new user opens it.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create your referral link.",
      );
    } finally {
      setReferralBusy(false);
    }
  }

  async function openDeleteAccount() {
    try {
      await WebBrowser.openBrowserAsync(buildDeleteAccountUrl());
    } catch {
      setError("Unable to open the account deletion page.");
    }
  }

  return (
    <Screen subtitle="Manage your Loyalty Points and account." title="More">
      <View style={styles.accountCard}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.accountCopy}>
          {phone
            ? `Signed in as ${toDisplayPhone(phone)}`
            : "You are not signed in."}
        </Text>
      </View>

      <View style={styles.walletCard}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Loyalty Points</Text>
            <Text style={styles.sectionCopy}>
              Earn 5% LP on eligible purchases and redeem it through
              participating partner offers.
            </Text>
          </View>
          <View style={styles.creditPill}>
            <Text style={styles.creditPillText}>Earn 5% LP</Text>
          </View>
        </View>

        {walletBusy && !wallet ? (
          <View style={styles.walletLoading}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.muted}>Unlocking your wallet...</Text>
          </View>
        ) : wallet ? (
          <>
            <LinearGradient
              colors={["#6637ff", "#7a44f4"]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.balanceCard}
            >
              <Text style={styles.balanceLabel}>Available Loyalty Points</Text>
              <Text style={styles.balance}>{wallet.balance}</Text>
              <Text style={styles.balanceHint}>
                Redeem LP through participating partner offers.
              </Text>
            </LinearGradient>

            <View style={styles.dailyCard}>
              <View style={styles.dailyHeading}>
                <View style={styles.dailyHeadingCopy}>
                  <Text style={styles.dailyTitle}>Earn LP every day</Text>
                  <Text style={styles.dailyCaption}>
                    Up to {wallet.dailyStatus.monthlyPotential} in 30 days
                  </Text>
                </View>
                <Text style={styles.dailyTotal}>
                  {wallet.dailyStatus.earnedToday} today
                </Text>
              </View>
              <View style={styles.dailyRow}>
                <Icon color={colors.primary} name="check-circle" size={18} />
                <View style={styles.dailyRowCopy}>
                  <Text style={styles.dailyRowTitle}>
                    Use Voucher Hunt today
                  </Text>
                  <Text style={styles.dailyCaption}>
                    {wallet.dailyStatus.appUsePoints}
                  </Text>
                </View>
                <Text style={styles.dailyEarned}>Earned</Text>
              </View>
              <View style={styles.dailyRow}>
                <Icon
                  color={colors.primary}
                  name={
                    wallet.dailyStatus.referralAwarded
                      ? "check-circle"
                      : "refresh-cw"
                  }
                  size={18}
                />
                <View style={styles.dailyRowCopy}>
                  <Text style={styles.dailyRowTitle}>
                    Refer one new user today
                  </Text>
                  <Text style={styles.dailyCaption}>
                    {wallet.dailyStatus.referralPoints}
                  </Text>
                </View>
                {wallet.dailyStatus.referralAwarded ? (
                  <Text style={styles.dailyEarned}>Earned</Text>
                ) : (
                  <Pressable
                    accessibilityLabel="Share your daily referral link"
                    accessibilityRole="button"
                    disabled={referralBusy}
                    onPress={() => void shareDailyReferral()}
                    style={({ pressed }) => [
                      styles.referralButton,
                      pressed && styles.pressed,
                      referralBusy && styles.referralButtonDisabled,
                    ]}
                  >
                    {referralBusy ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Icon color={colors.primary} name="share-2" size={14} />
                    )}
                    <Text style={styles.referralButtonText}>
                      {referralBusy ? "Preparing" : "Share"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={[styles.qrCard, shadow.soft]}>
              <QRCode
                backgroundColor={colors.surface}
                color={colors.ink}
                quietZone={8}
                size={148}
                value={wallet.wallet.walletToken}
              />
            </View>

            <View style={styles.walletToken}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: tokenVisible }}
                onPress={() => setTokenVisible((visible) => !visible)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  color={colors.ink}
                  name={tokenVisible ? "eye-off" : "eye"}
                  size={16}
                />
                <Text style={styles.secondaryButtonText}>
                  {tokenVisible ? "Hide wallet token" : "Show wallet token"}
                </Text>
              </Pressable>
              {tokenVisible ? (
                <View style={styles.walletTokenValue}>
                  <Text selectable style={styles.walletTokenCode}>
                    {wallet.wallet.walletToken}
                  </Text>
                  <Pressable
                    accessibilityLabel="Copy wallet token"
                    accessibilityRole="button"
                    onPress={() =>
                      void copyToClipboard(
                        wallet.wallet.walletToken,
                        "Wallet token",
                      )
                    }
                    style={({ pressed }) => [
                      styles.copyButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon color={colors.ink} name="copy" size={15} />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <Field
              keyboardType="decimal-pad"
              label="LP amount to convert"
              onChangeText={setConvertAmount}
              placeholder="50.00"
              value={convertAmount}
            />
            <Button
              disabled={!convertAmount.trim()}
              loading={walletBusy}
              loadingLabel="Converting..."
              onPress={() => void handleConvert()}
            >
              Create LP Voucher
            </Button>

            {wallet.vouchers.length > 0 ? (
              <View style={styles.rewardSection}>
                <Text style={styles.rewardTitle}>Your LP vouchers</Text>
                <View style={styles.rewardList}>
                  {wallet.vouchers.slice(0, 3).map((voucher) => {
                    const expanded = voucher.id === expandedVoucherId;
                    return (
                      <View style={styles.rewardCard} key={voucher.id}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() =>
                            setExpandedVoucherId(expanded ? "" : voucher.id)
                          }
                          style={({ pressed }) => [
                            styles.rewardRow,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.rewardCode}>
                            {voucher.voucherCode}
                          </Text>
                          <Text style={styles.rewardMeta}>
                            {formatPoints(voucher.remainingCentavos)} ·{" "}
                            {voucher.status}
                          </Text>
                          <View
                            style={[
                              styles.rewardArrow,
                              expanded && styles.rewardArrowExpanded,
                            ]}
                          >
                            <Icon
                              color={colors.primary}
                              name="chevron-right"
                              size={18}
                            />
                          </View>
                        </Pressable>
                        {expanded ? (
                          <View style={styles.rewardDetails}>
                            <View style={styles.rewardQr}>
                              <QRCode
                                backgroundColor={colors.surface}
                                color={colors.ink}
                                quietZone={8}
                                size={148}
                                value={voucher.qrToken}
                              />
                            </View>
                            <View style={styles.rewardActions}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() =>
                                  void copyToClipboard(
                                    voucher.voucherCode,
                                    "LP voucher code",
                                  )
                                }
                                style={({ pressed }) => [
                                  styles.rewardActionButton,
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Icon color={colors.ink} name="copy" size={15} />
                                <Text style={styles.rewardActionText}>
                                  Copy Code
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() =>
                                  void copyToClipboard(
                                    voucher.qrToken,
                                    "LP voucher QR token",
                                  )
                                }
                                style={({ pressed }) => [
                                  styles.rewardActionButton,
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Icon color={colors.ink} name="copy" size={15} />
                                <Text style={styles.rewardActionText}>
                                  Copy QR Token
                                </Text>
                              </Pressable>
                            </View>
                            <Text style={styles.qrHint}>
                              Partner staff can scan this QR or enter the voucher
                              code in the staff Loyalty Points page.
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      {error && !wallet ? (
        <View style={styles.retry}>
          <Button variant="secondary" onPress={() => void loadWallet()}>
            Retry wallet
          </Button>
        </View>
      ) : null}
      {/* Sits directly above sign out, as it does on the web More page. Renders
          nothing outside development. */}
      <NotificationSettings />
      <DevToolsPanel />
      <Button
        loading={isSigningOut}
        onPress={() => void handleSignOut()}
        variant="secondary"
      >
        Sign out
      </Button>
      {/* Play requires an in-app route to account deletion for any app that lets
          you create an account in-app. The instructions live on the web so the
          store listing and the app can point at one page. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => void openDeleteAccount()}
        style={styles.deleteAccount}
      >
        <Text style={styles.deleteAccountText}>Delete my account</Text>
      </Pressable>
    </Screen>
  );
}

function formatPoints(value: number) {
  return `${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(value / 100)} LP`;
}

const styles = StyleSheet.create({
  deleteAccount: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  deleteAccountText: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  accountCopy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  walletCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  sectionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  sectionCopy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  creditPill: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  creditPillText: {
    color: colors.success,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  walletLoading: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 44,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  balanceLabel: {
    color: "#eeeaff",
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  balance: {
    color: colors.surface,
    fontFamily: fonts.extrabold,
    fontSize: 30,
    marginVertical: spacing.xs,
  },
  balanceHint: {
    color: "#eeeaff",
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  dailyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  dailyHeading: {
    alignItems: "center",
    backgroundColor: "#faf9ff",
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  dailyHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  dailyTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  dailyCaption: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  dailyTotal: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  dailyRow: {
    alignItems: "center",
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  dailyRowCopy: {
    flex: 1,
    gap: 2,
  },
  dailyRowTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  dailyEarned: {
    color: colors.success,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  dailyAvailable: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  referralButton: {
    alignItems: "center",
    backgroundColor: "#f7f4ff",
    borderColor: "#c9bcff",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  referralButtonDisabled: {
    opacity: 0.65,
  },
  referralButtonText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  qrCard: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 10,
  },
  qrHint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  walletToken: {
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  walletTokenValue: {
    alignItems: "center",
    backgroundColor: "#fbfdff",
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: 7,
  },
  walletTokenCode: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    color: colors.ink,
    flex: 1,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  copyButtonText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  rewardSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  rewardTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  rewardList: {
    gap: spacing.sm,
  },
  rewardCard: {
    gap: spacing.sm,
  },
  rewardRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rewardCode: {
    color: colors.ink,
    flex: 1,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
  },
  rewardMeta: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  rewardArrow: {
    transform: [{ rotate: "0deg" }],
  },
  rewardArrowExpanded: {
    transform: [{ rotate: "90deg" }],
  },
  rewardDetails: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  rewardQr: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 168,
    width: 168,
  },
  rewardActions: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  rewardActionButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  rewardActionText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.78,
  },
  notice: {
    backgroundColor: colors.successSoft,
    borderColor: "#bcebc9",
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  noticeText: {
    color: "#147a36",
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  retry: {
    marginBottom: spacing.md,
  },
});
