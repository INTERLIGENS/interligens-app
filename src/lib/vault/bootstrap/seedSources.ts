// @pr2:bootstrap-sources
/**
 * src/lib/vault/bootstrap/seedSources.ts
 * Bootstrap idempotent des SourceRegistry par défaut.
 * - upsert sur `name` (unique) → safe à relancer N fois
 * - aucun delete, aucun truncate
 * - retourne un rapport created/skipped/failed
 * - jamais de secret dans les logs
 */

import { prisma } from "@/lib/prisma";

export interface SeedSourceDef {
  name: string;
  handle: string;
  sourceName: string;
  sourceType: string;
  homepageUrl?: string | null;
  description?: string | null;
  defaultChain?: string | null;
  defaultLabelType?: string | null;
  defaultLabel?: string | null;
  defaultVisibility: string;
  license?: string | null;
  tosRisk: string;
  trusted: boolean;
}

export interface SeedReport {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  details: Array<{ name: string; status: "created" | "skipped" | "failed"; error?: string }>;
}

export const DEFAULT_SOURCES: SeedSourceDef[] = [
  {
    name: "INTERLIGENS Internal",
    handle: "interligens",
    sourceName: "INTERLIGENS Internal",
    sourceType: "internal",
    homepageUrl: "https://interligens.com",
    description: "Labels internes produits par l'équipe INTERLIGENS.",
    defaultChain: null,
    defaultLabelType: "scam",
    defaultLabel: "scam",
    defaultVisibility: "public",
    license: "proprietary",
    tosRisk: "none",
    trusted: true,
  },
  {
    name: "Community Submissions",
    handle: "community",
    sourceName: "Community Submissions",
    sourceType: "community",
    homepageUrl: null,
    description: "Signalements soumis par la communauté via le formulaire public.",
    defaultChain: null,
    defaultLabelType: "reported",
    defaultLabel: "reported_scam",
    defaultVisibility: "public",
    license: "cc0",
    tosRisk: "low",
    trusted: false,
  },
  {
    name: "SlowMist Hacked",
    handle: "slowmist",
    sourceName: "SlowMist Hacked",
    sourceType: "threat_intel",
    homepageUrl: "https://hacked.slowmist.io",
    description: "Base de données publique des hacks et exploits crypto recensés par SlowMist.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "hack",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Rekt News",
    handle: "rekt",
    sourceName: "Rekt News",
    sourceType: "threat_intel",
    homepageUrl: "https://rekt.news",
    description: "Rapports post-mortem d'exploits DeFi publiés par Rekt.news.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "defi_exploit",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Etherscan Labels",
    handle: "etherscan",
    sourceName: "Etherscan Labels",
    sourceType: "explorer",
    homepageUrl: "https://etherscan.io/labelcloud",
    description: "Labels publics issus du Label Cloud Etherscan.",
    defaultChain: "evm",
    defaultLabelType: "exchange",
    defaultLabel: null,
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Solscan Labels",
    handle: "solscan",
    sourceName: "Solscan Labels",
    sourceType: "explorer",
    homepageUrl: "https://solscan.io",
    description: "Labels publics issus de Solscan pour l'écosystème Solana.",
    defaultChain: "solana",
    defaultLabelType: "exchange",
    defaultLabel: null,
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "OFAC SDN List",
    handle: "ofac",
    sourceName: "OFAC SDN List",
    sourceType: "regulatory",
    homepageUrl: "https://ofac.treasury.gov/sdn-list",
    description: "Liste des adresses sanctionnées par l'OFAC (US Treasury).",
    defaultChain: null,
    defaultLabelType: "sanctions",
    defaultLabel: "ofac_sanctioned",
    defaultVisibility: "public",
    license: "public_domain",
    tosRisk: "none",
    trusted: true,
  },
  {
    name: "ScamSniffer",
    handle: "scamsniffer",
    sourceName: "ScamSniffer",
    sourceType: "threat_intel",
    homepageUrl: "https://scamsniffer.io",
    description: "Détections de phishing et drainer wallets par ScamSniffer.",
    defaultChain: "evm",
    defaultLabelType: "phishing",
    defaultLabel: "phishing",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
];

/**
 * seedDefaultSources()
 * Upsert idempotent de toutes les DEFAULT_SOURCES.
 * Retourne un SeedReport sans jamais throw (erreurs isolées par source).
 *
 * @param sources  Liste de sources (défaut: DEFAULT_SOURCES)
 * @param dryRun   Si true, simule sans écrire en DB
 */
export async function seedDefaultSources(
  sources: SeedSourceDef[] = DEFAULT_SOURCES,
  dryRun = false,
): Promise<SeedReport> {
  const report: SeedReport = {
    total: sources.length,
    created: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const src of sources) {
    try {
      if (dryRun) {
        const existing = await prisma.sourceRegistry.findUnique({ where: { name: src.name } });
        const status = existing ? "skipped" : "created";
        report.details.push({ name: src.name, status });
        status === "created" ? report.created++ : report.skipped++;
        console.info("[seedSources] dry-run " + status + ": " + src.name);
        continue;
      }

      const result = await prisma.sourceRegistry.upsert({
        where: { name: src.name },
        update: {}, // idempotent : ne réécrase pas si déjà présent
        create: {
          name: src.name,
          handle: src.handle,
          sourceName: src.sourceName,
          sourceType: src.sourceType,
          url: src.homepageUrl ?? null,
          homepageUrl: src.homepageUrl ?? null,
          description: src.description ?? null,
          defaultChain: src.defaultChain ?? null,
          defaultLabelType: src.defaultLabelType ?? null,
          defaultLabel: src.defaultLabel ?? null,
          defaultVisibility: src.defaultVisibility,
          license: src.license ?? null,
          tosRisk: src.tosRisk,
          trusted: src.trusted,
          status: "active",
        },
      });

      // Détection created vs skipped : écart createdAt/updatedAt < 2s = fraîche
      const isNew = Math.abs(result.updatedAt.getTime() - result.createdAt.getTime()) < 2000;
      const status = isNew ? "created" : "skipped";
      report.details.push({ name: src.name, status });
      status === "created" ? report.created++ : report.skipped++;
      console.info("[seedSources] " + status + ": " + src.name);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.failed++;
      report.details.push({ name: src.name, status: "failed", error: message });
      console.error("[seedSources] failed: " + src.name + " — " + message);
    }
  }

  console.info(
    "[seedSources] done — total=" + report.total +
    " created=" + report.created +
    " skipped=" + report.skipped +
    " failed=" + report.failed
  );

  return report;
}
