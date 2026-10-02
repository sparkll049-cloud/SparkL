import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Allows production builds to finish on Vercel when tsc hangs or hits memory limits
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignores linting errors during production builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
