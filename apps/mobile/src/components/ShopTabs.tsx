import { type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, spacing } from "@/theme";

/**
 * Browse / bought, inside the storefront.
 *
 * Deliberately not a bottom tab: these two are one errand, and the bar is
 * reserved for the app's top-level places. `replace` rather than `push` so
 * toggling never stacks screens the back gesture has to unwind.
 */
export function ShopTabs({ active }: { active: "shop" | "purchases" }) {
  const t = useTranslation();
  const router = useRouter();

  const tabs = [
    { key: "shop" as const, href: "/shop" as Href, label: t("shop.tabBrowse") },
    {
      key: "purchases" as const,
      href: "/shop/purchases" as Href,
      label: t("shop.tabPurchases"),
    },
  ];

  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => {
              if (!selected) router.replace(tab.href);
            }}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabActive,
              pressed && !selected && styles.tabPressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginBottom: spacing.lg,
    padding: 4,
  },
  tab: {
    alignItems: "center",
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: 9,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabPressed: {
    backgroundColor: colors.page,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  labelActive: {
    color: colors.surface,
  },
});
