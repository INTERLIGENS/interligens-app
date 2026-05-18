// ─── MM Tracker Phase 8 — OSINT wallet ingestion ─────────────────────────
// Creates missing entities (DWF Labs, Wintermute, Jump Crypto, Cumberland DRW,
// Alameda Research, GSR Markets) as DRAFT workflow entries, then upserts
// MmSource rows and injects 29 MmAttribution records. Every write is logged
// in MmReviewLog with actor=osint_batch.
//
// Idempotent: re-running skips rows that already exist.
//
// Usage: npx tsx scripts/mm/ingestOsintWallets.ts

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  MmAttribMethod,
  MmChain,
  MmCredTier,
  MmRiskBand,
  MmSourceType,
  MmStatus,
} from "@/lib/mm/types";
import { createEntity, findEntityBySlug } from "@/lib/mm/registry/entities";
import { writeReviewLog } from "@/lib/mm/registry/reviewLog";

const SEED_ACTOR = {
  userId: "system",
  role: "osint_batch",
} as const;

// ─── Entities to create when missing ──────────────────────────────────────

interface EntitySpec {
  slug: string;
  name: string;
  legalName?: string;
  jurisdiction?: string;
  status: MmStatus;
  riskBand: MmRiskBand;
  defaultScore: number;
  publicSummary: string;
  publicSummaryFr: string;
  knownAliases?: string[];
  officialDomains?: string[];
}

const ENTITIES_TO_ENSURE: EntitySpec[] = [
  {
    slug: "dwf-labs",
    name: "DWF Labs",
    legalName: "DWF Labs Ltd.",
    jurisdiction: "AE",
    status: "DOCUMENTED",
    riskBand: "ORANGE",
    defaultScore: 60,
    publicSummary:
      "Dubai-based market maker investigated by the Wall Street Journal (May 2024) for alleged wash trading on Binance. DWF Labs contests the allegations.",
    publicSummaryFr:
      "Market maker basé à Dubaï, mis en cause par le Wall Street Journal (mai 2024) pour des pratiques alléguées de wash trading sur Binance. DWF Labs conteste l'ensemble de ces allégations.",
    knownAliases: ["DWF Labs", "Digital Wave Finance"],
    officialDomains: ["dwf-labs.com"],
  },
  {
    slug: "wintermute",
    name: "Wintermute Trading",
    legalName: "Wintermute Trading Ltd.",
    jurisdiction: "GB",
    status: "OBSERVED",
    riskBand: "YELLOW",
    defaultScore: 35,
    publicSummary:
      "London-based algorithmic market maker. Subject of a September 2022 DeFi hack exposing partial operational wallet structure. No regulatory charges.",
    publicSummaryFr:
      "Market maker algorithmique basé à Londres. Cible d'un hack DeFi en septembre 2022 qui a exposé une partie de l'infrastructure opérationnelle. Aucune charge réglementaire.",
    knownAliases: ["Wintermute"],
    officialDomains: ["wintermute.com"],
  },
  {
    slug: "jump-crypto",
    name: "Jump Crypto",
    legalName: "Jump Trading LLC",
    jurisdiction: "US",
    status: "SETTLED",
    riskBand: "ORANGE",
    defaultScore: 60,
    publicSummary:
      "Crypto arm of Jump Trading. Tai Mo Shan Limited — an affiliate — settled an SEC case in December 2024 related to the TerraUSD (UST) collapse.",
    publicSummaryFr:
      "Branche crypto de Jump Trading. Tai Mo Shan Limited, entité affiliée, a conclu un accord avec la SEC en décembre 2024 relatif à l'effondrement de TerraUSD (UST).",
    knownAliases: ["Jump", "Jump Trading", "Tai Mo Shan"],
    officialDomains: ["jumpcrypto.com", "jumptrading.com"],
  },
  {
    slug: "cumberland-drw",
    name: "Cumberland DRW",
    legalName: "Cumberland DRW LLC",
    jurisdiction: "US",
    status: "OBSERVED",
    riskBand: "YELLOW",
    defaultScore: 30,
    publicSummary:
      "Institutional crypto trading desk of DRW Holdings. SEC filed charges in 2024; the complaint was dismissed by agreement in 2025.",
    publicSummaryFr:
      "Bureau de trading crypto institutionnel du groupe DRW Holdings. Plainte SEC déposée en 2024, puis dismissal approuvé sur demande conjointe en 2025.",
    knownAliases: ["Cumberland"],
    officialDomains: ["cumberland.io"],
  },
  {
    slug: "alameda-research",
    name: "Alameda Research",
    legalName: "Alameda Research LLC",
    jurisdiction: "US",
    status: "CONVICTED",
    riskBand: "RED",
    defaultScore: 95,
    publicSummary:
      "Quantitative trading firm founded by Sam Bankman-Fried. Collapsed in November 2022 alongside FTX. Multiple related executives convicted for fraud.",
    publicSummaryFr:
      "Société de trading quantitatif fondée par Sam Bankman-Fried. Effondrée en novembre 2022 aux côtés de FTX. Plusieurs dirigeants affiliés ont été condamnés pour fraude.",
    knownAliases: ["Alameda"],
    officialDomains: [],
  },
  {
    slug: "gsr-markets",
    name: "GSR Markets",
    legalName: "GSR Markets Limited",
    jurisdiction: "GB",
    status: "OBSERVED",
    riskBand: "GREEN",
    defaultScore: 15,
    publicSummary:
      "London-based algorithmic crypto market maker. No regulatory charges. Tracked for baseline cohort calibration.",
    publicSummaryFr:
      "Market maker crypto algorithmique basé à Londres. Aucune charge réglementaire. Suivi pour calibration baseline de cohorte.",
    knownAliases: ["GSR"],
    officialDomains: ["gsr.io"],
  },
];

