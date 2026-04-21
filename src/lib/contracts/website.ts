/**
 * Public Website 2.0 data contracts.
 *
 * These are the SHAPES the public forensic surface reads. Mocks under
 * `src/lib/mocks/` conform to them. Future real APIs must serialize to
 * them too. Investigator-internal shapes are deliberately out of scope —
 * the public site never imports from `src/components/investigator/` or
 * investigator-only libs.
 */

// ───────── Primitives ─────────

export type ISODate = string; // "2026-04-19T12:00:00Z"
export type HashRef = string; // sha256 or content hash
export type Chain = "solana" | "ethereum" | "base" | "tron" | "other";

export type Verdict =
  | "critical"
  | "high"
  | "elevated"
  | "monitoring"
  | "cleared";

export type Confidence = "low" | "medium" | "high" | "certified";

export type ActorRole =
  | "deployer"
  | "kol"
  | "cex"
  | "bridge"
  | "mixer"
  | "treasury"
  | "liquidity"
  | "exit";

export interface ClassificationContext {
  sessionId: string;
  issuedAt: ISODate;
  standard: "Forensic Editorial v2" | string;
  jurisdictionHint?: string;
}

// ───────── Scan result (/result/[id]) ─────────

export interface ScanSignal {
  id: string;
  label: string;            // "Authority control", "Liquidity lock", ...
  kicker: string;           // short mono-meta line above the label
  value: string;            // right-aligned metric rendered in mono
  verdict: Verdict;
  detail: string;            // one-paragraph editorial claim
  evidenceIds: string[];    // references into EvidenceClaim.id
}

export interface ScanResult {
  id: string;
  subject: {
    kind: "token" | "wallet" | "kol";
    label: string;           // display name
    identifier: string;      // mint / address / handle
    chain: Chain;
  };
  score: {
    value: number;           // 0–100
    max: 100;
    verdict: Verdict;
    mark: string;            // e.g. "CRITICAL RISK"
  };
  verdictText: string;       // 1–2 sentence editorial summary
  signals: ScanSignal[];     // 3-column grid on the page
  actions: {
    primary: { label: string; href: string };
    secondary: Array<{ label: string; href: string }>;
  };
  linkedActors: LinkedActor[];
  linkedWallets: LinkedWallet[];
  analysis: {
    headline: string;
    body: string;            // long-form narrative band
  };
  issuedAt: ISODate;
  classification: ClassificationContext;
}

// ───────── Evidence (/evidence/[id]) ─────────

export interface EvidenceClaim {
  id: string;
  bucket:
    | "on_chain"
    | "off_chain"
    | "communications"
    | "identity"
    | "timeline"
    | "corroboration";
  headline: string;
  statement: string;
  confidence: Confidence;
  sources: EvidenceSource[];
  capturedAt: ISODate;
  hash: HashRef;
  editorialStandard: "Forensic Editorial v2" | string;
}

export interface EvidenceSource {
  kind: "tx" | "url" | "doc" | "capture" | "oracle";
  label: string;
  ref: string;               // tx hash, url, doc hash, etc.
  retrievedAt: ISODate;
}

export interface EvidenceBundle {
  id: string;
  subjectRef: {
    kind: "scan" | "kol" | "case";
    id: string;
  };
  groups: Array<{
    bucket: EvidenceClaim["bucket"];
    claims: EvidenceClaim[];
  }>;
  density: {
    total: number;
    byConfidence: Record<Confidence, number>;
  };
}

// ───────── KOL (/kol/[handle]) ─────────

export interface KOLProfile {
  handle: string;
  displayName: string;
  platforms: Array<{ platform: "x" | "telegram" | "youtube" | "tiktok"; url: string }>;
  verdict: {
    mark: string;
    verdict: Verdict;
    summary: string;
  };
  stats: Array<{
    kicker: string;
    value: string;
    sublabel: string;
  }>;
  behaviouralSignals: ScanSignal[];
  evidenceDensity: EvidenceBundle["density"];
  standardSection: {
    headline: string;
    body: string;
  };
  issuedAt: ISODate;
  classification: ClassificationContext;
}

