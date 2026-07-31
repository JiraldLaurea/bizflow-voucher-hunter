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
  }
};

export default nextConfig;
