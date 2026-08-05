import { type Href, useLocalSearchParams, useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getOrCreateRewardWallet,
  listRewardProducts,
  type RewardProduct,
  type RewardWalletSnapshot,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { RewardProductImage } from "@/components/RewardProductImage";
import { StepHeader } from "@/components/HuntUi";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

/** Step 2: what this partner sells for LP, and what this balance can reach. */
export default function ShopProductsScreen() {
  const t = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ businessId: string }>();
  const businessId = Array.isArray(params.businessId)
    ? params.businessId[0]
    : params.businessId;

  const [products, setProducts] = useState<RewardProduct[]>([]);
  const [wallet, setWallet] = useState<RewardWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (asRefresh = false) => {
      if (!token || !businessId) return;
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [items, snapshot] = await Promise.all([
          listRewardProducts(token, businessId),
          getOrCreateRewardWallet(token),
        ]);
        setProducts(items);
        setWallet(snapshot);
      } catch (caught) {
        setError(caught);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessId, token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const balanceCentavos = wallet?.wallet.balanceCentavos ?? 0;
  const businessName = products[0]?.businessName ?? t("shop.title");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader onBack={() => router.back()} title={businessName} />
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
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>{t("shop.balanceLabel")}</Text>
          <Text style={styles.balanceValue}>{wallet?.balance ?? "—"}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <ErrorState
            error={error}
            fallback={t("shop.loadError")}
            onRetry={() => void load()}
          />
        ) : products.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("shop.empty")}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {products.map((product) => {
              const affordable = balanceCentavos >= product.priceCentavos;
              return (
                <Pressable
                  key={product.id}
                  onPress={() =>
                    router.push(
                      `/shop/${encodeURIComponent(businessId)}/item/${encodeURIComponent(product.id)}` as Href,
                    )
                  }
                  style={({ pressed }) => [
                    styles.card,
                    !affordable && styles.cardLocked,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <RewardProductImage
                    borderRadius={11}
                    product={product}
                    style={styles.cardMedia}
                  />
                  <View style={styles.cardRow}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardName}>{product.name}</Text>
                    {product.description ? (
                      <Text numberOfLines={2} style={styles.cardDescription}>
                        {product.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardSide}>
                    <Text style={styles.cardPrice}>{product.price}</Text>
                    {affordable ? (
                      <Icon name="chevron-right" size={18} />
                    ) : (
                      <Text style={styles.cardShort}>
                        {t("shop.shortBy", {
                          amount: `${(
                            (product.priceCentavos - balanceCentavos) / 100
                          ).toLocaleString("en-PH")} LP`,
                        })}
                      </Text>
                    )}
                  </View>
                  </View>
                </Pressable>
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
  balanceRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.soft,
  },
  balanceLabel: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  balanceValue: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 16,
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
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardMedia: {
    marginBottom: 2,
  },
  cardRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  cardLocked: {
    opacity: 0.62,
  },
  cardPressed: {
    borderColor: "rgba(92, 61, 255, 0.35)",
    transform: [{ scale: 0.99 }],
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
  cardDescription: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  cardSide: {
    alignItems: "flex-end",
    gap: 4,
  },
  cardPrice: {
    color: colors.primary,
    fontFamily: fonts.extrabold,
    fontSize: 15,
  },
  cardShort: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: "right",
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
    textAlign: "center",
  },
});
