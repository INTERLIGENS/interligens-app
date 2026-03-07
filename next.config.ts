import type { NextConfig } from "next";
import { buildSecurityHeaders, buildApiHeaders } from "./src/lib/security/headers";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
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
    ];
  },
};

export default nextConfig;
