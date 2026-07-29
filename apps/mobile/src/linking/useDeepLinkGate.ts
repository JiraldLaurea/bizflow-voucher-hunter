import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * A deep link the app knows how to open, resolved to a typed route.
 *
 * Only customer destinations are listed. Referral links deliberately are not: the
 * `/api/public/referral/visit` handoff grants the bonus spin from a real browser
 * visit (cookie + JS handoff, so crawlers cannot claim it), and swallowing it into
 * the app would silently drop the reward. Those stay in the browser.
 */
type Destination =
  | { pathname: "/campaign/[slug]"; params: { slug: string } }
  | { pathname: "/vouchers/[voucherId]"; params: { voucherId: string } };

/**
 * Maps an incoming URL to a route. Handles both the custom scheme
 * (`voucherhunt://campaign/july-dinner`) and verified web links
 * (`https://host/campaign/july-dinner`), because `Linking.parse` normalises both
 * down to the same path.
 */
export function resolveDeepLink(url: string): Destination | null {
  let parsed: ReturnType<typeof Linking.parse>;
  try {
    parsed = Linking.parse(url);
  } catch {
    return null;
  }

  // Custom-scheme URLs parse their first segment as the hostname
  // (`voucherhunt://campaign/x` → hostname "campaign", path "x") while https URLs
  // put everything in the path. Joining the two handles both, and also the
  // triple-slash form `voucherhunt:///campaign/x` where the hostname is empty.
  const segments = [parsed.hostname ?? "", parsed.path ?? ""]
    .join("/")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (segments.length < 2) return null;

  const [head, value] = segments;
  if (head === "campaign" && value) {
    return { pathname: "/campaign/[slug]", params: { slug: value } };
  }
  if (head === "vouchers" && value) {
    return { pathname: "/vouchers/[voucherId]", params: { voucherId: value } };
  }
  return null;
}

/**
 * Keeps a deep link alive across the sign-in gate.
 *
 * Expo Router applies `Stack.Protected` the moment the navigator mounts, so a cold
 * start into `/campaign/x` while signed out is redirected to sign-in and the
 * intended destination is lost — the visitor verifies an OTP and lands on the
 * generic home tab instead of the campaign someone shared with them. This holds the
 * destination and replays it once a token exists.
 */
export function useDeepLinkGate(token: string | null, authReady: boolean) {
  const router = useRouter();
  const pending = useRef<Destination | null>(null);
  const replayed = useRef(false);

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then((url) => {
      if (!active || !url) return;
      pending.current = resolveDeepLink(url) ?? pending.current;
    });

    // Warm starts: the app is already running when the link is opened.
    const subscription = Linking.addEventListener("url", ({ url }) => {
      pending.current = resolveDeepLink(url) ?? pending.current;
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !token) return;
    const destination = pending.current;
    if (!destination || replayed.current) return;
    // Cleared before navigating so a re-render cannot fire this twice.
    pending.current = null;
    replayed.current = true;
    router.replace(destination);
  }, [authReady, router, token]);
}
