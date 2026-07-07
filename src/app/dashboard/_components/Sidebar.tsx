"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  { label: "Dashboard", href: "/dashboard", icon: <FiGrid aria-hidden="true" /> },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: <FiFlag aria-hidden="true" /> },
  { label: "Slots", href: "/dashboard/slots", icon: <FiClock aria-hidden="true" /> },
  { label: "Vouchers", href: "/dashboard/vouchers", icon: <FiGift aria-hidden="true" /> },
  { label: "Rewards Network", href: "/dashboard/rewards", icon: <FiRepeat aria-hidden="true" /> },
  { label: "Staff Validation", href: "/dashboard/staff", icon: <FiCheckSquare aria-hidden="true" /> },
  { label: "Settings", href: "/dashboard/settings", icon: <FiSettings aria-hidden="true" /> },
];

function isNavActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  adminEmail,
  adminName,
}: {
  adminEmail: string;
  adminName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

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
          <strong>BizFlow</strong>
          <div style={{ fontSize: ".72rem", opacity: 0.76 }}>Admin</div>
        </div>
      </div>
      {nav.map((item) => (
        <Link
          className={`nav-item ${isNavActive(pathname, item.href) ? "active" : ""}`}
          href={item.href}
          key={item.label}
        >
          <span className="nav-item-icon">{item.icon}</span>
          {item.label}
        </Link>
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
