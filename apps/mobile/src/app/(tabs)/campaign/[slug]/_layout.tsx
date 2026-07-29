import { Stack, useLocalSearchParams } from "expo-router";

import { HuntProvider } from "@/hunt/HuntContext";
import { colors } from "@/theme";

/**
 * All six hunt steps share one navigator so they can share flow state. On the
 * web each step is a separate document, which is why that version has to round-trip
 * everything through localStorage.
 */
export default function CampaignLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  // Keyed by slug so switching campaigns remounts the provider. Expo Router keeps
  // this layout mounted and only swaps the param, so without the key the previous
  // campaign's flow — its issued voucher above all — leaks into the next one and
  // the landing offers a voucher belonging to a different hunt.
  return (
    <HuntProvider key={slug} slug={slug}>
      <Stack
        key={`campaign-stack-${slug}`}
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="index" />
        {/* The reel must not be swipe-dismissible mid-spin: the draw is already
            committed server-side by then. */}
        <Stack.Screen name="roulette" options={{ gestureEnabled: false }} />
        <Stack.Screen name="results" />
        <Stack.Screen name="datetime" />
        <Stack.Screen name="confirm" />
        <Stack.Screen name="confirmation" options={{ gestureEnabled: false }} />
      </Stack>
    </HuntProvider>
  );
}
