// @vitest-environment jsdom
import { Suspense, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const { DashboardShell, useRouteNavigation } = await import(
  "@/app/dashboard/_components/DashboardShell"
);

/**
 * The shell decides *when* a route placeholder is worth drawing. Painting it
 * from the click made every navigation flash one, including the ones the
 * router answers out of its own cache — going back to a page visited a moment
 * ago showed a skeleton over a page that was already in hand.
 */
describe("dashboard route placeholder timing", () => {
  /** Suspends the "page" on demand, the way a real route transition does. */
  let blockPage: (blocked: boolean) => void = () => {};
  let releasePage: () => void = () => {};

  function Page() {
    const [blocked, setBlocked] = useState(false);
    blockPage = setBlocked;
    if (blocked) {
      throw new Promise<void>((resolve) => {
        releasePage = () => {
          setBlocked(false);
          resolve();
        };
      });
    }
    return <p>Campaigns page</p>;
  }

  function NavLink() {
    const { navigate } = useRouteNavigation();
    return (
      <button
        onClick={() => navigate("/dashboard/campaigns", <p>Route skeleton</p>)}
        type="button"
      >
        Campaigns
      </button>
    );
  }

  function renderShell() {
    return render(
      <DashboardShell sidebar={<NavLink />}>
        <Suspense fallback={<p>Segment fallback</p>}>
          <Page />
        </Suspense>
      </DashboardShell>,
    );
  }

  beforeEach(() => {
    // The suite-wide setup fakes Date only, and a second install over a live
    // clock is ignored — so the timers this component runs on would stay real
    // and never fire. Uninstall first, then take over Date and timers together
    // so advancing them moves both.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  function clickNav() {
    act(() => {
      screen.getByRole("button", { name: "Campaigns" }).click();
    });
  }

  it("draws no placeholder when the navigation resolves immediately", () => {
    renderShell();
    clickNav();

    // A cached navigation: the router commits without the page suspending.
    expect(screen.queryByText("Route skeleton")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText("Route skeleton")).toBeNull();
    expect(screen.getByText("Campaigns page")).toBeTruthy();
    expect(push).toHaveBeenCalledWith("/dashboard/campaigns");
  });

  it("draws the placeholder once a navigation outlasts the delay", () => {
    push.mockImplementation(() => blockPage(true));
    renderShell();
    clickNav();

    // Still nothing at the moment of the click, and nothing just before the
    // threshold — this window is where a cached navigation lands.
    expect(screen.queryByText("Route skeleton")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText("Route skeleton")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText("Route skeleton")).toBeTruthy();
  });

  it("holds a drawn placeholder long enough not to blink", () => {
    push.mockImplementation(() => blockPage(true));
    renderShell();
    clickNav();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText("Route skeleton")).toBeTruthy();

    // The page arrives right after the placeholder went up.
    act(() => {
      releasePage();
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByText("Route skeleton")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText("Route skeleton")).toBeNull();
    expect(screen.getByText("Campaigns page")).toBeTruthy();
  });
});
