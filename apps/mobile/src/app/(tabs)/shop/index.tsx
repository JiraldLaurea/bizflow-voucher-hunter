import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  partnerBalance,
  type RewardProduct,
  type RewardWalletSnapshot,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { CampaignImage } from "@/components/CampaignImage";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { StepHeader } from "@/components/HuntUi";
import { ShopTabs } from "@/components/ShopTabs";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

type Storefront = {
  businessId: string;
  businessName: string;
  businessIndustry?: string;
  itemCount: number;
  cheapestCentavos: number;
  cheapestPrice: string;
  campaign?: RewardProduct["campaign"];
};

/**
 * Step 1 of spending LP: which partner. Items are redeemed at the counter of
 * the partner that sells them, so the partner — not the item — is the real
 * first choice, and a flat list of every item across the network buries that.
 */
export default function ShopBusinessesScreen() {
  const t = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const [products, setProducts] = useState<RewardProduct[]>([]);
  const [wallet, setWallet] = useState<RewardWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (asRefresh = false) => {
      if (!token) return;
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [items, snapshot] = await Promise.all([
          listRewardProducts(token),
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
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Grouped here rather than server-side: the catalogue is small, one request
  // feeds both this screen and the affordability hints on it.
  const storefronts = useMemo(() => {
    const byBusiness = new Map<string, Storefront>();
    for (const product of products) {
      const existing = byBusiness.get(product.businessId);
      if (!existing) {
        byBusiness.set(product.businessId, {
          businessId: product.businessId,
          businessName: product.businessName,
          businessIndustry: product.businessIndustry,
          itemCount: 1,
          cheapestCentavos: product.priceCentavos,
          cheapestPrice: product.price,
          campaign: product.campaign,
        });
        continue;
      }
      existing.itemCount += 1;
      if (product.priceCentavos < existing.cheapestCentavos) {
        existing.cheapestCentavos = product.priceCentavos;
        existing.cheapestPrice = product.price;
      }
    }
    return [...byBusiness.values()].sort((a, b) =>
      a.businessName.localeCompare(b.businessName),
    );
  }, [products]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      {/* No back affordance: this is a bottom-tab root, so there is nothing
          within the storefront to go back to. */}
      <StepHeader title={t("shop.title")} />
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
        <ShopTabs active="shop" />

        {/* The balance and the way to spend it are one card, not two. Splitting
            them printed the same figure twice and made the second card look
            like a different pot. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/shop/global" as Href)}
          style={({ pressed }) => [pressed && styles.globalPressed]}
        >
          <LinearGradient
            colors={["#6637ff", "#7a44f4"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>{t("shop.balanceLabel")}</Text>
            <Text style={styles.balanceValue}>{wallet?.balance ?? "—"}</Text>
            <Text style={styles.balanceHint}>{t("shop.globalHint")}</Text>
            <View style={styles.globalCta}>
              <Text style={styles.globalCtaText}>
                {t("shop.globalStoreMeta")}
              </Text>
              <Icon color={colors.surface} name="chevron-right" size={18} />
            </View>
          </LinearGradient>
        </Pressable>

        <Text style={styles.sectionTitle}>{t("shop.pickBusiness")}</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <ErrorState
            error={error}
            fallback={t("shop.loadError")}
            onRetry={() => void load()}
          />
        ) : storefronts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("shop.empty")}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {storefronts.map((storefront) => {
              // Each partner is priced against its own bucket, so two cards on
              // this screen can disagree about what the holder can afford.
              const here = partnerBalance(wallet, storefront.businessId);
              const anyAffordable =
                here.balanceCentavos >= storefront.cheapestCentavos;
              return (
                <Pressable
                  key={storefront.businessId}
                  onPress={() =>
                    router.push(
                      // The industry rides along so the next screen can paint
                      // its colour on the first frame. Without it that screen
                      // has no products yet, falls back to the neutral tone and
                      // visibly flips colour once they load.
                      `/shop/${encodeURIComponent(storefront.businessId)}?industry=${encodeURIComponent(
                        storefront.businessIndustry ?? "",
                      )}` as Href,
                    )
                  }
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {storefront.campaign ? (
                    <CampaignImage
                      borderRadius={11}
                      campaign={storefront.campaign}
                      style={styles.cardMedia}
                    />
                  ) : null}
                  <View style={styles.cardRow}>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardName}>
                        {storefront.businessName}
                      </Text>
                      {/* Catalogue facts on one line: how many, and the cheapest.
                          They describe the shop, not the holder. */}
                      <Text style={styles.cardMeta}>
                        {t("shop.itemSummary", {
                          count: storefront.itemCount,
                          price: storefront.cheapestPrice,
                        })}
                      </Text>
                      {/* The holder's own balance is a different kind of fact, so
                          it gets a pill rather than a third grey line that reads
                          as more catalogue copy. Tinted when it can buy
                          something here, muted when it cannot. */}
                      <View
                        style={[
                          styles.balancePill,
                          anyAffordable
                            ? styles.balancePillReady
                            : styles.balancePillEmpty,
                        ]}
                      >
                        <Text
                          style={[
                            styles.balancePillText,
                            anyAffordable
                              ? styles.balancePillTextReady
                              : styles.balancePillTextEmpty,
                          ]}
                        >
                          {here.balanceCentavos > 0
                            ? t("shop.yourBalanceHere", { amount: here.balance })
                            : t("shop.noBalanceHere")}
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={18} />
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
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  globalPressed: {
    opacity: 0.9,
  },
  globalCta: {
    alignItems: "center",
    borderTopColor: "rgba(255, 255, 255, 0.25)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  globalCtaText: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  balancePill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    marginTop: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  balancePillReady: {
    backgroundColor: "rgba(92, 61, 255, 0.1)",
  },
  balancePillEmpty: {
    backgroundColor: colors.page,
  },
  balancePillText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  balancePillTextReady: {
    color: colors.primary,
  },
  balancePillTextEmpty: {
    color: colors.textMuted,
  },
  balanceLabel: {
    color: "#eeeaff",
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  balanceValue: {
    color: colors.surface,
    fontFamily: fonts.extrabold,
    fontSize: 30,
    marginVertical: spacing.xs,
  },
  balanceHint: {
    color: "#eeeaff",
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
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
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
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
  cardMeta: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
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
