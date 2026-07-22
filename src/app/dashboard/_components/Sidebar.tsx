"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FiCheckSquare,
  FiClock,
  FiFlag,
  FiGift,
  FiGrid,
  FiLogOut,
  FiRepeat,
  FiSettings,
} from "react-icons/fi";

const nav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <FiGrid aria-hidden="true" />,
  },
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: <FiFlag aria-hidden="true" />,
  },
  {
    label: "Slots",
    href: "/dashboard/slots",
    icon: <FiClock aria-hidden="true" />,
  },
  {
    label: "Vouchers",
    href: "/dashboard/vouchers",
    icon: <FiGift aria-hidden="true" />,
  },
  {
    label: "Rewards Network",
    href: "/dashboard/rewards",
    icon: <FiRepeat aria-hidden="true" />,
  },
  {
    label: "Staff Validation",
    href: "/dashboard/staff",
    icon: <FiCheckSquare aria-hidden="true" />,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <FiSettings aria-hidden="true" />,
  },
];
const staffNav = nav.filter((item) =>
  [
    "Dashboard",
    "Slots",
    "Vouchers",
    "Rewards Network",
    "Staff Validation",
  ].includes(item.label),
);

function isNavActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  adminEmail,
  adminName,
  role,
  staffBusinessName,
}: {
  adminEmail: string;
  adminName: string;
  role: "super_admin" | "admin" | "staff";
  staffBusinessName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navigationLocked = useRef(false);

  useEffect(() => {
    navigationLocked.current = false;
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const recovery = window.setTimeout(() => {
      navigationLocked.current = false;
      setPendingHref(null);
    }, 10_000);
    return () => window.clearTimeout(recovery);
  }, [pendingHref]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-tile small">%</div>
        <div>
          <strong>Voucher Hunt</strong>
          <div style={{ fontSize: ".72rem", opacity: 0.76 }}>
            {role === "staff"
              ? `${staffBusinessName ?? "Unassigned business"} · Staff`
              : "Admin"}
          </div>
        </div>
      </div>
      {(role === "staff"
        ? staffNav
        : nav.filter((item) => item.href !== "/dashboard/settings" || role === "super_admin")
      ).map((item) => (
        <a
          aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
          className={`nav-item ${isNavActive(pathname, item.href) ? "active" : ""} ${pendingHref === item.href ? "pending" : ""}`}
          href={item.href}
          key={item.label}
          onClick={(event) => {
            if (isNavActive(pathname, item.href)) return;
            if (navigationLocked.current) {
              event.preventDefault();
              return;
            }
            navigationLocked.current = true;
            setPendingHref(item.href);
          }}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span className="nav-item-label">{item.label}</span>
          {pendingHref === item.href ? (
            <span aria-label="Loading page" className="nav-item-spinner" role="status" />
          ) : null}
        </a>
      ))}
      <div className="sidebar-account">
        <div className="sidebar-account-copy">
          <strong>{adminName}</strong>
          <span title={adminEmail}>{adminEmail}</span>
        </div>
        <button aria-label="Log out" onClick={logout} type="button">
          <FiLogOut aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
