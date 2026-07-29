import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiRequest } from "@/api/client";

/**
 * Push registration.
 *
 * Remote push is unavailable in Expo Go on Android from SDK 53 onward, so this
 * only does anything in a development or production build. Emulators have no
 * push transport at all, hence the `Device.isDevice` guard — without it the
 * token request throws on every simulator run.
 */

export type PushPreferences = {
  daily: boolean;
  reservation: boolean;
  rewards: boolean;
};

type PushDevice = {
  id: string;
  expoPushToken: string;
  dailyEnabled: boolean;
  reservationEnabled: boolean;
  rewardsEnabled: boolean;
};

/** Foreground presentation: without this a notification arriving while the app
 *  is open is delivered silently and the customer never sees it. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Asks for permission and returns the Expo push token, or null when push is
 * unavailable (simulator, permission denied, Expo Go, missing EAS project).
 * Never throws — a customer refusing notifications must not break sign-in.
 */
export async function acquirePushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      // Android 13+ will not show the permission prompt without a channel.
      await Notifications.setNotificationChannelAsync("default", {
        name: "Voucher Hunt",
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      // Only prompt if the OS still allows it; re-asking after a hard denial is
      // a no-op and just burns the one prompt Android grants.
      if (!existing.canAskAgain) return null;
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const id = projectId();
    if (!id) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return token.data ?? null;
  } catch {
    return null;
  }
}

/** Registers the token against the signed-in phone. Best-effort. */
export async function registerPushToken(token: string, authToken: string) {
  try {
    await apiRequest<PushDevice>("/api/public/notifications/devices", {
      method: "POST",
      body: { expoPushToken: token, platform: Platform.OS },
      token: authToken,
    });
  } catch {
    // A registration failure only costs notifications, never the session.
  }
}

/** Drops the device server-side so a signed-out phone stops receiving pushes. */
export async function unregisterPushToken(token: string, authToken: string) {
  try {
    await apiRequest("/api/public/notifications/devices", {
      method: "DELETE",
      body: { expoPushToken: token },
      token: authToken,
    });
  } catch {
    // Ignored: sign-out must complete regardless.
  }
}

export async function fetchPushPreferences(
  authToken: string,
): Promise<PushPreferences | null> {
  try {
    const devices = await apiRequest<PushDevice[]>(
      "/api/public/notifications/devices",
      { token: authToken },
    );
    const device = devices[0];
    if (!device) return null;
    return {
      daily: device.dailyEnabled,
      reservation: device.reservationEnabled,
      rewards: device.rewardsEnabled,
    };
  } catch {
    return null;
  }
}

export async function updatePushPreferences(
  next: Partial<PushPreferences>,
  authToken: string,
) {
  return apiRequest<PushDevice[]>("/api/public/notifications/devices", {
    method: "PATCH",
    body: next,
    token: authToken,
  });
}
