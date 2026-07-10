/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: ["@libsql/client", "libsql", "smpp"]
  }
};

export default nextConfig;
