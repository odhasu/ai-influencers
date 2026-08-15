import type { NextConfig } from "next";

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  images: {
    qualities: [75, 90]
  },
  turbopack: {
    root: process.cwd()
  },
  async rewrites() {
    if (!posthogHost) return [];

    return [
      {
        source: "/ingest/static/:path*",
        destination: `${posthogHost}/static/:path*`
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`
      }
    ];
  }
};

export default nextConfig;
