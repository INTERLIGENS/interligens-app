"use client";

import { useMemo } from "react";
import EditableGraph from "@/components/network/EditableGraph";
import type {
  NetworkGraph,
  NetworkNode,
  NetworkEdge,
  NodeGroup,
} from "@/lib/network/schema";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  confidence: number | null;
  extractionMethod: string | null;
  sourceFileId: string | null;
};

type EntityEnrichment = {
  inKolRegistry: boolean;
  kolName: string | null;
  isKnownBad: boolean;
  inWatchlist: boolean;
  inIntelVault: boolean;
};

type Props = {
  entities: Entity[];
  enrichment?: Record<string, EntityEnrichment>;
  investigatorHandle?: string;
};

function entityTypeToGroup(type: string): NodeGroup {
  switch (type.toUpperCase()) {
    case "WALLET":
      return "wallet";
    case "TX_HASH":
      return "transaction";
    case "HANDLE":
      return "handle";
    case "CONTRACT":
      return "contract";
    case "DOMAIN":
    case "URL":
      return "domain";
    case "EMAIL":
      return "email";
    default:
      return "evidence";
  }
}

function buildCaseGraph(
  entities: Entity[],
  enrichment?: Record<string, EntityEnrichment>,
): NetworkGraph {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const seenEdge = new Set<string>();

  const fileIds = new Set<string>();

  for (const e of entities) {
    const enr = enrichment?.[e.id];
    const node: NetworkNode = {
      id: e.id,
      group: entityTypeToGroup(e.type),
      label: e.label ?? e.value,
      tier: enr?.isKnownBad ? "confirmed" : "suspected",
    };
    if (e.type.toUpperCase() === "WALLET") node.address = e.value;
    nodes.push(node);
    if (e.sourceFileId) fileIds.add(e.sourceFileId);
  }

  for (const fid of fileIds) {
    nodes.push({
      id: `file:${fid}`,
      group: "source",
      label: `file ${fid.slice(0, 8)}`,
      tier: "suspected",
    });
  }

  function addEdge(
    source: string,
    target: string,
    type: string,
    label: string | undefined,
    tier: NetworkEdge["tier"],
  ): void {
    const a = source < target ? source : target;
    const b = source < target ? target : source;
    const key = `${a}|${b}|${type}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    const e: NetworkEdge = { source, target, type, tier };
    if (label) e.label = label;
    edges.push(e);
  }

  for (const e of entities) {
    if (e.sourceFileId) {
      addEdge(e.id, `file:${e.sourceFileId}`, "extracted_from", "from file", "suspected");
    }
  }

  if (enrichment) {
    const kolGroups: Record<string, string[]> = {};
    for (const e of entities) {
      const enr = enrichment[e.id];
      if (enr?.inKolRegistry && enr.kolName) {
        const k = enr.kolName.toLowerCase();
        (kolGroups[k] ??= []).push(e.id);
      }
    }
    for (const [kol, ids] of Object.entries(kolGroups)) {
      for (let i = 0; i < ids.length - 1; i++) {
        addEdge(ids[i], ids[i + 1], "same_kol", `Same KOL · ${kol}`, "strong");
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: "case-entities",
    evidenceTiers: {
      confirmed: "Cryptographic or on-chain proof",
      strong: "Multiple converging sources",
      suspected: "Pattern-based",
      alleged: "Single-source claim",
    },
    nodes,
    edges,
  };
}

export default function CaseGraphPremium({
  entities,
  enrichment,
  investigatorHandle = "investigator",
}: Props) {
  const data = useMemo(
    () => buildCaseGraph(entities, enrichment),
    [entities, enrichment],
  );

  if (entities.length < 2) {
    return (
      <div
        className="text-white/40 text-sm"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          padding: 40,
          textAlign: "center",
        }}
      >
        Add at least 2 entities to see the graph.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 6,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <EditableGraph
        data={data}
        fullViewport={false}
        focusOnMount={null}
        investigatorHandle={investigatorHandle}
      />
    </div>
  );
}
