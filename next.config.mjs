/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development artifacts isolated from production builds. Running
  // `next build` while `next dev` is open must not replace chunks used by the
  // live development server and leave the rendered UI unable to hydrate.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: ["@libsql/client", "libsql", "smpp"]
  }
};

export default nextConfig;
