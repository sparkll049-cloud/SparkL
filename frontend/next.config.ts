import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: "/payvessel-cdn/:path*",
        destination: "https://unpkg.com/:path*",
      },
    ];
  },
};

export default nextConfig;