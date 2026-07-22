import Link from "next/link";
import { FiHome, FiMoreHorizontal, FiShoppingBag } from "react-icons/fi";

/** App-level bottom tab bar for customer screens (directory + campaign flow). */
export function CustomerBottomNav({
  active,
  homeHref,
  vouchersHref,
  moreHref,
}: {
  active?: "home" | "vouchers" | "more";
  homeHref: string;
  vouchersHref: string;
  moreHref: string;
}) {
  return (
    <nav className="landing-bottom-nav" aria-label="Customer navigation">
      <Link className={active === "home" ? "active" : ""} href={homeHref} prefetch={false}>
        <FiHome aria-hidden="true" />
        Home
      </Link>
      <Link className={active === "vouchers" ? "active" : ""} href={vouchersHref} prefetch={false}>
        <FiShoppingBag aria-hidden="true" />
        Vouchers
      </Link>
      <Link className={active === "more" ? "active" : ""} href={moreHref} prefetch={false}>
        <FiMoreHorizontal aria-hidden="true" />
        More
      </Link>
    </nav>
  );
}
