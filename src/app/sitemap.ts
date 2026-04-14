import type { MetadataRoute } from "next";

/**
 * P1 — Public sitemap.
 * Lists only legitimate public marketing / legal / methodology routes.
 * Admin, investigator, api, reports, shared, box, previews are NEVER listed.
 * Keep aligned with robots.ts disallow rules.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.interligens.com";
  const now = new Date();

  const publicPaths: Array<{ path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/en", priority: 0.9, changeFrequency: "weekly" },
    { path: "/fr", priority: 0.9, changeFrequency: "weekly" },
    { path: "/en/charter", priority: 0.7, changeFrequency: "monthly" },
    { path: "/fr/charter", priority: 0.7, changeFrequency: "monthly" },
    { path: "/en/methodology", priority: 0.7, changeFrequency: "monthly" },
    { path: "/fr/methodology", priority: 0.7, changeFrequency: "monthly" },
    { path: "/en/transparency", priority: 0.7, changeFrequency: "monthly" },
    { path: "/fr/transparency", priority: 0.7, changeFrequency: "monthly" },
    { path: "/en/legal/terms", priority: 0.4, changeFrequency: "yearly" },
    { path: "/en/legal/privacy", priority: 0.4, changeFrequency: "yearly" },
    { path: "/en/legal/disclaimer", priority: 0.4, changeFrequency: "yearly" },
    { path: "/en/legal/mentions-legales", priority: 0.3, changeFrequency: "yearly" },
    { path: "/fr/legal/terms", priority: 0.4, changeFrequency: "yearly" },
    { path: "/fr/legal/privacy", priority: 0.4, changeFrequency: "yearly" },
    { path: "/fr/legal/disclaimer", priority: 0.4, changeFrequency: "yearly" },
    { path: "/fr/legal/mentions-legales", priority: 0.3, changeFrequency: "yearly" },
    { path: "/en/investors", priority: 0.6, changeFrequency: "monthly" },
  ];

  return publicPaths.map((entry) => ({
    url: `${host}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
