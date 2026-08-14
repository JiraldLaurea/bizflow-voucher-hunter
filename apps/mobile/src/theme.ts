import type { VoucherRarity } from "@bizflow/shared";

/**
 * Mirrors the `:root` custom properties in the web app's `src/app/globals.css`.
 * The mobile app and the web customer UI are the same product, so these values are
 * copied verbatim rather than re-picked — if a token changes on the web, change it
 * here too.
 */
export const palette = {
  navy: "#0b1d3a",
  muted: "#67718a",
  line: "#e5e9f2",
  softLine: "#eef1f7",
  canvas: "#f7f9fd",
  surface: "#ffffff",
  purple: "#5c3dff",
  purple2: "#7c4dff",
  purpleSoft: "#eeeaff",
  green: "#22c55e",
  greenSoft: "#eafaf0",
  orange: "#f59e0b",
  orangeSoft: "#fff6e6",
  red: "#ef4444",
  redSoft: "#fff0f0",
  blue: "#2f6bff",
} as const;

/** Intent-named aliases; these are the names screens should reach for. */
export const colors = {
  page: palette.canvas,
  surface: palette.surface,
  ink: palette.navy,
  textMuted: palette.muted,
  border: palette.line,
  borderSoft: palette.softLine,
  primary: palette.purple,
  primaryBright: palette.purple2,
  primarySoft: palette.purpleSoft,
  success: palette.green,
  successSoft: palette.greenSoft,
  warning: palette.orange,
  warningSoft: palette.orangeSoft,
  danger: palette.red,
  dangerSoft: palette.redSoft,
  /** `.alert` on the web is amber, not red — it warns rather than errors. */
  alertText: "#7a2d0b",
  alertBorder: "#ffd99b",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 9,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 999,
} as const;

/**
 * Container cards use a flat, bordered treatment throughout the mobile app.
 * Keeping these aliases empty lets existing shared-card call sites stay uniform
 * without reintroducing platform-specific iOS shadows or Android elevation.
 */
export const shadow = {
  soft: {},
  raised: {},
  button: {
    shadowColor: palette.purple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;

/** The web loads Inter 400/600/700/800/900; these are the matching RN families. */
export const fonts = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  black: "Inter_900Black",
} as const;

type RarityStyle = {
  /** `--voucher-accent` — drives badge, border and cutout ring. */
  accent: string;
  /** `--voucher-shadow`. */
  shadow: string;
  /** Ticket gradient stops, passed to a LinearGradient. */
  gradient: readonly [string, string];
  text: string;
  headingText: string;
  badgeText: string;
  badgeBackground: string;
  badgeBorder: string;
  sparkle: string;
  /** Cutout ring colour — light tickets ring in the accent, dark ones in white. */
  cutoutRing: string;
};

/**
 * Gradient per business type, so a partner's Loyalty Points card is recognisably
 * theirs and never mistaken for the global balance — which keeps the app's one
 * purple.
 *
 * Ported from the console's `.mode-*` tiles in `globals.css` so a partner reads
 * the same colour in the dashboard and in the app. `other` is the fallback for
 * an unknown or missing industry.
 */
export const businessTypeGradients: Record<string, [string, string]> = {
  restaurant: ["#fb923c", "#ea580c"],
  online_shop: ["#60a5fa", "#2563eb"],
  beauty: ["#f472b6", "#db2777"],
  pet: ["#2dd4bf", "#0d9488"],
  retail: ["#a78bfa", "#7c3aed"],
  other: ["#94a3b8", "#475569"],
};

export function businessTypeGradient(industry?: string): [string, string] {
  return businessTypeGradients[industry ?? "other"] ?? businessTypeGradients.other;
}

/**
 * The rarity system from `globals.css` (`.candidate.voucher-*`). Epic and legendary
 * invert to light-on-dark, which is why every rarity carries its own text colours
 * rather than inheriting a single ink token.
 */
export const rarityStyles: Record<VoucherRarity, RarityStyle> = {
  standard: {
    accent: "#8b92a8",
    shadow: "rgba(70, 79, 106, 0.18)",
    gradient: ["#ffffff", "#f4f6fb"],
    text: "#15203b",
    headingText: "#15203b",
    badgeText: "#4a5470",
    badgeBackground: "#f4f5f8",
    badgeBorder: "rgba(139, 146, 168, 0.3)",
    sparkle: "rgba(139, 146, 168, 0.26)",
    cutoutRing: "rgba(139, 146, 168, 0.3)",
  },
  rare: {
    accent: "#1976d2",
    shadow: "rgba(25, 118, 210, 0.2)",
    gradient: ["#fafdff", "#e8f4ff"],
    text: "#15203b",
    headingText: "#15203b",
    badgeText: "#1a68b0",
    badgeBackground: "#eaf4fd",
    badgeBorder: "rgba(25, 118, 210, 0.3)",
    sparkle: "rgba(66, 165, 245, 0.34)",
    cutoutRing: "rgba(25, 118, 210, 0.3)",
  },
  epic: {
    accent: "#7547e8",
    shadow: "rgba(117, 71, 232, 0.28)",
    gradient: ["#8158ee", "#3c208d"],
    text: "#ffffff",
    headingText: "#ffffff",
    badgeText: "#ffffff",
    badgeBackground: "rgba(255, 255, 255, 0.14)",
    badgeBorder: "rgba(255, 255, 255, 0.3)",
    sparkle: "rgba(231, 219, 255, 0.58)",
    cutoutRing: "rgba(255, 255, 255, 0.25)",
  },
  legendary: {
    accent: "#f6c453",
    shadow: "rgba(156, 101, 0, 0.18)",
    gradient: ["#3b2910", "#080808"],
    text: "#fff7d6",
    headingText: "#ffd86e",
    badgeText: "#ffe28d",
    badgeBackground: "rgba(246, 196, 83, 0.14)",
    badgeBorder: "rgba(255, 218, 119, 0.55)",
    sparkle: "rgba(255, 215, 105, 0.9)",
    cutoutRing: "rgba(255, 255, 255, 0.25)",
  },
};
