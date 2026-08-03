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

// Display names for the same enum, so a category reads the same wherever it is
// spelled out rather than shown as an icon.
const categoryLabels: Record<string, string> = {
  restaurant: "Restaurant",
  online_shop: "Online Shop",
  beauty: "Beauty",
  pet: "Pet",
  retail: "Retail",
  other: "Other",
};

export function campaignCategoryLabel(category: string): string {
  return categoryLabels[category] ?? categoryLabels.other;
}