// ─── Wallet ingestions ────────────────────────────────────────────────────

interface WalletSpec {
  entitySlug: string;
  address: string;
  chain: MmChain;
  confidence: number;
  method: MmAttribMethod;
  sourceTitle: string;
  sourceUrl: string;
  sourcePublisher: string;
  sourceType: MmSourceType;
  sourceCredTier: MmCredTier;
}

const GOTBIT_SOURCE_URL =
  "https://www.justice.gov/d9/2025-03/usa_v._gotbit_-_complaint_for_forfeiture.pdf";
const GOTBIT_SOURCE_TITLE =
  "DOJ — USA v. Gotbit, Complaint for Forfeiture (March 2025)";

const WALLETS: WalletSpec[] = [
  // ── GOTBIT ──
  ...(["ETHEREUM", "BASE", "ARBITRUM", "POLYGON"] as const).map(
    (chain): WalletSpec => ({
      entitySlug: "gotbit",
      address: "0x290B6eBbdca04eE984fB8617E1b92deea23052E3",
      chain,
      confidence: 0.95,
      method: "COURT_FILING",
      sourceTitle: `${GOTBIT_SOURCE_TITLE} — Wallet 1`,
      sourceUrl: GOTBIT_SOURCE_URL,
      sourcePublisher: "U.S. Department of Justice",
      sourceType: "DOJ",
      sourceCredTier: "TIER_1",
    }),
  ),
  {
    entitySlug: "gotbit",
    address: "0xB937Ba9358D20EFcDB5F0fD363Ca963989A536ec",
    chain: "ETHEREUM",
    confidence: 0.95,
    method: "COURT_FILING",
    sourceTitle: `${GOTBIT_SOURCE_TITLE} — Wallet 2`,
    sourceUrl: GOTBIT_SOURCE_URL,
    sourcePublisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    sourceCredTier: "TIER_1",
  },
  {
    entitySlug: "gotbit",
    address: "0x64b9de4EDE0D4d8C0155c5F1899aA727D539F258",
    chain: "ETHEREUM",
    confidence: 0.95,
    method: "COURT_FILING",
    sourceTitle: `${GOTBIT_SOURCE_TITLE} — Wallet 3`,
    sourceUrl: GOTBIT_SOURCE_URL,
    sourcePublisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    sourceCredTier: "TIER_1",
  },

  // ── DWF LABS ──
  dwfArkham(
    "0xd4b69e8d62c880e9dd55d419d5e07435c3538342",
    "Etherscan nametag — DWF Labs (primary)",
    "https://etherscan.io/address/0xd4b69e8d62c880e9dd55d419d5e07435c3538342",
  ),
  dwfArkham(
    "0xddAcAd3B1edee8E2F5b2e84f658202534fcb0374",
    "Etherscan nametag — DWF Labs",
    "https://etherscan.io/address/0xddAcAd3B1edee8E2F5b2e84f658202534fcb0374",
  ),
  dwfArkham(
    "0x53c902a9ef069f3b85e5e71f918c4d582f3063fa",
    "Etherscan nametag — DWFLabs",
    "https://etherscan.io/address/0x53c902a9ef069f3b85e5e71f918c4d582f3063fa",
  ),
  {
    entitySlug: "dwf-labs",
    address: "0x8eb8273facecf37bf9d5fe7859cda0729b0b0d63",
    chain: "ETHEREUM",
    confidence: 0.75,
    method: "OSINT",
    sourceTitle: "Lookonchain — DWF Labs withdrawal 96.2M 1CAT from Gate.io",
    sourceUrl: "https://x.com/lookonchain/status/1742194379153125517",
    sourcePublisher: "Lookonchain",
    sourceType: "OSINT",
    sourceCredTier: "TIER_3",
  },
  {
    entitySlug: "dwf-labs",
    address: "0xF0984860f1F31a784c0FF0bb4d1322e377f97631",
    chain: "ETHEREUM",
    confidence: 0.75,
    method: "OSINT",
    sourceTitle: "Lookonchain — DWF Labs withdrawal 2M MANTA",
    sourceUrl: "https://x.com/lookonchain/status/1925184950724370514",
    sourcePublisher: "Lookonchain",
    sourceType: "OSINT",
    sourceCredTier: "TIER_3",
  },
  {
    entitySlug: "dwf-labs",
    address: "0x3d67fdE4B4F5077f79D3bb8Aaa903BF5e7642751",
    chain: "ETHEREUM",
    confidence: 0.70,
    method: "HACK_LEAK",
    sourceTitle: "DWF Labs — alleged $44M hack 2022 (+ ZachXBT coverage)",
    sourceUrl:
      "https://finance.yahoo.com/news/dwf-labs-allegedly-lost-44-050319950.html",
    sourcePublisher: "Yahoo Finance / ZachXBT",
    sourceType: "HACK_LEAK",
    sourceCredTier: "TIER_3",
  },

  // ── WINTERMUTE ──
  wintermuteArkham(
    "0xdbf5e9c5206d0db70a90108bf936da60221dc080",
    "Etherscan nametag — Wintermute",
  ),
  wintermuteArkham(
    "0x4f3a120e72c76c22ae802d129f599bfdbc31cb81",
    "Etherscan nametag — Wintermute Multisig",
  ),
  wintermuteArkham(
    "0xf30f9fdc881252e8c881ae609c908200e01ac650",
    "Etherscan nametag — Wintermute Negotiator",
  ),
  wintermuteArkham(
    "0xce84449a8ebec019ac110a4b6662e55d0fd9f228",
    "Etherscan nametag — Wintermute 5",
  ),
  wintermuteArkham(
    "0xf8191d98ae98d2f7abdfb63a9b0b812b93c873aa",
    "Etherscan nametag — Wintermute 4",
  ),

  // ── JUMP CRYPTO ──
  jumpArkham(
    "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621",
    "Etherscan nametag — Jump Trading",
  ),
  jumpArkham(
    "0x1090258dd4af971adccf0b465bf770e3f0e0a940",
    "Etherscan — Jump Trading, UST/Curve activity",
  ),
  jumpArkham(
    "0x59964a45f2efbb001859Ab57e3e4CdcfB7F3d2C0",
    "Etherscan nametag — Binance-Jump Trading",
  ),

  // ── CUMBERLAND DRW ──
  cumberlandArkham(
    "0xad6eaa735D9dF3D7696fd03984379dAE02eD8862",
    "Etherscan nametag — Cumberland",
  ),
  cumberlandArkham(
    "0x87b49a99cbce4a9030e67919b776aa97d538adda",
    "Etherscan nametag — Cumberland",
  ),

  // ── ALAMEDA RESEARCH ──
  alamedaArkham(
    "0x3507e4978e0eb83315d20df86ca0b976c0e40ccb",
    "Etherscan nametag — Alameda Research: Binance Deposit",
  ),
  alamedaArkham(
    "0x712d0f306956a6a4b4f9319ad9b9de48c5345996",
    "Etherscan nametag — Alameda Research 2",
  ),
  alamedaArkham(
    "0x93c08a3168fc469f3fc165cd3a471d19a37ca19e",
    "Etherscan nametag — Alameda Research 3",
  ),
  alamedaArkham(
    "0xca436e14855323927d6e6264470ded36455fc8bd",
    "Etherscan nametag — Alameda Research 4",
  ),
  alamedaArkham(
    "0x5d13f4bf21db713e17e04d711e0bf7eaf18540d6",
    "Etherscan nametag — Alameda Research 9",
  ),
  alamedaArkham(
    "0x964d9d1a532b5a5daeacbac71d46320de313ae9c",
    "Etherscan nametag — Alameda Research 13",
  ),
  alamedaArkham(
    "0x0f4ee9631f4be0a63756515141281a3e2b293bbe",
    "Etherscan nametag — Alameda Research 23",
  ),
  alamedaArkham(
    "0x84d34f4f83a87596cd3fb6887cff8f17bf5a7b83",
    "Etherscan nametag — Alameda Research 25",
  ),
  alamedaArkham(
    "0xa726c00cda1f60aaab19bc095d02a46556837f31",
    "Etherscan nametag — Alameda Research WBTC Merchant",
  ),

  // ── GSR MARKETS ──
  {
    entitySlug: "gsr-markets",
    address: "0xd8d6ffe342210057bf4dcc31da28d006f253cef0",
    chain: "ETHEREUM",
    confidence: 0.85,
    method: "ARKHAM",
    sourceTitle: "Etherscan nametag — GSR",
    sourceUrl:
      "https://etherscan.io/address/0xd8d6ffe342210057bf4dcc31da28d006f253cef0",
    sourcePublisher: "Etherscan / Arkham Intelligence",
    sourceType: "OSINT",
    sourceCredTier: "TIER_2",
  },
];

