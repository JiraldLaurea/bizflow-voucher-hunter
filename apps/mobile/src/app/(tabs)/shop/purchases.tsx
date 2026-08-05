import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { listRewardPurchases, type RewardPurchasedItem } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { CopyableCode } from "@/components/CopyableCode";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { StepHeader } from "@/components/HuntUi";
import { RewardProductImage } from "@/components/RewardProductImage";
import { ShopTabs } from "@/components/ShopTabs";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

/**
 * Everything bought with LP. The QR is the whole point of the screen — it is
 * what staff scan at handover — so an uncollected item opens straight onto it
 * rather than hiding it behind another tap.
 */
export default function ShopPurchasesScreen() {
  const t = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<RewardPurchasedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [openId, setOpenId] = useState("");

  const load = useCallback(
    async (asRefresh = false) => {
      if (!token) return;
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const rows = await listRewardPurchases(token);
        setItems(rows);
        // Open the newest item still awaiting collection, so the code a
        // customer is most likely standing at a counter to show is already up.
        setOpenId(
          (current) =>
            current || (rows.find((row) => row.collectable)?.voucherId ?? ""),
        );
      } catch (caught) {
        setError(caught);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader onBack={() => router.back()} title={t("shop.title")} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ShopTabs active="purchases" />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <ErrorState
            error={error}
            fallback={t("shop.purchasesLoadError")}
            onRetry={() => void load()}
          />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("shop.purchasesEmpty")}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => {
              const open = openId === item.voucherId;
              return (
                <View
                  key={item.voucherId}
                  style={[styles.card, !item.collectable && styles.cardSpent]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    onPress={() => setOpenId(open ? "" : item.voucherId)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <RewardProductImage
                      borderRadius={11}
                      product={{
                        campaign: item.campaign,
                        imageUrl: item.productImageUrl,
                        name: item.productName,
                      }}
                      style={styles.cardMedia}
                    />
                    <View style={styles.cardRow}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardName}>{item.productName}</Text>
                        <Text style={styles.cardBusiness}>
                          {item.businessName}
                        </Text>
                        <View style={styles.badgeRow}>
                          <View
                            style={[
                              styles.badge,
                              item.collectable
                                ? styles.badgeActive
                                : styles.badgeSpent,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                item.collectable
                                  ? styles.badgeTextActive
                                  : styles.badgeTextSpent,
                              ]}
                            >
                              {item.collectable
                                ? t("shop.statusToCollect")
                                : item.status === "Redeemed"
                                  ? t("shop.statusCollected")
                                  : t("shop.statusExpired")}
                            </Text>
                          </View>
                          <Text style={styles.cardPrice}>{item.price}</Text>
                        </View>
                      </View>
                      <Icon
                        name={open ? "chevron-up" : "chevron-down"}
                        size={18}
                      />
                    </View>
                  </Pressable>

                  {open ? (
                    <View style={styles.details}>
                      {item.collectable ? (
                        <>
                          <View style={styles.qrCard}>
                            <QRCode
                              backgroundColor={colors.surface}
                              color={colors.ink}
                              quietZone={8}
                              size={170}
                              value={item.qrToken}
                            />
                          </View>
                          <Text style={styles.hint}>
                            {t("shop.receiptHint")}
                          </Text>
                        </>
                      ) : null}
                      <CopyableCode
                        label={t("shop.voucherCode")}
                        style={styles.detailRow}
                        value={item.voucherCode}
                      />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {t("shop.purchasedOn")}
                        </Text>
                        <Text style={styles.detailValue}>
                          {item.issuedAt.slice(0, 10)}
                        </Text>
                      </View>
                      {item.redeemedAt ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>
                            {t("shop.collectedOn")}
                          </Text>
                          <Text style={styles.detailValue}>
                            {item.redeemedAt.slice(0, 10)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
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
    padding: spacing.xl,
    paddingBottom: 48,
  },
  loader: {
    marginTop: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow.soft,
  },
  cardSpent: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.72,
  },
  cardMedia: {
    marginBottom: spacing.md,
  },
  cardRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  cardBusiness: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 6,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: {
    backgroundColor: colors.primarySoft,
  },
  badgeSpent: {
    backgroundColor: colors.page,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  badgeTextActive: {
    color: colors.primary,
  },
  badgeTextSpent: {
    color: colors.textMuted,
  },
  cardPrice: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  details: {
    alignItems: "center",
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  qrCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
    textAlign: "center",
  },
  detailRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  detailLabel: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  detailValue: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
