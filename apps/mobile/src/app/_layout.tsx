import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { LoyaltyAwardModal } from "@/components/LoyaltyAwardModal";
import { OverlayProvider, useOverlay } from "@/components/OverlayHost";
import { useDeepLinkGate } from "@/linking/useDeepLinkGate";
import { useNotificationRouting } from "@/notifications/useNotificationRouting";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

const LOYALTY_AWARD_OVERLAY = "daily-loyalty-award";

function RootNavigator() {
  const {
    dismissLoyaltyAward,
    isLoading,
    loyaltyAward,
    token,
  } = useAuth();
  const { dismiss, present } = useOverlay();
  // The web customer UI is set in Inter. Without this Android falls back to
  // Roboto and every screen reads subtly differently from the web.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });
  const ready = !isLoading && fontsLoaded;
  // Holds a shared campaign/voucher link across the sign-in gate so it is not lost
  // when a signed-out visitor is bounced to the OTP screen.
  useDeepLinkGate(token, ready);
  // Tapping a notification routes to the screen its payload names, including
  // when the tap is what launched the app.
  useNotificationRouting(ready && Boolean(token));

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    if (!ready || !token || !loyaltyAward) {
      dismiss(LOYALTY_AWARD_OVERLAY);
      return;
    }

    present(
      LOYALTY_AWARD_OVERLAY,
      <LoyaltyAwardModal
        balance={loyaltyAward.balance}
        onConfirm={() => {
          dismiss(LOYALTY_AWARD_OVERLAY);
          dismissLoyaltyAward();
        }}
        points={loyaltyAward.points}
      />,
    );

    return () => {
      dismiss(LOYALTY_AWARD_OVERLAY);
    };
  }, [
    dismiss,
    dismissLoyaltyAward,
    loyaltyAward,
    present,
    ready,
    token,
  ]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
        <Stack.Protected guard={!token}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(token)}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <OverlayProvider>
        <RootNavigator />
      </OverlayProvider>
    </AuthProvider>
  );
}
