"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiBriefcase,
  FiCheckSquare,
  FiClock,
  FiFlag,
  FiGift,
  FiGrid,
  FiLogOut,
  FiRepeat,
  FiSettings,
  FiUsers,
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
    label: "Businesses",
    href: "/dashboard/businesses",
    icon: <FiBriefcase aria-hidden="true" />,
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
    label: "Users",
    href: "/dashboard/users",
    icon: <FiUsers aria-hidden="true" />,
  },
  {
    label: "Loyalty Points",
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
    "Users",
    "Loyalty Points",
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image
          alt=""
          className="logo-tile small"
          height={36}
          priority
          src="/images/voucher-hunt-app-logo.png"
          width={36}
        />
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
        <Link
          aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
          className={`nav-item ${isNavActive(pathname, item.href) ? "active" : ""}`}
          href={item.href}
          key={item.label}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span className="nav-item-label">{item.label}</span>
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
