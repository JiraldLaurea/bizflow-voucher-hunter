import type { CampaignCard } from "@bizflow/shared";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { listCampaigns } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { CampaignImage } from "@/components/CampaignImage";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { CAMPAIGN_MODE_LABELS } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/theme";

/** `.chip.mode-*` — one tint per industry, matching the web directory cards. */
const MODE_CHIPS: Record<
  string,
  { color: string; border: string; background: string }
> = {
  restaurant: { color: "#c2410c", border: "#fed7aa", background: "#fff7ed" },
  online_shop: { color: "#1d4ed8", border: "#bfdbfe", background: "#eff6ff" },
  beauty: { color: "#be185d", border: "#fbcfe8", background: "#fdf2f8" },
  pet: { color: "#0f766e", border: "#99f6e4", background: "#f0fdfa" },
  retail: { color: "#6d28d9", border: "#ddd6fe", background: "#f5f3ff" },
  other: { color: "#475569", border: "#e2e8f0", background: "#f8fafc" },
};

function formatRange(start: string, end: string) {
  const format = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${format(start)} – ${format(end)}`;
}

/** Port of the web `CampaignDirectory`. */
export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<CampaignCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // The raw error is kept, not a message: ErrorState needs the code to tell an
  // offline device apart from a server-side failure.
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const load = useCallback(async (asRefresh = false) => {
    if (!token) return;
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setCards(await listCampaigns(token));
    } catch (caught) {
      setError(caught);
    } finally {
      if (asRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only offer category filters that actually appear in the active campaigns.
  const categories = useMemo(() => {
    const present = new Set(cards.map((card) => String(card.businessIndustry)));
    return [
      "all",
      ...Object.keys(CAMPAIGN_MODE_LABELS).filter((mode) => present.has(mode)),
    ];
  }, [cards]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter(({ businessIndustry, businessName, campaign }) => {
      if (category !== "all" && businessIndustry !== category) return false;
      if (!needle) return true;
      return (
        campaign.title.toLowerCase().includes(needle) ||
        businessName.toLowerCase().includes(needle) ||
        (campaign.location ?? "").toLowerCase().includes(needle)
      );
    });
  }, [cards, category, query]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load(true)}
            progressBackgroundColor={colors.surface}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.title}>Find a voucher hunt</Text>
          <Text style={styles.subtitle}>
            Search active campaigns and pick one to start hunting.
          </Text>
        </View>

        <View style={styles.search}>
          <Icon color={colors.textMuted} name="search" size={17} />
          <TextInput
            accessibilityLabel="Search campaigns"
            onChangeText={setQuery}
            placeholder="Search campaign, business, or location"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            style={styles.searchInput}
            value={query}
          />
        </View>

        {categories.length > 2 ? (
          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((entry) => {
              const active = category === entry;
              return (
                <Pressable
                  key={entry}
                  onPress={() => setCategory(entry)}
                  style={[styles.filter, active && styles.filterActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {entry === "all" ? "All" : CAMPAIGN_MODE_LABELS[entry]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <ErrorState
            error={error}
            fallback="Unable to load campaigns."
            onRetry={() => void load()}
          />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {cards.length === 0
                ? "No active campaigns yet. Create one from the Admin Dashboard."
                : "No campaigns match your search."}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map(({ businessIndustry, businessName, campaign }) => {
              const chip = MODE_CHIPS[businessIndustry] ?? MODE_CHIPS.other;
              return (
                <Pressable
                  key={campaign.id}
                  onPress={() =>
                    router.push({
                      pathname: "/campaign/[slug]",
                      params: { slug: campaign.slug },
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <CampaignImage
                    borderRadius={11}
                    campaign={campaign}
                    style={styles.cardMedia}
                  />
                  <View style={styles.cardTop}>
                    <View style={styles.cardDetails}>
                      <Text style={styles.cardTitle}>{campaign.title}</Text>
                      <Text style={styles.cardBusiness}>{businessName}</Text>
                      <View style={styles.cardLocationRow}>
                        <Icon name="map-pin" size={14} />
                        <Text style={styles.cardLocation}>
                          {campaign.location ?? "Location to be announced"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: chip.background,
                          borderColor: chip.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: chip.color }]}>
                        {CAMPAIGN_MODE_LABELS[businessIndustry] ??
                          businessIndustry}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardFoot}>
                    <Text style={styles.cardDates}>
                      {formatRange(campaign.startDate, campaign.endDate)}
                    </Text>
                    <View style={styles.cardCtaRow}>
                      <Text style={styles.cardCta}>Hunt now</Text>
                      <Icon name="arrow-right" size={15} />
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
  appBar: {
    paddingHorizontal: 18,
    paddingTop: spacing.md,
  },
  appBarTitle: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 18,
  },
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: spacing.xxl,
    paddingTop: 22,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 24,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  search: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    minHeight: 46,
  },
  filterRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: "transparent",
  },
  filterText: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  filterTextActive: {
    color: colors.surface,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: "0 6px 16px rgba(11, 29, 58, 0.05)",
    gap: 6,
    padding: 16,
  },
  cardMedia: {
    marginBottom: 8,
  },
  cardPressed: {
    borderColor: "rgba(92, 61, 255, 0.35)",
    transform: [{ scale: 0.99 }],
  },
  cardTop: {
    // Without this the chip stretches to the row's full height and its pill
    // radius renders as a large ellipse (`.directory-card-top` is flex-start).
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  cardBusiness: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  cardLocation: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  cardLocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  cardCtaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  cardFoot: {
    alignItems: "center",
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
  },
  cardDates: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  cardCta: {
    color: colors.primary,
    fontFamily: fonts.extrabold,
    fontSize: 13,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 44,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: "center",
  },
});