function dwfArkham(address: string, title: string, url?: string): WalletSpec {
  return {
    entitySlug: "dwf-labs",
    address,
    chain: "ETHEREUM",
    confidence: 0.85,
    method: "ARKHAM",
    sourceTitle: title,
    sourceUrl: url ?? `https://etherscan.io/address/${address}`,
    sourcePublisher: "Etherscan / Arkham Intelligence",
    sourceType: "OSINT",
    sourceCredTier: "TIER_2",
  };
}
function wintermuteArkham(address: string, title: string): WalletSpec {
  return {
    entitySlug: "wintermute",
    address,
    chain: "ETHEREUM",
    confidence: 0.85,
    method: "ARKHAM",
    sourceTitle: title,
    sourceUrl: `https://etherscan.io/address/${address}`,
    sourcePublisher: "Etherscan / Arkham Intelligence",
    sourceType: "OSINT",
    sourceCredTier: "TIER_2",
  };
}
function jumpArkham(address: string, title: string): WalletSpec {
  return {
    entitySlug: "jump-crypto",
    address,
    chain: "ETHEREUM",
    confidence: 0.85,
    method: "ARKHAM",
    sourceTitle: title,
    sourceUrl: `https://etherscan.io/address/${address}`,
    sourcePublisher: "Etherscan / Arkham Intelligence",
    sourceType: "OSINT",
    sourceCredTier: "TIER_2",
  };
}
function cumberlandArkham(address: string, title: string): WalletSpec {
  return {
    entitySlug: "cumberland-drw",
    address,
    chain: "ETHEREUM",
    confidence: 0.85,
    method: "ARKHAM",
    sourceTitle: title,
    sourceUrl: `https://etherscan.io/address/${address}`,
    sourcePublisher: "Etherscan / Arkham Intelligence",
    sourceType: "OSINT",
    sourceCredTier: "TIER_2",
  };
}
function alamedaArkham(address: string, title: string): WalletSpec {
  return {
    entitySlug: "alameda-research",
    address,
    chain: "ETHEREUM",
    confidence: 0.85,
    method: "ARKHAM",
    sourceTitle: title,
    sourceUrl: `https://etherscan.io/address/${address}`,
    sourcePublisher: "Etherscan / Arkham Intelligence",
    sourceType: "OSINT",
    sourceCredTier: "TIER_2",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface IngestSummary {
  entitiesCreated: number;
  entitiesExisted: number;
  sourcesCreated: number;
  sourcesExisted: number;
  attributionsCreated: number;
  attributionsExisted: number;
  errors: Array<{ item: string; error: string }>;
}

export async function ingestOsintWallets(): Promise<IngestSummary> {
  const summary: IngestSummary = {
    entitiesCreated: 0,
    entitiesExisted: 0,
    sourcesCreated: 0,
    sourcesExisted: 0,
    attributionsCreated: 0,
    attributionsExisted: 0,
    errors: [],
  };

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.includes("ep-square-band")) {
    throw new Error("refusing to run: target is not ep-square-band");
  }

  // ── 1. Ensure entities exist ────────────────────────────────────────────
  const entityIdBySlug = new Map<string, string>();
  for (const spec of ENTITIES_TO_ENSURE) {
    const existing = await findEntityBySlug(spec.slug);
    if (existing) {
      entityIdBySlug.set(spec.slug, existing.id);
      summary.entitiesExisted += 1;
      console.log(`[mm osint] entity ${spec.slug} exists (workflow=${existing.workflow})`);
      continue;
    }
    const created = await createEntity(
      {
        slug: spec.slug,
        name: spec.name,
        legalName: spec.legalName ?? null,
        jurisdiction: spec.jurisdiction ?? null,
        status: spec.status,
        riskBand: spec.riskBand,
        defaultScore: spec.defaultScore,
        publicSummary: spec.publicSummary,
        publicSummaryFr: spec.publicSummaryFr,
        knownAliases: spec.knownAliases ?? [],
        officialDomains: spec.officialDomains ?? [],
      },
      SEED_ACTOR,
    );
    entityIdBySlug.set(spec.slug, created.id);
    summary.entitiesCreated += 1;
    console.log(`[mm osint] entity ${spec.slug} created (${created.id}, DRAFT)`);
  }

  // Also look up the 4 Phase-1 entities.
  for (const slug of ["gotbit", "cls-global", "mytrade", "zm-quant"]) {
    if (entityIdBySlug.has(slug)) continue;
    const e = await findEntityBySlug(slug);
    if (e) entityIdBySlug.set(slug, e.id);
  }

  // ── 2. Ingest wallets ───────────────────────────────────────────────────
  const sourceIdByUrl = new Map<string, string>();

  for (const w of WALLETS) {
    try {
      const entityId = entityIdBySlug.get(w.entitySlug);
      if (!entityId) {
        summary.errors.push({
          item: `${w.address} on ${w.chain}`,
          error: `entity slug ${w.entitySlug} not found`,
        });
        continue;
      }

      // Source (upsert by URL).
      let sourceId = sourceIdByUrl.get(w.sourceUrl);
      if (!sourceId) {
        const existingSource = await prisma.mmSource.findFirst({
          where: { url: w.sourceUrl },
        });
        if (existingSource) {
          sourceId = existingSource.id;
          sourceIdByUrl.set(w.sourceUrl, sourceId);
          summary.sourcesExisted += 1;
        } else {
          const created = await prisma.mmSource.create({
            data: {
              publisher: w.sourcePublisher,
              sourceType: w.sourceType,
              url: w.sourceUrl,
              title: w.sourceTitle,
              credibilityTier: w.sourceCredTier,
              language: "en",
              archivalStatus: "PENDING",
            },
          });
          sourceId = created.id;
          sourceIdByUrl.set(w.sourceUrl, sourceId);
          summary.sourcesCreated += 1;
          await writeReviewLog({
            targetType: "SOURCE",
            targetId: created.id,
            action: "CREATED",
            actorUserId: SEED_ACTOR.userId,
            actorRole: SEED_ACTOR.role,
            notes: `source ingested via osint batch`,
          });
        }
      }

      // Attribution (skip if already present and not revoked).
      const existingAttr = await prisma.mmAttribution.findFirst({
        where: {
          walletAddress: w.address,
          chain: w.chain,
          mmEntityId: entityId,
          revokedAt: null,
        },
      });
      if (existingAttr) {
        summary.attributionsExisted += 1;
        continue;
      }

      const attribution = await prisma.mmAttribution.create({
        data: {
          walletAddress: w.address,
          chain: w.chain,
          mmEntityId: entityId,
          attributionMethod: w.method,
          confidence: w.confidence,
          evidenceRefs: [
            {
              sourceId,
              description: w.sourceTitle,
            },
          ] as unknown as Prisma.InputJsonValue,
          reviewerUserId: SEED_ACTOR.userId,
          reviewedAt: new Date(),
        },
      });

      await writeReviewLog({
        targetType: "ATTRIBUTION",
        targetId: attribution.id,
        action: "CREATED",
        actorUserId: SEED_ACTOR.userId,
        actorRole: SEED_ACTOR.role,
        notes: `wallet ${w.address} (${w.chain}) → ${w.entitySlug} via ${w.method}`,
        snapshotAfter: {
          walletAddress: w.address,
          chain: w.chain,
          entitySlug: w.entitySlug,
          confidence: w.confidence,
          method: w.method,
          sourceUrl: w.sourceUrl,
        } as unknown as Prisma.InputJsonValue,
      });

      summary.attributionsCreated += 1;
    } catch (err) {
      summary.errors.push({
        item: `${w.address} on ${w.chain} → ${w.entitySlug}`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}

// ─── CLI entry point ──────────────────────────────────────────────────────

async function main() {
  console.log("[mm osint] starting ingestion");
  const s = await ingestOsintWallets();
  console.log("");
  console.log("────────────────────────────────────────");
  console.log("  MM_TRACKER — OSINT ingestion summary");
  console.log("────────────────────────────────────────");
  console.log(`  Entities created       : ${s.entitiesCreated}`);
  console.log(`  Entities already exist : ${s.entitiesExisted}`);
  console.log(`  Sources created        : ${s.sourcesCreated}`);
  console.log(`  Sources already exist  : ${s.sourcesExisted}`);
  console.log(`  Attributions created   : ${s.attributionsCreated}`);
  console.log(`  Attributions already   : ${s.attributionsExisted}`);
  console.log(`  Errors                 : ${s.errors.length}`);
  if (s.errors.length > 0) {
    console.log("  ──");
    for (const e of s.errors) {
      console.log(`   • ${e.item} → ${e.error}`);
    }
  }
  console.log("────────────────────────────────────────");
}

// Only auto-run when invoked directly (so the module is importable in tests
// without launching the ingestion).
const mainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("ingestOsintWallets.ts");

if (mainModule) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { ENTITIES_TO_ENSURE, WALLETS };
