/**
 * src/lib/investigator/registry.ts
 *
 * PUBLISHED INTELLIGENCE REGISTRY — single source of truth for all
 * published data shown on the Investigator Dashboard.
 *
 * Rules:
 *  - Only entries with `published: true` are served
 *  - No drafts, no internal data, no filesystem scanning
 *  - Every entry has stable IDs, fiable dates, editorial titles
 *  - Cross-references between modules via IDs
 *  - Changes = commit + deploy (appropriate for beta NDA cadence)
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface PublishedCase {
  id: string;
  caseCode: string;
  title: string;
  assetSymbol: string;
  summary: string;
  chain: string;
  riskTier: "RED" | "HIGH" | "WATCH" | "UNVERIFIED";
  status: "Published" | "Referenced" | "Under Review";
  published: boolean;
  publishedAt: string;   // ISO date
  openedAt: string;      // ISO date
  updatedAt?: string;
  evidenceCount: number;
  claimCount: number;
  relatedPdfIds: string[];
  relatedKolHandles: string[];
  relatedProceedIds: string[];
  order: number;
}

export interface PublishedPdf {
  id: string;
  slug: string;
  title: string;
  language: "EN" | "FR";
  version: string;
  status: "Published";
  published: boolean;
  publishedAt: string;
  filename: string;       // actual file at project root
  fileSize: number;       // KB
  relatedCaseId: string | null;
  order: number;
}

export interface PublishedProceed {
  id: string;
  entityId: string;       // KOL handle or case ID
  entityType: "kol" | "case" | "cluster";
  entityLabel: string;
  caseId: string | null;
  chain: string;
  walletShort: string;
  buyTx: string;
  sellTx: string;
  amount: number;
  currency: string;
  usdValue: number;
  observedAt: string;     // ISO date
  note: string;
  evidenceCount: number;
  published: boolean;
  order: number;
}

export interface PublishedAlert {
  id: string;
  entity: string;
  entityHandle: string;
  signalType: "CTA_DANGEROUS" | "CA_DETECTED" | "DOMAIN_RISK" | "NARRATIVE_SPIKE" | "SELL_WHILE_SHILL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  proofCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  linkedCaseId: string | null;
  linkedKolHandle: string | null;
  published: boolean;
  note: string;
  order: number;
}

// ─── PUBLISHED CASES ────────────────────────────────────────────────────────

export const PUBLISHED_CASES: PublishedCase[] = [
  {
    id: "case-botify-001",
    caseCode: "CASE-2024-BOTIFY-001",
    title: "BOTIFY Rug Pull — Solana",
    assetSymbol: "$BOTIFY",
    summary:
      "BOTIFY token on Solana exhibits multiple high-severity rug-pull indicators: anonymous team, " +
      "no locked liquidity, coordinated shill campaigns, and abrupt social media abandonment post-launch. " +
      "Eight independent claims corroborated by screenshot evidence.",
    chain: "SOL",
    riskTier: "RED",
    status: "Published",
    published: true,
    publishedAt: "2025-01-15",
    openedAt: "2024-11-01",
    updatedAt: "2025-03-20",
    evidenceCount: 8,
    claimCount: 8,
    relatedPdfIds: ["pdf-botify-en", "pdf-botify-fr", "pdf-botify-v3"],
    relatedKolHandles: ["bkokoski", "GordonGekko"],
    relatedProceedIds: ["proceed-botify-insider", "proceed-gordon-cex", "proceed-bk-coordinated-exit"],
    order: 1,
  },
];

// ─── PUBLISHED PDFs ─────────────────────────────────────────────────────────

export const PUBLISHED_PDFS: PublishedPdf[] = [
  {
    id: "pdf-botify-en",
    slug: "botify-casefile-en",
    title: "BOTIFY Case File — EN",
    language: "EN",
    version: "1.0",
    status: "Published",
    published: true,
    publishedAt: "2025-01-15",
    filename: "casefile_EN.pdf",
    fileSize: 349,
    relatedCaseId: "case-botify-001",
    order: 1,
  },
  {
    id: "pdf-botify-fr",
    slug: "botify-casefile-fr",
    title: "BOTIFY Case File — FR",
    language: "FR",
    version: "1.0",
    status: "Published",
    published: true,
    publishedAt: "2025-01-15",
    filename: "casefile_FR.pdf",
    fileSize: 351,
    relatedCaseId: "case-botify-001",
    order: 2,
  },
  {
    id: "pdf-botify-v3",
    slug: "botify-casefile-v3",
    title: "BOTIFY Case File — Extended v3",
    language: "EN",
    version: "3.0",
    status: "Published",
    published: true,
    publishedAt: "2025-03-10",
    filename: "casefile_botify_v3.pdf",
    fileSize: 279,
    relatedCaseId: "case-botify-001",
    order: 3,
  },
];

// ─── PUBLISHED PROCEEDS ─────────────────────────────────────────────────────

export const PUBLISHED_PROCEEDS: PublishedProceed[] = [
  {
    id: "proceed-botify-insider",
    entityId: "case-botify-001",
    entityType: "case",
    entityLabel: "BOTIFY Insider Wallet",
    caseId: "case-botify-001",
    chain: "SOL",
    walletShort: "DezX...B263",
    buyTx: "4xZ9...kQMM",
    sellTx: "9Th6...BYZ9",
    amount: 4820,
    currency: "USD",
    usdValue: 4820,
    observedAt: "2024-11-04",
    note: "Insider wallet bought 2h before launch, sold at peak — +$4,820 PnL in 18 min.",
    evidenceCount: 3,
    published: true,
    order: 1,
  },
  {
    id: "proceed-gordon-cex",
    entityId: "GordonGekko",
    entityType: "kol",
    entityLabel: "Gordon Gekko — CEX Cashout",
    caseId: "case-botify-001",
    chain: "SOL",
    walletShort: "Eu8i...m24J",
    buyTx: "",
    sellTx: "",
    amount: 99750,
    currency: "USD",
    usdValue: 99750,
    observedAt: "2025-01-20",
    note: "CEX cashout chain: 245 SOL ($36,750) via Binance + 420 SOL ($63,000) via KuCoin relay. Source-attributed.",
    evidenceCount: 4,
    published: true,
    order: 2,
  },
  {
    id: "proceed-sam-cluster",
    entityId: "sam-cluster",
    entityType: "cluster",
    entityLabel: "SAM Cluster — Bot Cashout",
    caseId: "case-botify-001",
    chain: "SOL",
    walletShort: "SAM-E/F",
    buyTx: "",
    sellTx: "",
    amount: 19460,
    currency: "USD",
    usdValue: 19460,
    observedAt: "2025-02-05",
    note: "Bot-operated cashout: 72 SOL ($14,500) with 4h-interval pattern + 213k GHOST dumped in 3 min ($4,960). Analytical estimate.",
    evidenceCount: 2,
    published: true,
    order: 3,
  },
  {
    id: "proceed-bk-coordinated-exit",
    entityId: "bkokoski",
    entityType: "kol",
    entityLabel: "BK — Coordinated Exit Event",
    caseId: "case-botify-001",
    chain: "SOL",
    walletShort: "HeaiD...tMQ",
    buyTx: "",
    sellTx: "",
    amount: 210000,
    currency: "USD",
    usdValue: 210000,
    observedAt: "2026-03-20",
    note: "$210K USDC in 3 hours via 50+ transactions. CEX endpoints: TITAN ($64K, 50 wallets) + Unknown CEX ($97K, 72 wallets).",
    evidenceCount: 5,
    published: true,
    order: 4,
  },
];

// ─── PUBLISHED ALERTS ───────────────────────────────────────────────────────

export const PUBLISHED_ALERTS: PublishedAlert[] = [
  {
    id: "alert-hsig-ca",
    entity: "HSIG Meme Coin",
    entityHandle: "HSIGMemeCoin",
    signalType: "CA_DETECTED",
    severity: "HIGH",
    proofCount: 3,
    firstSeenAt: "2025-03-15",
    lastSeenAt: "2025-03-28",
    linkedCaseId: null,
    linkedKolHandle: "HSIGMemeCoin",
    published: true,
    note: "Meme coin promotion with pump.fun links and CA drops in public posts.",
    order: 1,
  },
  {
    id: "alert-gordon-cta",
    entity: "Gordon Gekko",
    entityHandle: "GordonGekko",
    signalType: "CTA_DANGEROUS",
    severity: "HIGH",
    proofCount: 2,
    firstSeenAt: "2025-03-10",
    lastSeenAt: "2025-03-28",
    linkedCaseId: "case-botify-001",
    linkedKolHandle: "GordonGekko",
    published: true,
    note: "CTA-like wording and buy-pressure signals observed in public posts.",
    order: 2,
  },
  {
    id: "alert-deenowback-cta",
    entity: "Dee Nowback",
    entityHandle: "DeeNowback",
    signalType: "CTA_DANGEROUS",
    severity: "HIGH",
    proofCount: 1,
    firstSeenAt: "2025-03-12",
    lastSeenAt: "2025-03-25",
    linkedCaseId: null,
    linkedKolHandle: "DeeNowback",
    published: true,
    note: "CTA-like dangerous wording observed in public posts.",
    order: 3,
  },
  {
    id: "alert-claude-memory",
    entity: "Claude Memory",
    entityHandle: "Claude_Memory",
    signalType: "CTA_DANGEROUS",
    severity: "MEDIUM",
    proofCount: 1,
    firstSeenAt: "2025-02-20",
    lastSeenAt: "2025-03-15",
    linkedCaseId: null,
    linkedKolHandle: "Claude_Memory",
    published: true,
    note: "Airdrop/claim CTA observed in public posts.",
    order: 4,
  },
  {
    id: "alert-muststopmurad",
    entity: "Must Stop Murad",
    entityHandle: "MustStopMurad",
    signalType: "NARRATIVE_SPIKE",
    severity: "MEDIUM",
    proofCount: 2,
    firstSeenAt: "2025-03-01",
    lastSeenAt: "2025-03-28",
    linkedCaseId: null,
    linkedKolHandle: "MustStopMurad",
    published: true,
    note: "High-volume narrative activity observed around token events.",
    order: 5,
  },
  {
    id: "alert-corphish-ca",
    entity: "Corphish Coin",
    entityHandle: "Corphishcoin",
    signalType: "CA_DETECTED",
    severity: "MEDIUM",
    proofCount: 1,
    firstSeenAt: "2025-03-18",
    lastSeenAt: "2025-03-22",
    linkedCaseId: null,
    linkedKolHandle: "Corphishcoin",
    published: true,
    note: "Repeated CA mentions observed in public posts/replies.",
    order: 6,
  },
  {
    id: "alert-donwedge-domain",
    entity: "Don Wedge",
    entityHandle: "DonWedge",
    signalType: "DOMAIN_RISK",
    severity: "MEDIUM",
    proofCount: 2,
    firstSeenAt: "2025-03-05",
    lastSeenAt: "2025-03-20",
    linkedCaseId: null,
    linkedKolHandle: "DonWedge",
    published: true,
    note: "External link patterns observed — suspicious domain risk.",
    order: 7,
  },
  {
    id: "alert-jameswynn-narrative",
    entity: "James Wynn",
    entityHandle: "JamesWynnReal",
    signalType: "NARRATIVE_SPIKE",
    severity: "LOW",
    proofCount: 1,
    firstSeenAt: "2025-02-15",
    lastSeenAt: "2025-03-10",
    linkedCaseId: null,
    linkedKolHandle: "JamesWynnReal",
    published: true,
    note: "Potential narrative spikes observed in public posts.",
    order: 8,
  },
];

// ─── AGGREGATIONS ───────────────────────────────────────────────────────────

export function getPublishedCases(): PublishedCase[] {
  return PUBLISHED_CASES.filter((c) => c.published).sort((a, b) => a.order - b.order);
}

export function getPublishedPdfs(): PublishedPdf[] {
  return PUBLISHED_PDFS.filter((p) => p.published).sort((a, b) => a.order - b.order);
}

export function getPublishedProceeds(): PublishedProceed[] {
  return PUBLISHED_PROCEEDS.filter((p) => p.published).sort((a, b) => a.order - b.order);
}

export function getPublishedAlerts(): PublishedAlert[] {
  return PUBLISHED_ALERTS.filter((a) => a.published).sort((a, b) => a.order - b.order);
}

export function getPublishedMetrics() {
  const cases = getPublishedCases();
  const pdfs = getPublishedPdfs();
  const proceeds = getPublishedProceeds();
  const alerts = getPublishedAlerts();

  return {
    publishedCases: cases.length,
    trackedEntities: new Set([
      ...alerts.map((a) => a.entityHandle),
      ...proceeds.map((p) => p.entityId),
    ]).size,
    watcherSignals: alerts.length,
    publishedPdfs: pdfs.length,
    totalProceeds: proceeds.reduce((sum, p) => sum + p.usdValue, 0),
  };
}

/** Cross-reference: get PDFs related to a case */
export function getPdfsForCase(caseId: string): PublishedPdf[] {
  return getPublishedPdfs().filter((p) => p.relatedCaseId === caseId);
}

/** Cross-reference: get proceeds related to a case */
export function getProceedsForCase(caseId: string): PublishedProceed[] {
  return getPublishedProceeds().filter((p) => p.caseId === caseId);
}
