"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouteNavigation } from "./DashboardShell";
import { FormSkeleton } from "./FormSkeleton";
import { formSkeletons, type FormSkeletonName } from "./formSkeletons";

/**
 * A link to a form route that paints the form placeholder from the click.
 *
 * The sidebar already does this for the list pages; opening a form was the one
 * navigation left that sat on the old page for the whole server round trip,
 * because the App Router can only fall back to a segment's `loading.tsx` once
 * that boundary is in its client cache. This is the same trick the sidebar
 * uses, aimed at the "New campaign" / "New business" / "Edit" buttons: the
 * shell swaps in the skeleton immediately and the route's own `loading.tsx`
 * still covers the arrivals a click cannot see.
 */
export function FormLink({
  children,
  className,
  href,
  skeleton,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  /** Which form is coming; the shapes live in `formSkeletons`. */
  skeleton: FormSkeletonName;
}) {
  const pathname = usePathname();
  const { navigate } = useRouteNavigation();

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // A modified click means open elsewhere — that is the browser's to handle,
    // and swapping this tab to a skeleton for it would be wrong twice over.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    // Already here: nothing is going to load, so nothing should blank out.
    if (pathname === href.split("?")[0]) return;
    event.preventDefault();
    navigate(href, <FormSkeleton cards={formSkeletons[skeleton]} />);
  }

  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}
