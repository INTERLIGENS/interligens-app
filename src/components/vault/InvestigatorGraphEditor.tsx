"use client";

/**
 * InvestigatorGraphEditor — interactive D3 force-graph editor that replaces
 * the raw JSON textarea. Single surface, investigator-grade:
 *
 *   - drag / zoom / pan
 *   - click a node to select → Delete key removes it
 *   - "Add node" form (group + label + optional handle/address)
 *   - click one node then another with "Connect" mode active → creates
 *     an edge with tier="suspected"
 *   - AUTO / MANUAL toggle: when AUTO is on and the added node is a wallet
 *     / handle / domain, we POST /orchestrate and merge any returned
 *     cards + suggestions back into the graph
 *   - "Save" serialises back to the encrypted payload blob used by
 *     /api/investigators/graphs/[id]
 *
 * Style matches existing /graphs/[id] page: #0a0a0a / #FF6B00 / white.
 * No emojis in the UI per project instructions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  GROUP_VALUES,
  TIER_VALUES,
  type EvidenceTier,
  type NetworkEdge,
  type NetworkGraph,
  type NetworkNode,
  type NodeGroup,
} from "@/lib/network/schema";

const ACCENT = "#FF6B00";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";
const DIM = "rgba(255,255,255,0.6)";
const SVG_HEIGHT = 640;
// Bumped on every ship of this component. If you don't see this tag in the
// control-bar, your browser is serving a stale bundle — hard-reload.
const EDITOR_BUILD = "v4";

const GROUP_COLOR: Record<NodeGroup, string> = {
  person: "#ff4040",
  project: "#ff9630",
  token: "#ffd060",
  wallet: "#60a5fa",
  wallet_family: "#93c5fd",
  infra_cex: "#a78bfa",
  infra_service: "#c084fc",
  source: "#34d399",
  claim: "#f472b6",
  handle: "#fca5a5",
  contract: "#fbbf24",
  domain: "#67e8f9",
  transaction: "#f97316",
  pool: "#22d3ee",
  bridge: "#a3e635",
  mixer: "#dc2626",
  email: "#fb7185",
  evidence: "#facc15",
};

const GROUP_LABEL: Record<NodeGroup, string> = {
  person: "Person",
  project: "Project",
  token: "Token",
  wallet: "Wallet",
  wallet_family: "Wallet family",
  infra_cex: "CEX",
  infra_service: "Service",
  source: "Source",
  claim: "Claim",
  handle: "Handle",
  contract: "Contract",
  domain: "Domain",
  transaction: "Transaction",
  pool: "Pool",
  bridge: "Bridge",
  mixer: "Mixer",
  email: "Email",
  evidence: "Evidence",
};

const TIER_STROKE: Record<EvidenceTier, string> = {
  confirmed: "#d0d0d0",
  strong: "#b0b0b0",
  suspected: "#808080",
  alleged: "#555555",
};

const TIER_DASH: Record<EvidenceTier, string> = {
  confirmed: "",
  strong: "",
  suspected: "4 3",
  alleged: "2 4",
};

type SimNode = NetworkNode & d3.SimulationNodeDatum & { r: number };
type SimEdge = NetworkEdge & { source: SimNode | string; target: SimNode | string };

function nodeRadius(n: NetworkNode): number {
  if (n.group === "person" || n.group === "project") return 12;
  if (n.group === "token") return 10;
  return 8;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

type OrchestrateSuggestion = {
  type: string;
  value: string;
  label?: string | null;
  reason: string;
};

type OrchestrateCard = {
  title: string;
  sourceModule: string;
  severity: string;
  summary: string;
};

type OrchestrateResult = {
  success: boolean;
  eventsCreated: number;
  uiReaction?: {
    cards?: OrchestrateCard[];
    suggestions?: OrchestrateSuggestion[];
  } | null;
};

export type GraphEditorHandle = {
  getGraph: () => NetworkGraph;
};

type Props = {
  initialGraph: NetworkGraph;
  onDirtyChange?: (dirty: boolean) => void;
  onRequestExport?: () => void;
  onGraphChanged?: (graph: NetworkGraph) => void;
};

export default function InvestigatorGraphEditor({
  initialGraph,
  onDirtyChange,
  onGraphChanged,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>(initialGraph.nodes);
  const [edges, setEdges] = useState<NetworkEdge[]>(initialGraph.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  const [orchestrating, setOrchestrating] = useState(false);

  // Add-node form — UNCONTROLLED inputs backed by refs. We deliberately
  // bypass useState here because Next.js 16 + React 19 + the React
  // Compiler has been observed to serve stale closures for `onClick`
  // handlers in this exact component, causing `addNode()` to read an
  // empty `newLabel` even when the DOM shows a filled field. Reading the
  // raw DOM value via `ref.current.value` is immune to that.
  const labelInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const groupSelectRef = useRef<HTMLSelectElement>(null);
  const tierSelectRef = useRef<HTMLSelectElement>(null);
  // Tiny render-trigger state so the button disabled-state & hint text
  // reflect the typed value without needing a full controlled-input pair.
  const [, forceRerender] = useState(0);
  const markFormChanged = () => forceRerender((n) => n + 1);
  const currentLabel = () => (labelInputRef.current?.value ?? "").trim();
  const currentValue = () => (valueInputRef.current?.value ?? "").trim();
  const currentGroup = (): NodeGroup =>
    (groupSelectRef.current?.value as NodeGroup) ?? "wallet";
  const currentTier = (): EvidenceTier =>
    (tierSelectRef.current?.value as EvidenceTier) ?? "suspected";

  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const dirtyRef = useRef(false);

  // Notify parent on dirty or graph-change events.
  const notifyDirty = useCallback(
    (dirty: boolean) => {
      if (dirtyRef.current !== dirty) {
        dirtyRef.current = dirty;
        onDirtyChange?.(dirty);
      }
    },
    [onDirtyChange]
  );

  useEffect(() => {
    onGraphChanged?.({
      ...initialGraph,
      nodes,
      edges,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ── D3 simulation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const width = svgRef.current.clientWidth || 800;
    const height = SVG_HEIGHT;

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n, r: nodeRadius(n) }));
    const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const root = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (ev) => root.attr("transform", ev.transform.toString()));
    svg.call(zoom);

    svg.on("click", (ev) => {
      if (ev.target === svgRef.current) {
        setSelectedId(null);
        setConnectFrom(null);
      }
    });

    const linkSel = root
      .append("g")
      .selectAll<SVGLineElement, SimEdge>("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d) => TIER_STROKE[d.tier])
      .attr("stroke-width", 1.4)
      .attr("stroke-dasharray", (d) => TIER_DASH[d.tier])
      .attr("stroke-opacity", 0.7);
    linkSel
      .append("title")
      .text((d) => `${d.type}${d.label ? `: ${d.label}` : ""} [${d.tier}]`);

    const nodeG = root
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        if (connectFrom && connectFrom !== d.id) {
          // Complete the edge.
          setEdges((prev) => {
            const exists = prev.some(
              (e) =>
                (e.source === connectFrom && e.target === d.id) ||
                (e.source === d.id && e.target === connectFrom)
            );
            if (exists) return prev;
            return [
              ...prev,
              {
                source: connectFrom,
                target: d.id,
                type: "linked",
                tier: "suspected",
              },
            ];
          });
          setConnectFrom(null);
          notifyDirty(true);
          return;
        }
        setSelectedId(d.id);
      });

    nodeG
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) =>
        d.id === selectedId || d.id === connectFrom ? ACCENT : "#000"
      )
      .attr("stroke-width", (d) =>
        d.id === selectedId || d.id === connectFrom ? 2.5 : 1.5
      );

    nodeG
      .append("text")
      .attr("dx", (d) => d.r + 4)
      .attr("dy", 4)
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .attr("pointer-events", "none")
      .attr("paint-order", "stroke")
      .attr("stroke", "#000")
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.75)
      .text((d) => d.label);

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (ev, d) => {
        if (!ev.active) simRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (ev, d) => {
        d.fx = ev.x;
        d.fy = ev.y;
      })
      .on("end", (ev, d) => {
        if (!ev.active) simRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeG.call(drag);

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(90)
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d.r + 4));
    simRef.current = simulation;

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, selectedId, connectFrom, notifyDirty]);

  // ── Keyboard: Delete removes the selected node + its edges ───────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        e.preventDefault();
        setNodes((prev) => prev.filter((n) => n.id !== selectedId));
        setEdges((prev) =>
          prev.filter(
            (ed) => ed.source !== selectedId && ed.target !== selectedId
          )
        );
        setSelectedId(null);
        notifyDirty(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, notifyDirty]);

  // ── AUTO-populate via orchestrator ──────────────────────────────────
  const mapTypeToGroup = useCallback((type: string): NodeGroup => {
    const up = type.toUpperCase();
    if (up === "WALLET") return "wallet";
    if (up === "CONTRACT") return "token";
    if (up === "HANDLE" || up === "ALIAS" || up === "EMAIL") return "person";
    if (up === "URL" || up === "DOMAIN") return "infra_service";
    return "claim";
  }, []);

  const runOrchestrator = useCallback(
    async (anchorId: string, leadType: string, leadValue: string) => {
      if (!autoMode) return;
      setOrchestrating(true);
      try {
        // Graphs are workspace-scoped → call the dedicated workspace
        // lookup endpoint (same cards + suggestions shape, no case required).
        const r = await fetch(`/api/investigators/lookup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: leadType, value: leadValue }),
        });
        if (!r.ok) return;
        const data = (await r.json()) as OrchestrateResult;
        const suggestions = data.uiReaction?.suggestions ?? [];
        const cards = data.uiReaction?.cards ?? [];

        const newNodes: NetworkNode[] = [];
        const newEdges: NetworkEdge[] = [];

        // Each card becomes a claim node linked to the anchor lead.
        for (const c of cards.slice(0, 6)) {
          const id = uid("card");
          newNodes.push({
            id,
            group: "claim",
            tier:
              c.severity === "HIGH" || c.severity === "CRITICAL"
                ? "strong"
                : c.severity === "MEDIUM"
                  ? "suspected"
                  : "alleged",
            label: `${c.sourceModule.replace("_", " ")}: ${truncate(c.title, 40)}`,
            notes: c.summary,
          });
          newEdges.push({
            source: anchorId,
            target: id,
            type: "intel_hit",
            label: c.sourceModule,
            tier: "suspected",
          });
        }

        // Each suggested entity becomes a node of the right group.
        for (const s of suggestions.slice(0, 8)) {
          const id = uid("sug");
          newNodes.push({
            id,
            group: mapTypeToGroup(s.type),
            tier: "alleged",
            label: s.label ?? truncate(s.value, 24),
            handle: s.type === "HANDLE" ? s.value : undefined,
            address:
              s.type === "WALLET" || s.type === "CONTRACT"
                ? s.value
                : undefined,
          });
          newEdges.push({
            source: anchorId,
            target: id,
            type: s.reason,
            tier: "suspected",
          });
        }

        if (newNodes.length > 0 || newEdges.length > 0) {
          setNodes((prev) => [...prev, ...newNodes]);
          setEdges((prev) => [...prev, ...newEdges]);
          notifyDirty(true);
        }
      } finally {
        setOrchestrating(false);
      }
    },
    [autoMode, mapTypeToGroup, notifyDirty]
  );

  const [lastAdded, setLastAdded] = useState<{ id: string; at: number } | null>(null);

  function addNode() {
    // Read live DOM values — refs, not state — so we never read a stale
    // closure over useState. This is the investigator-grade fix for the
    // "button does nothing" symptom when the DOM clearly shows content.
    const label = currentLabel();
    const val = currentValue() || undefined;
    const group = currentGroup();
    const tier = currentTier();

    console.log("[graph-editor] addNode() invoked", {
      label,
      value: val ?? null,
      group,
      tier,
      labelRefSeen: labelInputRef.current?.value,
      valueRefSeen: valueInputRef.current?.value,
    });

    if (!label) {
      console.warn("[graph-editor] Add node: label empty — ignoring");
      return;
    }
    const id = uid(group);
    const isWalletGroup =
      group === "wallet" || group === "wallet_family" || group === "contract";
    const isHandleGroup = group === "person" || group === "handle";
    const node: NetworkNode = {
      id,
      group,
      tier,
      label,
      handle: isHandleGroup ? val : undefined,
      address:
        isWalletGroup || group === "token" ? val : undefined,
    };

    // Explicit initial x/y so the node is visible immediately — before
    // the force simulation has a chance to tick.
    const svg = svgRef.current;
    const width = svg?.clientWidth ?? 800;
    const height = SVG_HEIGHT;
    const nodeWithPos = node as NetworkNode & { x?: number; y?: number };
    nodeWithPos.x = width / 2 + (Math.random() - 0.5) * 80;
    nodeWithPos.y = height / 2 + (Math.random() - 0.5) * 80;

    setNodes((prev) => [...prev, node]);
    setSelectedId(id);
    // Clear the UNCONTROLLED inputs by touching their DOM values.
    if (labelInputRef.current) labelInputRef.current.value = "";
    if (valueInputRef.current) valueInputRef.current.value = "";
    notifyDirty(true);
    setLastAdded({ id, at: Date.now() });
    markFormChanged();

    simRef.current?.alpha(0.8).restart();

    const leadType =
      isWalletGroup
        ? group === "contract"
          ? "CONTRACT"
          : "WALLET"
        : group === "token"
          ? "CONTRACT"
          : isHandleGroup
            ? "HANDLE"
            : group === "domain" || group === "infra_service"
              ? "DOMAIN"
              : null;
    if (autoMode && val && leadType) {
      runOrchestrator(id, leadType, val);
    }
  }

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Control bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          padding: 12,
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          background: SURFACE,
        }}
      >
        <button
          type="button"
          onClick={() => setAutoMode((v) => !v)}
          aria-pressed={autoMode}
          title={
            autoMode
              ? "Orchestrator fires on every add — intelligence fills the graph automatically"
              : "Manual-first — you build the graph node by node"
          }
          style={{
            fontSize: 11,
            padding: "6px 12px",
            border: autoMode
              ? `1px solid ${ACCENT}`
              : `1px solid ${LINE}`,
            background: autoMode ? "rgba(255,107,0,0.12)" : "transparent",
            color: autoMode ? ACCENT : "rgba(255,255,255,0.7)",
            borderRadius: 4,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {autoMode ? "Auto-populate ON" : "Manual build"}
        </button>

        <button
          type="button"
          onClick={() => setConnectFrom(selectedId)}
          disabled={!selectedId}
          title="Select a node, press this, then click another node to link them"
          style={{
            fontSize: 11,
            padding: "6px 12px",
            border: `1px solid ${LINE}`,
            background: connectFrom ? "rgba(255,107,0,0.12)" : "transparent",
            color: connectFrom ? ACCENT : "rgba(255,255,255,0.7)",
            borderRadius: 4,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: selectedId ? "pointer" : "not-allowed",
            opacity: selectedId ? 1 : 0.4,
          }}
        >
          {connectFrom ? "Pick target node…" : "Connect selected →"}
        </button>

        <span style={{ color: DIM, fontSize: 11 }}>
          {nodes.length} nodes · {edges.length} edges
          {orchestrating && " · intelligence running…"}
        </span>
        <span
          aria-label="Editor build"
          title="If this doesn't match the latest deploy, hard-reload (Cmd+Shift+R)."
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "ui-monospace, monospace",
            border: `1px solid ${LINE}`,
            padding: "2px 6px",
            borderRadius: 10,
          }}
        >
          editor {EDITOR_BUILD}
        </span>
        {lastAdded && Date.now() - lastAdded.at < 4000 && (
          <span
            role="status"
            style={{
              marginLeft: "auto",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: ACCENT,
              border: `1px solid rgba(255,107,0,0.4)`,
              borderRadius: 10,
              padding: "3px 10px",
              background: "rgba(255,107,0,0.12)",
            }}
          >
            Node added
          </span>
        )}
      </div>

      {/* Add-node form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
          padding: 12,
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          background: SURFACE,
        }}
      >
        <select
          aria-label="Node type"
          ref={groupSelectRef}
          defaultValue="wallet"
          style={inputStyle}
        >
          {GROUP_VALUES.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g]}
            </option>
          ))}
        </select>
        <input
          aria-label="Node label"
          placeholder="Label (e.g. bkokoski)"
          ref={labelInputRef}
          defaultValue=""
          onInput={markFormChanged}
          onKeyDown={(e) => {
            if (e.key === "Enter") addNode();
          }}
          style={inputStyle}
        />
        <input
          aria-label="Identifier (handle / address / domain)"
          placeholder="Handle, wallet address, domain…"
          ref={valueInputRef}
          defaultValue=""
          onKeyDown={(e) => {
            if (e.key === "Enter") addNode();
          }}
          style={inputStyle}
        />
        <select
          aria-label="Evidence tier"
          ref={tierSelectRef}
          defaultValue="suspected"
          style={inputStyle}
        >
          {TIER_VALUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addNode}
          style={{
            fontSize: 12,
            padding: "8px 14px",
            background: ACCENT,
            border: "none",
            color: "#fff",
            borderRadius: 4,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add node
        </button>
      </div>

      {/* Canvas + inspector */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 3fr) minmax(220px, 1fr)",
          gap: 16,
        }}
      >
        <svg
          ref={svgRef}
          style={{
            width: "100%",
            height: SVG_HEIGHT,
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            background: "#060606",
          }}
        />

        <aside
          style={{
            padding: 14,
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            background: SURFACE,
            fontSize: 12,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {selected ? (
            <>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: ACCENT,
                  marginBottom: 8,
                }}
              >
                {GROUP_LABEL[selected.group]} · {selected.tier}
              </div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}
              >
                {selected.label}
              </div>
              {selected.handle && (
                <div style={{ marginBottom: 4 }}>@{selected.handle}</div>
              )}
              {selected.address && (
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    wordBreak: "break-all",
                    color: DIM,
                    marginBottom: 6,
                  }}
                >
                  {selected.address}
                </div>
              )}
              {selected.notes && (
                <div style={{ color: DIM, lineHeight: 1.5 }}>
                  {selected.notes}
                </div>
              )}
              <div style={{ fontSize: 10, color: DIM, marginTop: 14 }}>
                Select another node then press <em>Connect</em> to link · Delete
                key removes this node.
              </div>
            </>
          ) : (
            <div style={{ color: DIM, lineHeight: 1.6 }}>
              Click a node to inspect it. Drag to reposition. Use the form
              above to add wallets, handles, projects, tokens or services.
              {autoMode
                ? " With Auto-populate ON, adding a wallet or handle also fires the orchestrator and merges hits into the graph."
                : " Manual mode — nothing will auto-populate. You drive."}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#060606",
  border: `1px solid ${LINE}`,
  borderRadius: 4,
  padding: "8px 10px",
  color: "#fff",
  fontSize: 12,
  outline: "none",
  fontFamily: "inherit",
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
