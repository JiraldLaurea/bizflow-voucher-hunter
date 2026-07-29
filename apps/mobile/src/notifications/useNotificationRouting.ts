import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

type NotificationResponse = import("expo-notifications").NotificationResponse;
type NotificationsModule = typeof import("expo-notifications");

/**
 * Routes a tapped notification to the screen its payload names.
 *
 * The server sets `data.type` plus whatever that type needs. Mapping lives here
 * rather than in the payload so a change of navigation structure does not
 * require re-issuing notifications that are already queued on devices.
 */
type Destination =
  | { pathname: "/campaign/[slug]"; params: { slug: string } }
  | { pathname: "/vouchers/[voucherId]"; params: { voucherId: string } }
  | { pathname: "/more" };

export function resolveNotification(data: unknown): Destination | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  const type = typeof payload.type === "string" ? payload.type : "";
  const slug = typeof payload.campaignSlug === "string" ? payload.campaignSlug : "";
  const voucherId = typeof payload.voucherId === "string" ? payload.voucherId : "";

  switch (type) {
    case "reservation_reminder":
      // The voucher QR is what they need at the outlet.
      if (voucherId) return { pathname: "/vouchers/[voucherId]", params: { voucherId } };
      return slug ? { pathname: "/campaign/[slug]", params: { slug } } : null;
    case "referral_converted":
      return slug ? { pathname: "/campaign/[slug]", params: { slug } } : null;
    case "daily_loyalty":
    case "loyalty_credited":
      // Both land on the wallet, which is where LP lives.
      return { pathname: "/more" };
    default:
      return null;
  }
}

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo()) return null;
  return import("expo-notifications").catch(() => null);
}

/**
 * Handles taps on notifications, including the cold-start case where the app was
 * launched by the tap and the navigator is not mounted yet.
 */
export function useNotificationRouting(ready: boolean) {
  const router = useRouter();
  const pending = useRef<Destination | null>(null);
  const handledColdStart = useRef(false);

  useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | null = null;

    void getNotifications().then((Notifications) => {
      if (!mounted || !Notifications) return;

      subscription = Notifications.addNotificationResponseReceivedListener(
        (response: NotificationResponse) => {
          const destination = resolveNotification(
            response.notification.request.content.data,
          );
          if (destination) pending.current = destination;
        },
      );

      // A tap that launched the app is not delivered to the listener above.
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!mounted || !response || handledColdStart.current) return;
        handledColdStart.current = true;
        const destination = resolveNotification(
          response.notification.request.content.data,
        );
        if (destination) pending.current = destination;
      });
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const destination = pending.current;
    if (!destination) return;
    pending.current = null;
    router.replace(destination);
  }, [ready, router]);
}
