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
      {/* Browse and My items are one screen with a segmented control, not two
          places. They are separate routes only so each keeps its own URL, so
          the stack must not slide between them — toggling a control that stays
          put while the content slides in from the side reads as a mis-tap.
          Drill-down screens below keep the default push animation. */}
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="purchases" options={{ animation: "none" }} />
      {/* Drilled into from the shop, like a partner — so it slides. */}
      <Stack.Screen name="global" />
      <Stack.Screen name="[businessId]/index" />
      {/* Under a static `item` segment so the partner's own path stays
          unambiguous: as a bare sibling, `[productId]` also matched
          /shop/<business>/index and the detail screen loaded with the
          literal id "index". */}
      <Stack.Screen name="[businessId]/item/[productId]" />
    </Stack>
  );
}
