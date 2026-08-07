"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiBriefcase,
  FiExternalLink,
  FiLogOut,
  FiMoreHorizontal,
} from "react-icons/fi";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  staff: "Staff",
};

/**
 * Up to two letters for the avatar. Falls back to the email when the name is a
 * single word or missing entirely, so the tile is never blank.
 */
function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/**
 * The signed-in account at the foot of the sidebar: a compact row that opens a
 * menu.
 *
 * The row is what you see at rest — avatar, name, and a hint that there is more
 * behind it. Everything else (the full email, the role, and the two actions)
 * lives in the menu, so the sidebar's last 40px stop competing with the nav
 * above them. Signing out in particular is safer one deliberate step in than
 * sitting permanently under the cursor.
 *
 * The panel opens upward because the trigger is pinned to the bottom of a
 * full-height column; downward would run it off the viewport.
 */
export function SidebarAccountMenu({
  adminEmail,
  adminName,
  businessName,
  role,
}: {
  adminEmail: string;
  adminName: string;
  /** The business a staff account is scoped to. Admins see every business, so
      they are passed nothing and the line is left out. */
  businessName?: string;
  role: "super_admin" | "admin" | "staff";
}) {
  const router = useRouter();
  const baseId = useId();
  const menuId = `${baseId}-menu`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{
    left: number;
    bottom: number;
    minWidth: number;
  } | null>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  /**
   * The sidebar scrolls (`overflow-y: auto`), and CSS will not let one axis
   * clip while the other stays visible — so an absolutely positioned panel was
   * cut off at the sidebar's edge and grew it a horizontal scrollbar. The menu
   * is `position: fixed` instead, measured off the trigger, which takes it out
   * of the scroll container entirely.
   *
   * Measured on open rather than in a layout effect so the panel's first paint
   * is already in the right place, with no frame at the default position.
   */
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlacement({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 8,
      minWidth: rect.width,
    });
  }, []);

  // Same dismissal contract as SelectMenu: pointerdown outside closes.
  useEffect(() => {
    if (!open) return;
    function closeWhenOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [open]);

  // A fixed panel does not travel with the trigger, so it is re-measured while
  // open. Scroll is listened for on the capture phase because scroll events do
  // not bubble — that catches the sidebar's own scrolling as well as the
  // page's, without having to find the scroll container first.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Opening moves focus into the menu, which is what makes Escape and the
  // arrow keys reachable without the pointer.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function moveFocus(step: 1 | -1) {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (items.length === 0) return;
    const current = items.findIndex((item) => item === document.activeElement);
    // Wraps, so Up from the first item lands on the last rather than escaping.
    const next = (current + step + items.length) % items.length;
    items[next]?.focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="sidebar-account" ref={rootRef}>
      {open && placement ? (
        <div
          className="sidebar-account-menu"
          id={menuId}
          onKeyDown={onMenuKeyDown}
          role="menu"
          style={{
            left: placement.left,
            bottom: placement.bottom,
            minWidth: placement.minWidth,
          }}
        >
          <div className="sidebar-account-menu-header">
            <span className="sidebar-account-role">
              {ROLE_LABELS[role] ?? role}
            </span>
            <strong title={adminName}>{adminName}</strong>
            <span className="sidebar-account-email" title={adminEmail}>
              {adminEmail}
            </span>
            {businessName ? (
              <span className="sidebar-account-business" title={businessName}>
                <FiBriefcase aria-hidden="true" />
                <span>{businessName}</span>
              </span>
            ) : null}
          </div>

          <div className="sidebar-account-menu-items">
            {/* Opens in its own tab: it leaves the console, and reusing this
                tab would discard whatever was half-filled here. */}
            <a
              className="sidebar-account-item"
              href="/"
              ref={(node) => {
                itemRefs.current[0] = node;
              }}
              rel="noreferrer"
              role="menuitem"
              target="_blank"
            >
              Landing page
              <FiExternalLink aria-hidden="true" />
            </a>
            <button
              className="sidebar-account-item is-signout"
              onClick={logout}
              ref={(node) => {
                itemRefs.current[1] = node;
              }}
              role="menuitem"
              type="button"
            >
              Sign out
              <FiLogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${adminName}`}
        className={`sidebar-account-trigger${open ? " is-open" : ""}`}
        onClick={() => {
          if (open) {
            close(false);
            return;
          }
          place();
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className="sidebar-avatar">
          {initials(adminName, adminEmail)}
        </span>
        <span className="sidebar-account-name">{adminName}</span>
        <span aria-hidden="true" className="sidebar-account-more">
          <FiMoreHorizontal />
        </span>
      </button>
    </div>
  );
}
