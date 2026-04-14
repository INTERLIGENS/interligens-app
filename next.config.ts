import type { NextConfig } from "next";
import { buildSecurityHeaders, buildApiHeaders } from "./src/lib/security/headers";

const isProd = process.env.NODE_ENV === "production";

// SEC-009 — every private path must carry `X-Robots-Tag: noindex, nofollow`
// and `Cache-Control: no-store`. The `buildApiHeaders()` helper already sets
// both, so we simply extend its usage to the full private surface.
const PRIVATE_PATH_SOURCES = [
  "/admin/:path*",
  "/en/admin/:path*",
  "/fr/admin/:path*",
  "/investigators/:path*",
  "/access/:path*",
  "/box/:path*",
  "/api/admin/:path*",
  "/api/investigator/:path*",
  "/api/investigators/:path*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  experimental: {
  },
  async headers() {
    return [
      {
        // Headers sécurité sur toutes les pages et routes
        source: "/(.*)",
        headers: buildSecurityHeaders({ isProd }),
      },
      {
        // Headers API renforcés sur les routes PDF (no-cache + noindex)
        source: "/api/report/(.*)",
        headers: buildApiHeaders(),
      },
      {
        source: "/api/pdf/(.*)",
        headers: buildApiHeaders(),
      },
      // SEC-009 — private paths: noindex + no-store
      ...PRIVATE_PATH_SOURCES.map((source) => ({
        source,
        headers: buildApiHeaders(),
      })),
    ];
  },
};

export default nextConfig;
