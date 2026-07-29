import { Stack } from "expo-router";

import { colors } from "@/theme";

/**
 * The wallet and its detail screen are a stack inside the Vouchers tab, so the
 * bottom bar stays visible on the detail — as it does on the web, where
 * `VoucherDetail` renders `CustomerBottomNav` itself.
 */
export default function VouchersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[voucherId]" />
    </Stack>
  );
}
