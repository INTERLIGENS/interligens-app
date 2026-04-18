// Hand-rolled validator for the static scam-universe graph payload. We keep
// it dependency-free because adding zod/valibot for one file is not worth
// the install footprint. If more graph payloads land later, reconsider.
//
// Shared between src/data/scamUniverse.json and the GET handler at
// /api/investigators/network-graph — both funnel through parseNetworkGraph
// so drift between shipped data and client expectations throws at load.

export const TIER_VALUES = ["confirmed", "strong", "suspected", "alleged"] as const;
export const GROUP_VALUES = [
  // Legacy core set — must stay first, committed scam-universe data
  // payload references these keys by exact string.
  "person",
  "project",
  "token",
  "wallet",
  "wallet_family",
  "infra_cex",
  "infra_service",
  "source",
  "claim",
  // Investigator-grade additions (2026-04-18). Additive only — old graphs
  // that don't use these keep working.
  "handle",
  "contract",
  "domain",
  "transaction",
  "pool",
  "bridge",
  "mixer",
  "email",
  "evidence",
] as const;

export type EvidenceTier = (typeof TIER_VALUES)[number];
export type NodeGroup = (typeof GROUP_VALUES)[number];

export type NetworkNode = {
  id: string;
  group: NodeGroup;
  label: string;
  tier: EvidenceTier;
  handle?: string;
  risk?: string;
  confidence?: string;
  rugCount?: number;
  totalScammedUsd?: number;
  chain?: string;
  address?: string;
  status?: string;
  role?: string;
  notes?: string;
  memberResolutionMatrix?: Record<string, string[]>;
};

export type NetworkEdge = {
  source: string;
  target: string;
  type: string;
  label?: string;
  tier: EvidenceTier;
};

export type NetworkTimelineEvent = {
  date: string;
  event: string;
  tier: EvidenceTier;
};

export type NetworkGraph = {
  generatedAt: string;
  sourceOfTruth: string;
  evidenceTiers: Record<string, string>;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metrics?: Record<string, unknown>;
  timeline?: NetworkTimelineEvent[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isTier(v: unknown): v is EvidenceTier {
  return typeof v === "string" && (TIER_VALUES as readonly string[]).includes(v);
}

function isGroup(v: unknown): v is NodeGroup {
  return typeof v === "string" && (GROUP_VALUES as readonly string[]).includes(v);
}

export class NetworkGraphParseError extends Error {
  constructor(path: string, detail: string) {
    super(`NetworkGraph parse error at ${path}: ${detail}`);
    this.name = "NetworkGraphParseError";
  }
}

function parseNode(raw: unknown, i: number): NetworkNode {
  const at = `nodes[${i}]`;
  if (!isRecord(raw)) throw new NetworkGraphParseError(at, "not an object");
  if (typeof raw.id !== "string" || raw.id.length === 0)
    throw new NetworkGraphParseError(at, "id must be a non-empty string");
  if (!isGroup(raw.group))
    throw new NetworkGraphParseError(at, `group="${String(raw.group)}" not in ${GROUP_VALUES.join("|")}`);
  if (typeof raw.label !== "string" || raw.label.length === 0)
    throw new NetworkGraphParseError(at, "label must be a non-empty string");
  if (!isTier(raw.tier))
    throw new NetworkGraphParseError(at, `tier="${String(raw.tier)}" not in ${TIER_VALUES.join("|")}`);

  const node: NetworkNode = {
    id: raw.id,
    group: raw.group,
    label: raw.label,
    tier: raw.tier,
  };
  if (typeof raw.handle === "string") node.handle = raw.handle;
  if (typeof raw.risk === "string") node.risk = raw.risk;
  if (typeof raw.confidence === "string") node.confidence = raw.confidence;
  if (typeof raw.rugCount === "number") node.rugCount = raw.rugCount;
  if (typeof raw.totalScammedUsd === "number") node.totalScammedUsd = raw.totalScammedUsd;
  if (typeof raw.chain === "string") node.chain = raw.chain;
  if (typeof raw.address === "string") node.address = raw.address;
  if (typeof raw.status === "string") node.status = raw.status;
  if (typeof raw.role === "string") node.role = raw.role;
  if (typeof raw.notes === "string") node.notes = raw.notes;
  if (isRecord(raw.memberResolutionMatrix)) {
    const mrm: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw.memberResolutionMatrix)) {
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
        mrm[k] = v as string[];
      }
    }
    node.memberResolutionMatrix = mrm;
  }
  return node;
}

function parseEdge(raw: unknown, i: number): NetworkEdge {
  const at = `edges[${i}]`;
  if (!isRecord(raw)) throw new NetworkGraphParseError(at, "not an object");
  if (typeof raw.source !== "string" || raw.source.length === 0)
    throw new NetworkGraphParseError(at, "source must be a non-empty string");
  if (typeof raw.target !== "string" || raw.target.length === 0)
    throw new NetworkGraphParseError(at, "target must be a non-empty string");
  if (typeof raw.type !== "string" || raw.type.length === 0)
    throw new NetworkGraphParseError(at, "type must be a non-empty string");
  if (!isTier(raw.tier))
    throw new NetworkGraphParseError(at, `tier="${String(raw.tier)}" not in ${TIER_VALUES.join("|")}`);
  const e: NetworkEdge = {
    source: raw.source,
    target: raw.target,
    type: raw.type,
    tier: raw.tier,
  };
  if (typeof raw.label === "string") e.label = raw.label;
  return e;
}

function parseTimelineEvent(raw: unknown, i: number): NetworkTimelineEvent {
  const at = `timeline[${i}]`;
  if (!isRecord(raw)) throw new NetworkGraphParseError(at, "not an object");
  if (typeof raw.date !== "string") throw new NetworkGraphParseError(at, "date must be a string");
  if (typeof raw.event !== "string") throw new NetworkGraphParseError(at, "event must be a string");
  if (!isTier(raw.tier)) throw new NetworkGraphParseError(at, "tier invalid");
  return { date: raw.date, event: raw.event, tier: raw.tier };
}

export function parseNetworkGraph(raw: unknown): NetworkGraph {
  if (!isRecord(raw)) throw new NetworkGraphParseError("$", "root must be an object");
  if (typeof raw.generatedAt !== "string")
    throw new NetworkGraphParseError("$.generatedAt", "must be a string");
  if (typeof raw.sourceOfTruth !== "string")
    throw new NetworkGraphParseError("$.sourceOfTruth", "must be a string");
  if (!isRecord(raw.evidenceTiers))
    throw new NetworkGraphParseError("$.evidenceTiers", "must be an object");
  for (const [k, v] of Object.entries(raw.evidenceTiers)) {
    if (typeof v !== "string")
      throw new NetworkGraphParseError(`$.evidenceTiers.${k}`, "must be a string");
  }
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0)
    throw new NetworkGraphParseError("$.nodes", "must be a non-empty array");
  if (!Array.isArray(raw.edges))
    throw new NetworkGraphParseError("$.edges", "must be an array");

  const nodes = raw.nodes.map(parseNode);
  const edges = raw.edges.map(parseEdge);

  const graph: NetworkGraph = {
    generatedAt: raw.generatedAt,
    sourceOfTruth: raw.sourceOfTruth,
    evidenceTiers: raw.evidenceTiers as Record<string, string>,
    nodes,
    edges,
  };
  if (isRecord(raw.metrics)) graph.metrics = raw.metrics;
  if (Array.isArray(raw.timeline)) graph.timeline = raw.timeline.map(parseTimelineEvent);
  return graph;
}
