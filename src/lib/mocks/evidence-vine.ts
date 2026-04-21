import type { EvidenceBundle, EvidenceClaim } from "@/lib/contracts/website";

const CLAIMS: EvidenceClaim[] = [
  {
    id: "ev-mint",
    bucket: "on_chain",
    headline: "Mint authority never revoked",
    statement:
      "Deployer 6AJcP…Hjq3 retains mint authority on token program. Verified on-chain at slot 322,144,902.",
    confidence: "certified",
    sources: [
      { kind: "tx", label: "mint init", ref: "4vNq…zRq2", retrievedAt: "2026-04-18T22:00:00Z" },
    ],
    capturedAt: "2026-04-18T22:00:00Z",
    hash: "sha256:8de4b21c9aa7fe0c4d92e91a1fe00aa0ff",
    editorialStandard: "Forensic Editorial v2",
  },
  {
    id: "ev-supply",
    bucket: "on_chain",
    headline: "49.7M tokens held by two linked wallets",
    statement:
      "Two deployer-linked wallets hold 49.7M of 100M total supply. Clustering confirmed by heuristic H3 (shared fee-payer).",
    confidence: "high",
    sources: [
      { kind: "tx", label: "cluster heuristic", ref: "H3-0421", retrievedAt: "2026-04-18T22:02:00Z" },
    ],
    capturedAt: "2026-04-18T22:02:00Z",
    hash: "sha256:c11be9321dd9b74a09eea7ffcabe3700ef",
    editorialStandard: "Forensic Editorial v2",
  },
  {
    id: "ev-cluster",
    bucket: "on_chain",
    headline: "Cluster bridges to CEX deposit pattern",
    statement:
      "Exit wallet 9fRdk…GcP1 funneled 19 deposits into 3 centralized venues within 36h of price peak.",
    confidence: "high",
    sources: [
      { kind: "tx", label: "cex deposits", ref: "CEX-SET-019", retrievedAt: "2026-04-18T22:04:00Z" },
    ],
    capturedAt: "2026-04-18T22:04:00Z",
    hash: "sha256:a97e441f0c9b71ad77",
    editorialStandard: "Forensic Editorial v2",
  },
  {
    id: "ev-kol-post-1",
    bucket: "communications",
    headline: "KOL post T-0 / Brandon Kokoski",
    statement:
      "Post published 2026-04-12T18:04Z contains recipient address matching deployer-linked cashout wallet.",
    confidence: "certified",
    sources: [
      { kind: "capture", label: "X post", ref: "cap-bk-042", retrievedAt: "2026-04-13T09:00:00Z" },
    ],
    capturedAt: "2026-04-13T09:00:00Z",
    hash: "sha256:41e02b7cae3d90aa0003",
    editorialStandard: "Forensic Editorial v2",
  },
  {
    id: "ev-kol-post-2",
    bucket: "communications",
    headline: "KOL post T+11min / GordonGekko",
    statement: "Identical CTA-wallet recipient. Copy fragment reuses 3 distinctive strings.",
    confidence: "high",
    sources: [
      { kind: "capture", label: "X post", ref: "cap-gg-042", retrievedAt: "2026-04-13T09:03:00Z" },
    ],
    capturedAt: "2026-04-13T09:03:00Z",
    hash: "sha256:bd2c55aa91e02e00",
    editorialStandard: "Forensic Editorial v2",
  },
  {
    id: "ev-kol-post-3",
    bucket: "communications",
    headline: "KOL post T+47min / Planted",
    statement: "Smaller reach; same recipient address; post deleted after 6h.",
    confidence: "medium",
    sources: [
      { kind: "capture", label: "X post", ref: "cap-pl-042", retrievedAt: "2026-04-13T09:05:00Z" },
    ],
    capturedAt: "2026-04-13T09:05:00Z",
    hash: "sha256:5a99cc12ef0003",
    editorialStandard: "Forensic Editorial v2",
  },
  {
    id: "ev-timeline",
    bucket: "timeline",
    headline: "36h cashout arc from peak price",
    statement: "Aggregated exit volume crosses 80% within 36h window T+36h to T+72h after price peak.",
    confidence: "high",
    sources: [
      { kind: "oracle", label: "price series", ref: "oracle-bx", retrievedAt: "2026-04-18T22:06:00Z" },
    ],
    capturedAt: "2026-04-18T22:06:00Z",
    hash: "sha256:771d3bb9ac01ef0022",
    editorialStandard: "Forensic Editorial v2",
  },
];

function densify(claims: EvidenceClaim[]): EvidenceBundle["density"] {
  const byConfidence = { low: 0, medium: 0, high: 0, certified: 0 };
  for (const c of claims) byConfidence[c.confidence]++;
  return { total: claims.length, byConfidence };
}

export const EVIDENCE_VINE: EvidenceBundle = {
  id: "vine",
  subjectRef: { kind: "scan", id: "vine" },
  groups: [
    { bucket: "on_chain", claims: CLAIMS.filter((c) => c.bucket === "on_chain") },
    { bucket: "communications", claims: CLAIMS.filter((c) => c.bucket === "communications") },
    { bucket: "timeline", claims: CLAIMS.filter((c) => c.bucket === "timeline") },
  ],
  density: densify(CLAIMS),
};

export const EVIDENCE_BY_ID: Record<string, EvidenceBundle> = {
  vine: EVIDENCE_VINE,
};
