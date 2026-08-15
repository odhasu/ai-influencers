import type { NextConfig } from "next";

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "");
const isProduction = process.env.NODE_ENV === "production";

function getOrigin(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

const configuredPosthogOrigins = [
  getOrigin(posthogHost),
  getOrigin(process.env.NEXT_PUBLIC_POSTHOG_UI_HOST)
].filter((origin): origin is string => Boolean(origin));
const configuredSupabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const configuredSupabaseWebSocketOrigin = configuredSupabaseOrigin?.replace(/^http/, "ws");

// This remains report-only until production violation telemetry confirms that the
// Next.js runtime and the third-party booking/video integrations are fully covered.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://assets.calendly.com`,
  "style-src 'self' 'unsafe-inline' https://assets.calendly.com",
  "font-src 'self' data: https://assets.calendly.com",
  "img-src 'self' data: blob: https://i.ytimg.com https://cdn.clyro.io https://stream.clyro.io https://assets.calendly.com https://calendly.com https://*.calendly.com",
  "media-src 'self' blob: https://stream.clyro.io https://cdn.clyro.io",
  "frame-src https://www.youtube-nocookie.com https://calendly.com https://*.calendly.com",
  [
    "connect-src 'self'",
    "https://stream.clyro.io",
    "https://calendly.com",
    "https://*.calendly.com",
    "https://*.posthog.com",
    "https://*.posthog.dev",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    ...configuredPosthogOrigins,
    ...(configuredSupabaseOrigin ? [configuredSupabaseOrigin] : []),
    ...(configuredSupabaseWebSocketOrigin ? [configuredSupabaseWebSocketOrigin] : [])
  ].join(" "),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-uri /api/csp-report"
].join("; ");

const securityHeaders = [
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000"
        }
      ]
    : []),
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none"
  }
];

const privateNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0"
  }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  images: {
    qualities: [75, 90]
  },
  turbopack: {
    root: process.cwd()
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/dashboard/:path*",
        headers: privateNoStoreHeaders
      },
      {
        source: "/admin/:path*",
        headers: privateNoStoreHeaders
      },
      {
        source: "/api/admin/:path*",
        headers: privateNoStoreHeaders
      },
      {
        source: "/api/conversions",
        headers: privateNoStoreHeaders
      },
      {
        source: "/api/webhooks/:path*",
        headers: privateNoStoreHeaders
      }
    ];
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
