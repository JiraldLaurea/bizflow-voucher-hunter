import { Stack } from "expo-router";

import { colors } from "@/theme";

/**
 * The storefront's own navigator: partners, then that partner's items, then the
 * item. Grouping them under one stack also gives the tab layout a single route
 * to hide, instead of every screen leaking in as its own tab button.
 */
export default function ShopLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="purchases" />
      <Stack.Screen name="[businessId]/index" />
      {/* Under a static `item` segment so the partner's own path stays
          unambiguous: as a bare sibling, `[productId]` also matched
          /shop/<business>/index and the detail screen loaded with the
          literal id "index". */}
      <Stack.Screen name="[businessId]/item/[productId]" />
    </Stack>
  );
}
