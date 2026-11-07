import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // npm scripts are executed from this frontend package directory.
  // Keep Turbopack scoped here instead of inferring a parent Downloads root.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
