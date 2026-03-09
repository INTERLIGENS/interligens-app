// @pr2:bootstrap-sources
// @pr3:extended-sources
/**
 * src/lib/vault/bootstrap/seedSources.ts
 * Bootstrap idempotent des SourceRegistry par défaut.
 * - upsert sur `name` (unique) -> safe à relancer N fois
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
  // ── PR2 : 8 sources initiales ──────────────────────────────────────────────
  {
    name: "INTERLIGENS Internal",
    handle: "interligens",
    sourceName: "INTERLIGENS Internal",
    sourceType: "internal",
    homepageUrl: "https://interligens.com",
    description: "Labels internes produits par l'equipe INTERLIGENS.",
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
    description: "Signalements soumis par la communaute via le formulaire public.",
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
    description: "Base de donnees publique des hacks et exploits crypto recenses par SlowMist.",
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
    description: "Rapports post-mortem d'exploits DeFi publies par Rekt.news.",
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
    description: "Labels publics issus de Solscan pour l'ecosysteme Solana.",
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
    description: "Liste des adresses sanctionnees par l'OFAC (US Treasury).",
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
    description: "Detections de phishing et drainer wallets par ScamSniffer.",
    defaultChain: "evm",
    defaultLabelType: "phishing",
    defaultLabel: "phishing",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  // ── PR3 : 15 sources additionnelles ───────────────────────────────────────
  {
    name: "MistTrack",
    handle: "misttrack",
    sourceName: "MistTrack",
    sourceType: "threat_intel",
    homepageUrl: "https://misttrack.io",
    description: "Outil de tracking on-chain par SlowMist, specialise tracage de fonds voles.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "stolen_funds",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "PeckShield",
    handle: "peckshield",
    sourceName: "PeckShield",
    sourceType: "threat_intel",
    homepageUrl: "https://peckshield.com",
    description: "Alertes securite et adresses liees aux hacks publiees par PeckShield.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "hack",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "ZachXBT",
    handle: "zachxbt",
    sourceName: "ZachXBT",
    sourceType: "threat_intel",
    homepageUrl: "https://zachxbt.mirror.xyz",
    description: "Investigations on-chain publiees par ZachXBT, adresses de scammers identifies.",
    defaultChain: null,
    defaultLabelType: "scam",
    defaultLabel: "scam",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "DeFiLlama Hacks",
    handle: "defillama-hacks",
    sourceName: "DeFiLlama Hacks",
    sourceType: "threat_intel",
    homepageUrl: "https://defillama.com/hacks",
    description: "Base de donnees publique des hacks DeFi avec montants et protocoles affectes.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "defi_hack",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "CertiK Skynet",
    handle: "certik",
    sourceName: "CertiK Skynet",
    sourceType: "threat_intel",
    homepageUrl: "https://skynet.certik.com",
    description: "Alertes de securite et incidents identifies par CertiK Skynet.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "exploit",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Forta Network",
    handle: "forta",
    sourceName: "Forta Network",
    sourceType: "threat_intel",
    homepageUrl: "https://forta.org",
    description: "Detections temps-reel d'attaques on-chain par les bots Forta.",
    defaultChain: "evm",
    defaultLabelType: "attacker",
    defaultLabel: "forta_alert",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "GoPlusSecurity",
    handle: "goplusec",
    sourceName: "GoPlusSecurity",
    sourceType: "threat_intel",
    homepageUrl: "https://gopluslabs.io",
    description: "API de securite token/adresse de GoPlus Security.",
    defaultChain: "evm",
    defaultLabelType: "malicious",
    defaultLabel: "malicious_address",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "De.Fi REKT DB",
    handle: "defi-rekt",
    sourceName: "De.Fi REKT DB",
    sourceType: "threat_intel",
    homepageUrl: "https://de.fi/rekt-database",
    description: "Base de donnees REKT de De.Fi repertoriant exploits et rugs.",
    defaultChain: null,
    defaultLabelType: "hacker",
    defaultLabel: "rug_pull",
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Nansen Labels",
    handle: "nansen",
    sourceName: "Nansen Labels",
    sourceType: "analytics",
    homepageUrl: "https://nansen.ai",
    description: "Labels on-chain Nansen (smart money, exchanges, bridges).",
    defaultChain: "evm",
    defaultLabelType: "exchange",
    defaultLabel: null,
    defaultVisibility: "internal_only",
    license: "commercial",
    tosRisk: "medium",
    trusted: true,
  },
  {
    name: "Arkham Intelligence",
    handle: "arkham",
    sourceName: "Arkham Intelligence",
    sourceType: "analytics",
    homepageUrl: "https://arkhamintelligence.com",
    description: "Entites et labels on-chain publies par Arkham Intelligence.",
    defaultChain: null,
    defaultLabelType: "entity",
    defaultLabel: null,
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Breadcrumbs",
    handle: "breadcrumbs",
    sourceName: "Breadcrumbs",
    sourceType: "threat_intel",
    homepageUrl: "https://breadcrumbs.app",
    description: "Labels communautaires et investigations partagees via Breadcrumbs.",
    defaultChain: "evm",
    defaultLabelType: "scam",
    defaultLabel: "reported_scam",
    defaultVisibility: "public",
    license: "cc0",
    tosRisk: "low",
    trusted: false,
  },
  {
    name: "BSCScan Labels",
    handle: "bscscan",
    sourceName: "BSCScan Labels",
    sourceType: "explorer",
    homepageUrl: "https://bscscan.com/labelcloud",
    description: "Labels publics issus du Label Cloud BSCScan (BNB Chain).",
    defaultChain: "evm",
    defaultLabelType: "exchange",
    defaultLabel: null,
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "Polygonscan Labels",
    handle: "polygonscan",
    sourceName: "Polygonscan Labels",
    sourceType: "explorer",
    homepageUrl: "https://polygonscan.com/labelcloud",
    description: "Labels publics issus du Label Cloud Polygonscan.",
    defaultChain: "evm",
    defaultLabelType: "exchange",
    defaultLabel: null,
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "TRON Tronscan",
    handle: "tronscan",
    sourceName: "TRON Tronscan",
    sourceType: "explorer",
    homepageUrl: "https://tronscan.org",
    description: "Labels et entites identifies sur TRON via Tronscan.",
    defaultChain: "tron",
    defaultLabelType: "exchange",
    defaultLabel: null,
    defaultVisibility: "public",
    license: "public",
    tosRisk: "low",
    trusted: true,
  },
  {
    name: "UNODC Reports",
    handle: "unodc",
    sourceName: "UNODC Reports",
    sourceType: "regulatory",
    homepageUrl: "https://www.unodc.org",
    description: "Adresses liees aux rapports crypto de l'UNODC.",
    defaultChain: null,
    defaultLabelType: "sanctions",
    defaultLabel: "unodc_flagged",
    defaultVisibility: "public",
    license: "public_domain",
    tosRisk: "none",
    trusted: true,
  },
];

/**
 * seedDefaultSources()
 * Upsert idempotent de toutes les DEFAULT_SOURCES.
 * Retourne un SeedReport sans jamais throw (erreurs isolees par source).
 *
 * @param sources  Liste de sources (defaut: DEFAULT_SOURCES)
 * @param dryRun   Si true, simule sans ecrire en DB
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
        update: {},
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

      const isNew = Math.abs(result.updatedAt.getTime() - result.createdAt.getTime()) < 2000;
      const status = isNew ? "created" : "skipped";
      report.details.push({ name: src.name, status });
      status === "created" ? report.created++ : report.skipped++;
      console.info("[seedSources] " + status + ": " + src.name);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.failed++;
      report.details.push({ name: src.name, status: "failed", error: message });
      console.error("[seedSources] failed: " + src.name + " -- " + message);
    }
  }

  console.info(
    "[seedSources] done -- total=" + report.total +
    " created=" + report.created +
    " skipped=" + report.skipped +
    " failed=" + report.failed
  );

  return report;
}