// ───────── Cases (/cases, /cases/[slug]) ─────────

export interface CaseSummary {
  slug: string;
  title: string;
  kicker: string;            // mono-meta context (e.g. "DEX-LAUNCH // Q4-25")
  dek: string;               // 1–2 sentence lead
  coverScore?: number;       // optional badge
  verdict: Verdict;
  publishedAt: ISODate;
  tags: string[];
}

export interface CasefileSection {
  id: string;                // anchor id for section-nav
  title: string;
  kind:
    | "hero"
    | "narrative"
    | "flow"
    | "timeline"
    | "filing"
    | "annex"
    | "evidence";
  body?: string;             // rich text / markdown-ish
}

export interface FlowStage {
  id: string;
  label: string;
  detail: string;
  verdict: Verdict;
}

export interface TimelineEvent {
  at: ISODate;
  label: string;
  detail: string;
  evidenceIds: string[];
}

export interface Casefile {
  slug: string;
  summary: CaseSummary;
  sections: CasefileSection[];
  flow: FlowStage[];
  timeline: TimelineEvent[];
  filing: {
    authored: ISODate;
    revision: string;
    hash: HashRef;
    editorialStandard: string;
  };
  annexes: Array<{ id: string; label: string; href: string; hash: HashRef }>;
  evidence: EvidenceBundle;
  classification: ClassificationContext;
}

// ───────── Constellation (public snapshot) ─────────

export interface GraphNode {
  id: string;
  kind: "token" | "wallet" | "kol" | "cex" | "bridge" | "evidence";
  role?: ActorRole;
  label: string;
  verdict: Verdict;
  x: number;                 // snapshot coordinates (layout is baked in)
  y: number;
  r?: number;
}

export interface GraphEdge {
  id: string;
  source: string;            // GraphNode.id
  target: string;
  kind: "transaction" | "kol_relation" | "suspicious" | "money_flow";
  weight?: number;
}

/**
 * `GraphData` is the MINIMAL PUBLIC snapshot schema shared by the public
 * forensic surface and any investigator-facing consumer that wants to read
 * the same baked layout.
 *
 * - The public side (`(forensic)/constellation`, snapshot loader in
 *   `@/lib/constellation`) reads EXACTLY this shape. Fields here are the
 *   contract and must not be mutated opportunistically to satisfy a local
 *   investigator need.
 * - The investigator surface (live graph) is allowed to EXTEND this shape
 *   via its own dedicated type (e.g. `InvestigatorGraphData extends GraphData`)
 *   colocated with investigator code. Do not widen this public contract
 *   inline to pass through investigator-only fields.
 * - Any change here is a public-API change: coordinate it with the snapshot
 *   fixtures and `validateSnapshot()` in `@/lib/constellation`.
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: Array<{
    id: string;
    label: string;
    nodeIds: string[];
    tint: "alpha" | "beta" | "gamma";
  }>;
}

export interface ConstellationSnapshot {
  id: string;
  caseRef?: string;
  capturedAt: ISODate;
  graph: GraphData;
  signalBrief: Array<{
    id: string;
    priority: Verdict;
    title: string;
    detail: string;
    nodeIds: string[];
  }>;
  timeline: TimelineEvent[];
  classification: ClassificationContext;
}

// ───────── Linked actors / wallets (shared) ─────────

export interface LinkedActor {
  id: string;
  kind: "kol" | "entity" | "pseudonymous";
  label: string;
  role: ActorRole;
  verdict: Verdict;
  href?: string;
}

export interface LinkedWallet {
  id: string;
  address: string;
  chain: Chain;
  role: ActorRole;
  verdict: Verdict;
  firstSeen: ISODate;
  lastSeen: ISODate;
}
