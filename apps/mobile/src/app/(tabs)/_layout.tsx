import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "@/theme";

/**
 * Feather, because the web's `CustomerBottomNav` uses `react-icons/fi` — the same
 * icon set — so home/bag/ellipsis render identically on both clients.
 */
function TabIcon({
  focused,
  name,
}: {
  focused: boolean;
  name: keyof typeof Feather.glyphMap;
}) {
  return (
    <Feather
      color={focused ? colors.primary : colors.textMuted}
      name={name}
      size={22}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // A fixed bar height puts the labels under the gesture pill on devices with
  // gesture navigation, so the inset is added to the bar rather than assumed away.
  const bottomInset = insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.page },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.tabBar,
          { height: 74 + bottomInset, paddingBottom: 10 + bottomInset },
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home" />,
        }}
      />
      <Tabs.Screen
        name="vouchers"
        options={{
          title: "Vouchers",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="shopping-bag" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="more-horizontal" />,
        }}
      />
      {/* Lives inside the navigator so the bottom bar stays put through the hunt —
          the web renders its BottomNav on every step — but gets no tab button. */}
      <Tabs.Screen name="campaign/[slug]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    paddingTop: 7,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
});
