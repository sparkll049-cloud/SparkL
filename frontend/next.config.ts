import type { NextConfig } from "next";

// cache-bust: 1
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/payvessel-cdn/:path*",
          destination: "https://unpkg.com/:path*",
        },
      ],
    };
  },
};

export default nextConfig;