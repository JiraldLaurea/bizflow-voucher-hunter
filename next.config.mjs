/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development artifacts isolated from production builds. Running
  // `next build` while `next dev` is open must not replace chunks used by the
  // live development server and leave the rendered UI unable to hydrate.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // The shared workspace package ships TypeScript source, so Next must transpile
  // it rather than expecting pre-built JS.
  transpilePackages: ["@bizflow/shared"],
  // Google Maps browser keys are public by design. Restrict this key to Maps
  // JavaScript API + Geocoding API and allowed dashboard HTTP referrers.
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
      process.env.GOOGLE_MAPS_API_KEY ??
      ""
  },
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: ["@libsql/client", "libsql", "smpp"]
  },
  /**
   * Baseline response headers. None of these stop the attacks that matter most
   * here — they are the layer that limits what a bug elsewhere can be turned
   * into: a stolen session replayed over plain HTTP, the dashboard framed to
   * trick an admin into clicking through a settlement, a voucher code carried
   * to a third party in a Referer.
   *
   * No CSP yet: the dashboard renders `data:` campaign artwork and Next.js
   * injects inline bootstrap script, so a policy strict enough to be worth
   * having needs nonce plumbing. Tracked in docs/SECURITY.md as accepted risk.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            // Two years, preloadable. HTTPS-only is already true in practice;
            // this stops the first request of a session being downgradable.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Never let an API response be cached by a shared proxy: these carry
        // wallet balances, voucher codes and customer PII.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  }
};

export default nextConfig;
