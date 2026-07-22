import type { ReactNode } from "react";
import {
  FaPaw,
  FaShoppingBag,
  FaSpa,
  FaStore,
  FaTag,
  FaUtensils,
} from "react-icons/fa";

// One category → icon map, shared by the customer campaign directory and the
// admin campaign selector, so a campaign looks the same in both places. Keyed by
// business industry / campaign mode string (same enum values).
const categoryIcons: Record<string, ReactNode> = {
  restaurant: <FaUtensils aria-hidden="true" />,
  online_shop: <FaStore aria-hidden="true" />,
  beauty: <FaSpa aria-hidden="true" />,
  pet: <FaPaw aria-hidden="true" />,
  retail: <FaShoppingBag aria-hidden="true" />,
  other: <FaTag aria-hidden="true" />,
};

export function campaignCategoryIcon(category: string): ReactNode {
  return categoryIcons[category] ?? categoryIcons.other;
}
