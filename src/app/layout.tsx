import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
      weight: "400",
      style: "normal"
    },
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2",
      weight: "600",
      style: "normal"
    },
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2",
      weight: "700",
      style: "normal"
    },
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2",
      weight: "800",
      style: "normal"
    },
    {
      path: "../../node_modules/@fontsource/inter/files/inter-latin-900-normal.woff2",
      weight: "900",
      style: "normal"
    }
  ]
});

/**
 * The display face, used only for the product wordmark.
 *
 * Inter is a UI typeface - it is drawn to disappear, which is what makes it
 * right for the other several hundred strings on screen and wrong for the one
 * that has to read as a mark. Outfit is geometric where Inter is grotesque, so
 * the two are told apart at a glance without clashing, and its round bowls echo
 * the logo tile sitting next to it.
 *
 * Two weights only: this sets three or four words on the entire site.
 */
const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    {
      path: "../../node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2",
      weight: "600",
      style: "normal"
    },
    {
      path: "../../node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2",
      weight: "700",
      style: "normal"
    }
  ]
});

export const metadata: Metadata = {
  title: "Voucher Hunt",
  description: "Reservation-based voucher hunting MVP for SMEs"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
