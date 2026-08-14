"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

/**
 * A navigation the sidebar has started and the shell is drawing a placeholder
 * for.
 *
 * Each segment has a `loading.tsx`, but the App Router can only fall back to it
 * once that boundary is in its client cache — which means a prefetch, and
 * prefetching is off in development. Without one the router holds the old page
 * on screen for the whole server round trip, so a click did nothing visible for
 * as long as the render took. Showing the placeholder from the click instead
 * makes it immediate wherever the route came from, and the `loading.tsx` files
 * still cover the arrivals this cannot see: a refresh, a deep link, Back.
 *
 * The placeholder is held back briefly (see SKELETON_DELAY_MS) so a navigation
 * the router can answer from its own cache never draws one at all.
 */
type RouteNavigation = {
  /** The href being waited on, or null when nothing is in flight. */
  pendingHref: string | null;
  navigate: (href: string, skeleton: ReactNode) => void;
};

/**
 * How long a navigation has to be in flight before its placeholder is drawn.
 *
 * Not every click is a round trip. Returning to a page visited moments ago is
 * served from the router's client cache and commits within a frame or two, and
 * painting the skeleton from the click flashed a placeholder over a page that
 * was already in hand — the flicker was the fix, not the load. Past this point
 * the render is a real wait and the placeholder is what makes the click feel
 * answered.
 */
const SKELETON_DELAY_MS = 120;
/**
 * Once drawn, the placeholder stays this long. Without it a navigation landing
 * just past the delay would blink the skeleton for a few milliseconds, which is
 * the same flicker moved rather than removed.
 */
const SKELETON_MIN_MS = 220;

const RouteNavigationContext = createContext<RouteNavigation | null>(null);

export function useRouteNavigation() {
  const navigation = useContext(RouteNavigationContext);
  if (!navigation) {
    throw new Error("useRouteNavigation must be used inside DashboardShell");
  }
  return navigation;
}

export function DashboardShell({
  children,
  sidebar,
}: {
  children: ReactNode;
  /** Rendered outside the swapped region: the nav stays put while the page
      behind it changes, which is the point of it being a sidebar. */
  sidebar: ReactNode;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<{
    href: string;
    skeleton: ReactNode;
  } | null>(null);
  // Separate from `pending`: the destination is known from the click (the
  // sidebar highlights it straight away), but whether it is worth covering the
  // page for is only known once it has taken long enough.
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the placeholder went up, or 0 while none is showing. */
  const shownAtRef = useRef(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const clearTimers = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const navigate = useCallback(
    (href: string, skeleton: ReactNode) => {
      clearTimers();
      setPending({ href, skeleton });
      setShowSkeleton(false);
      shownAtRef.current = 0;
      delayRef.current = setTimeout(() => {
        delayRef.current = null;
        shownAtRef.current = Date.now();
        setShowSkeleton(true);
      }, SKELETON_DELAY_MS);
      startNavigation(() => {
        router.push(href);
      });
    },
    [clearTimers, router],
  );

  // The transition resolves when the new page commits. A placeholder that never
  // went up is cancelled here — that is the cached navigation, and the page it
  // would have covered is already on screen. One that did serves out its
  // minimum before the page behind it is revealed.
  useEffect(() => {
    if (isNavigating) return;
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }

    const shownAt = shownAtRef.current;
    const remaining = shownAt ? SKELETON_MIN_MS - (Date.now() - shownAt) : 0;
    if (remaining <= 0) {
      shownAtRef.current = 0;
      setPending(null);
      setShowSkeleton(false);
      return;
    }

    holdRef.current = setTimeout(() => {
      holdRef.current = null;
      shownAtRef.current = 0;
      setPending(null);
      setShowSkeleton(false);
    }, remaining);
    return () => {
      if (holdRef.current) {
        clearTimeout(holdRef.current);
        holdRef.current = null;
      }
    };
  }, [isNavigating]);

  // A click that lands mid-navigation must not leave a timer behind to raise a
  // placeholder over a shell that is gone.
  useEffect(() => clearTimers, [clearTimers]);

  const navigation = useMemo(
    () => ({
      pendingHref: isNavigating ? (pending?.href ?? null) : null,
      navigate,
    }),
    [isNavigating, pending, navigate],
  );

  return (
    <RouteNavigationContext.Provider value={navigation}>
      <main className="admin-shell">
        {sidebar}
        <section className="admin-main">
          {showSkeleton && pending ? pending.skeleton : children}
        </section>
        {!hydrated ? (
          <div
            aria-busy="true"
            aria-live="polite"
            className="dashboard-hydration-gate"
            role="status"
          >
            <span className="dashboard-hydration-spinner" aria-hidden="true" />
            <strong>Preparing dashboard</strong>
            <span>Loading interactive controls...</span>
          </div>
        ) : null}
      </main>
    </RouteNavigationContext.Provider>
  );
}
