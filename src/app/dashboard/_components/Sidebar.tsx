"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiCheckSquare,
  FiClock,
  FiFlag,
  FiGift,
  FiGrid,
  FiSettings,
} from "react-icons/fi";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: <FiGrid aria-hidden="true" /> },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: <FiFlag aria-hidden="true" /> },
  { label: "Slots", href: "/dashboard/slots", icon: <FiClock aria-hidden="true" /> },
  { label: "Vouchers", href: "/dashboard/vouchers", icon: <FiGift aria-hidden="true" /> },
  { label: "Staff Validation", href: "/dashboard/staff", icon: <FiCheckSquare aria-hidden="true" /> },
  { label: "Settings", href: "/dashboard/settings", icon: <FiSettings aria-hidden="true" /> },
];

function isNavActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

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
      <div style={{ marginTop: 28, padding: 10, borderTop: "1px solid rgba(255,255,255,.14)" }}>
        <strong>Jane Admin</strong>
        <div style={{ fontSize: ".72rem", opacity: 0.72 }}>Super Admin</div>
      </div>
    </aside>
  );
}
