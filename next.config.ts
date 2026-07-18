import type { NextConfig } from "next";

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: process.cwd()
  },
  async rewrites() {
    const rewrites: NonNullable<Awaited<ReturnType<NonNullable<NextConfig["rewrites"]>>>> = [
      {
        source: "/",
        has: [{ type: "host", value: "dashborad.authenticresell.com" }],
        destination: "/dashboard"
      }
    ];

    if (!posthogHost) return rewrites;

    return [
      ...rewrites,
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
