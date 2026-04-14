import type { MetadataRoute } from "next";

/**
 * SEC-008 — robots directives for INTERLIGENS.
 *
 * Keep this aligned with `public/robots.txt` (static fallback for crawlers
 * that ignore the Next.js route). Any new private path MUST be added here.
 */
export default function robots(): MetadataRoute.Robots {
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.interligens.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin/",
          "/en/admin/",
          "/fr/admin/",
          "/investigators/",
          "/access/",
          "/box/",
          "/_next/",
          "/health",
          "/shared/case/",
        ],
      },
    ],
    host,
  };
}
