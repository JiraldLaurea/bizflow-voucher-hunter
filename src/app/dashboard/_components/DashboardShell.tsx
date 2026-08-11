"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
 */
type RouteNavigation = {
  /** The href being waited on, or null when nothing is in flight. */
  pendingHref: string | null;
  navigate: (href: string, skeleton: ReactNode) => void;
};

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
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const navigate = useCallback(
    (href: string, skeleton: ReactNode) => {
      setPending({ href, skeleton });
      startNavigation(() => {
        router.push(href);
      });
    },
    [router],
  );

  // The transition resolves when the new page commits, so the placeholder is
  // dropped with it rather than lingering as a stale render.
  useEffect(() => {
    if (!isNavigating) setPending(null);
  }, [isNavigating]);

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
          {isNavigating && pending ? pending.skeleton : children}
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
