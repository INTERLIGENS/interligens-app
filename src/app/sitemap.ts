import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

/**
 * P1 — Public sitemap.
 * Lists only legitimate public marketing / legal / methodology routes.
 * Admin, investigator, api, reports, shared, box, previews are NEVER listed.
 * Keep aligned with robots.ts disallow rules.
 *
 * Phase 6 additions: /mm (Market Maker Intelligence index) + dynamic fiche
 * entity routes for workflows in { PUBLISHED, CHALLENGED }. /mm/legal and
 * /mm/scan stay OUT — they carry `robots: noindex`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    // MM Tracker (Phase 6)
    { path: "/mm", priority: 0.8, changeFrequency: "daily" },
    { path: "/mm/methodology", priority: 0.6, changeFrequency: "monthly" },
  ];

  const entries: MetadataRoute.Sitemap = publicPaths.map((entry) => ({
    url: `${host}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  // Dynamic MM entity pages — PUBLISHED or CHALLENGED only. Swallows DB
  // failures so a transient Neon outage can't break the sitemap build.
  try {
    const entities = await prisma.mmEntity.findMany({
      where: { workflow: { in: ["PUBLISHED", "CHALLENGED"] } },
      select: { slug: true, updatedAt: true },
    });
    for (const e of entities) {
      entries.push({
        url: `${host}/mm/${e.slug}`,
        lastModified: e.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error("[sitemap] failed to list MM entities", err);
  }

  return entries;
}
