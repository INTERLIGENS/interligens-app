"use client";

/**
 * EditableGraph — investigator-grade D3 network graph with an optional edit
 * mode, unified from two prior components:
 *
 *   • ScamUniverseGraph (/investigators/box/network) — the read-only view
 *     the investigators loved: 240 | 1fr | 320 full-viewport layout,
 *     group/tier filter pills, radial-around-selection mode, watermarked
 *     PNG export, auto-focus.
 *   • InvestigatorGraphEditor (old /graphs/[id] editor) — editable: add
 *     nodes via form, connect mode, delete key, double-click rotation,
 *     auto-populate via /api/investigators/lookup.
 *
 * One component, two modes (`editable` prop). The read-only path stays
 * byte-compatible with the scam-universe page; the editable path is what
 * /investigators/box/graphs/[id] now renders.
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
import {
  ACCENT,
  GROUP_COLOR,
  GROUP_LABEL,
  TIER_DASH,
  TIER_LABEL,
  TIER_OPACITY,
  TIER_STROKE,
  TIER_WIDTH,
  estimatedLabelWidth,
  formatNodeLabel,
  isMonoGroup,
  labelFont,
  labelSize,
} from "@/styles/graph-tokens";

// ── Sidebar CSS ──────────────────────────────────────────────────────
// Scoped by `.graph-sidebar` so it can't leak to other pages. Duplicated
// verbatim from ScamUniverseGraph on purpose — no dedup refactor during
// the Constellation visual upgrade.
const SIDEBAR_CSS = `
.graph-sidebar {
  background: #0b0b0b;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 12px;
  overflow-y: auto;
  font-size: 12px;
  color: #fff;
}
.graph-sidebar .graph-sidebar-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${ACCENT};
  margin: 0 0 8px;
}
.graph-sidebar .graph-sidebar-meta {
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 10px;
}
.graph-sidebar .graph-sidebar-search {
  width: 100%;
  height: 32px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 14px;
  outline: none;
  transition: border-color 120ms ease-out, box-shadow 120ms ease-out;
}
.graph-sidebar .graph-sidebar-search::placeholder {
  color: rgba(255,255,255,0.35);
}
.graph-sidebar .graph-sidebar-search:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 1px ${ACCENT};
}
.graph-sidebar .graph-chip-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 0 12px;
  margin-bottom: 4px;
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  color: rgba(255,255,255,0.72);
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease, color 160ms ease;
}
.graph-sidebar .graph-chip-btn:hover:not(:disabled) {
  background: rgba(255,107,0,0.08);
  border-color: rgba(255,107,0,0.35);
  box-shadow: 0 0 0 1px rgba(255,107,0,0.12) inset;
  color: #ffffff;
  transform: translateX(1px);
}
.graph-sidebar .graph-chip-btn.is-active {
  color: #ffffff;
  background: rgba(255,107,0,0.12);
  border-color: rgba(255,107,0,0.55);
  box-shadow: 0 0 0 1px rgba(255,107,0,0.18) inset, 0 0 18px rgba(255,107,0,0.10);
}
.graph-sidebar .graph-chip-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.graph-sidebar .graph-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 8px;
  transition: box-shadow 160ms ease;
}
.graph-sidebar .graph-chip-btn.is-active .graph-chip-dot {
  box-shadow: 0 0 6px currentColor;
}
.graph-sidebar .graph-chip-dash {
  flex: 0 0 22px;
}
.graph-sidebar .graph-chip-label {
  flex: 1;
  font-size: 11px;
  letter-spacing: 0.01em;
}
.graph-sidebar .graph-chip-count {
  font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  min-width: 24px;
  text-align: right;
  transition: color 160ms ease;
}
.graph-sidebar .graph-chip-btn.is-active .graph-chip-count {
  color: ${ACCENT};
}
.graph-sidebar .graph-action-btn {
  display: block;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.78);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
}
.graph-sidebar .graph-action-btn:hover:not(:disabled) {
  background: rgba(255,107,0,0.07);
  border-color: rgba(255,107,0,0.32);
  color: #ffffff;
}
.graph-sidebar .graph-action-btn.primary {
  background: rgba(255,107,0,0.08);
  border-color: rgba(255,107,0,0.35);
  color: #ffffff;
  box-shadow: 0 0 0 1px rgba(255,107,0,0.12) inset;
}
.graph-sidebar .graph-action-btn.primary:hover:not(:disabled) {
  background: rgba(255,107,0,0.14);
  border-color: rgba(255,107,0,0.55);
  box-shadow: 0 0 0 1px rgba(255,107,0,0.22) inset, 0 0 18px rgba(255,107,0,0.12);
}
.graph-sidebar .graph-sidebar-note {
  margin-top: 16px;
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  line-height: 1.5;
}
.graph-sidebar .graph-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  min-height: 180px;
  color: rgba(255,255,255,0.5);
}
.graph-sidebar .graph-detail-empty-icon {
  opacity: 0.24;
  margin-bottom: 14px;
}
.graph-sidebar .graph-detail-empty-title {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  margin-bottom: 6px;
}
.graph-sidebar .graph-detail-empty-text {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  line-height: 1.5;
  max-width: 220px;
}
.graph-sidebar .graph-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.graph-sidebar .graph-detail-chip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 10px;
}
.graph-sidebar .graph-detail-name {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  word-break: break-word;
  flex: 1 1 auto;
  min-width: 0;
}
.graph-sidebar .graph-detail-type-badge {
  font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.02);
}
.graph-sidebar .graph-detail-tier-row {
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  margin-bottom: 10px;
}
.graph-sidebar .graph-detail-tiger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #000;
  margin: 8px 0 14px;
  border: 1px solid rgba(0,0,0,0.25);
}
.graph-sidebar .graph-detail-tiger.tiger-red { background: #ff4040; }
.graph-sidebar .graph-detail-tiger.tiger-orange { background: #ff9630; }
.graph-sidebar .graph-detail-tiger.tiger-green { background: #34d399; }
.graph-sidebar .graph-detail-breakdown {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.65);
  margin: 6px 0 10px;
}
.graph-sidebar .graph-detail-breakdown-chip {
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}
.graph-sidebar .graph-detail-connection {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  padding: 4px 0;
  cursor: pointer;
  transition: color 120ms ease-out;
}
.graph-sidebar .graph-detail-connection:hover {
  color: #fff;
}
.graph-sidebar .graph-detail-connection-dir {
  color: rgba(255,255,255,0.3);
  width: 10px;
  flex: 0 0 10px;
  font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}
.graph-sidebar .graph-detail-connection-other {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.graph-sidebar .graph-detail-connection-type {
  font-style: normal;
  color: rgba(255,255,255,0.35);
}
.graph-canvas-svg {
  cursor: grab;
}
.graph-canvas-svg:active {
  cursor: grabbing;
}
`;

// ── Types ────────────────────────────────────────────────────────────

type SimNode = d3.SimulationNodeDatum & NetworkNode & { r: number };
type SimEdge = d3.SimulationLinkDatum<SimNode> & NetworkEdge;

type LookupCard = {
  title: string;
  sourceModule: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
};
type LookupSuggestion = {
  type: string;
  value: string;
  label: string | null;
  reason: string;
};

// ── Helpers ──────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function edgeEndpoint(v: SimEdge["source"] | SimEdge["target"]): string {
  return typeof v === "string" ? v : (v as SimNode).id;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function mapLeadType(group: NodeGroup, val: string | undefined): string | null {
  if (!val) return null;
  if (group === "wallet" || group === "wallet_family") return "WALLET";
  if (group === "contract" || group === "token") return "CONTRACT";
  if (group === "person" || group === "handle") return "HANDLE";
  if (group === "domain" || group === "infra_service") return "DOMAIN";
  return null;
}

function mapTypeToGroup(type: string): NodeGroup {
  const up = type.toUpperCase();
  if (up === "WALLET") return "wallet";
  if (up === "CONTRACT") return "contract";
  if (up === "HANDLE" || up === "ALIAS" || up === "EMAIL") return "person";
  if (up === "URL" || up === "DOMAIN") return "domain";
  return "claim";
}

// ── Component ────────────────────────────────────────────────────────

type Props = {
  data: NetworkGraph;
  /** Investigator handle for watermarked PNG export. */
  investigatorHandle?: string;
  /** True → add/connect/delete/rotate/auto-populate UI is visible. */
  editable?: boolean;
  /**
   * When true (default), the graph fills the viewport (calc(100vh - 48px)).
   * When false, it uses a fixed 600px height — the old constrained mode.
   */
  fullViewport?: boolean;
  /** Focus this node id after the simulation settles. Default: "bkokoski". */
  focusOnMount?: string | null;
  /** Editable mode: parent gets a callback when nodes/edges change. */
  onGraphChanged?: (g: NetworkGraph) => void;
  /** Editable mode: parent gets a signal that the graph is dirty. */
  onDirtyChange?: (dirty: boolean) => void;

  // ── Editor chrome (embedded in the sidebar so the graph itself fills the
  // whole viewport with no extra chrome bar, matching /network). Only read
  // when `editable=true`.

  /** Graph title; rendered as an inline-editable heading in the sidebar. */
  title?: string;
  onTitleChange?: (next: string) => void;
  /** Save-state indicator. `dirty` triggers the accent Save button. */
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  /** Visibility badge + toggle. Only PRIVATE ↔ TEAM_POOL is self-service. */
  visibility?: "PRIVATE" | "TEAM_POOL" | "PUBLIC";
  onVisibilityChange?: (next: "PRIVATE" | "TEAM_POOL") => void;
  /** Delete the graph permanently. Shown as a subtle button at the sidebar bottom. */
  onDelete?: () => void;
  /** Back-link href for the sidebar (e.g. to the graphs list). */
  backHref?: string;
  backLabel?: string;
};

export default function EditableGraph({
  data,
  investigatorHandle = "investigator",
  editable = false,
  fullViewport = true,
  focusOnMount = "bkokoski",
  onGraphChanged,
  onDirtyChange,
  title,
  onTitleChange,
  dirty = false,
  saving = false,
  onSave,
  visibility,
  onVisibilityChange,
  onDelete,
  backHref,
  backLabel,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);

  // State — seeded from `data` on mount; editable mode mutates it.
  const [nodes, setNodes] = useState<NetworkNode[]>(data.nodes);
  const [edges, setEdges] = useState<NetworkEdge[]>(data.edges);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  const [orchestrating, setOrchestrating] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ id: string; at: number } | null>(null);

  const [activeGroups, setActiveGroups] = useState<Set<NodeGroup>>(
    () => new Set(GROUP_VALUES),
  );
  const [activeTiers, setActiveTiers] = useState<Set<EvidenceTier>>(
    () => new Set(TIER_VALUES),
  );
  const [query, setQuery] = useState("");
  const [radialMode, setRadialMode] = useState(false);

  const dirtyRef = useRef(false);
  const notifyDirty = useCallback(
    (dirty: boolean) => {
      if (dirtyRef.current !== dirty) {
        dirtyRef.current = dirty;
        onDirtyChange?.(dirty);
      }
    },
    [onDirtyChange],
  );

  // Emit the graph on any internal mutation. Only fires when the parent is
  // listening; avoids a churn when `editable=false`.
  useEffect(() => {
    if (!onGraphChanged) return;
    onGraphChanged({ ...data, nodes, edges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  // ── D3 mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const wrap = canvasWrapRef.current;
    const width = wrap?.clientWidth || 900;
    const height = wrap?.clientHeight || 600;

    // Degree centrality — drives radius scaling (6→22 px), border weight
    // (median threshold), and the top-3 hub halos. Recomputed on every
    // nodes/edges change so edits re-flow the hierarchy live.
    const degree: Record<string, number> = {};
    for (const e of edges) {
      degree[e.source] = (degree[e.source] ?? 0) + 1;
      degree[e.target] = (degree[e.target] ?? 0) + 1;
    }
    const degValues = nodes.map((n) => degree[n.id] ?? 0);
    const maxDeg = Math.max(1, ...degValues);
    const sortedDeg = [...degValues].sort((a, b) => a - b);
    const medianDeg = sortedDeg.length
      ? sortedDeg[Math.floor(sortedDeg.length / 2)]
      : 0;
    const hubsRanked = nodes
      .map((n) => ({ id: n.id, d: degree[n.id] ?? 0 }))
      .filter((x) => x.d > 0)
      .sort((a, b) => b.d - a.d)
      .slice(0, 3)
      .map((x) => x.id);
    const top3Hubs = new Set(hubsRanked);
    const topHubId = hubsRanked[0] ?? null;
    const secondaryHubs = new Set(hubsRanked.slice(1, 3));
    // Premium hub hierarchy: boost #1 by 12%, #2–#3 by 7%, leave the rest
    // of the graph untouched so peripheral node sizes don't drift.
    const radiusFor = (id: string) => {
      const base = 6 + Math.min(1, (degree[id] ?? 0) / maxDeg) * 16;
      if (id === topHubId) return base * 1.12;
      if (secondaryHubs.has(id)) return base * 1.07;
      return base;
    };

    const simNodes: SimNode[] = nodes.map((n) => {
      const base = { ...n, r: radiusFor(n.id) } as SimNode;
      const prev = n as NetworkNode & { x?: number; y?: number };
      if (prev.x != null) base.x = prev.x;
      if (prev.y != null) base.y = prev.y;
      return base;
    });
    const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));
    nodesRef.current = simNodes;
    edgesRef.current = simEdges;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const root = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (ev) => root.attr("transform", ev.transform.toString()));
    svg.call(zoom);
    zoomRef.current = zoom;

    svg.on("click", (ev) => {
      if (ev.target === svgRef.current) {
        setSelectedId(null);
        if (editable) setConnectFrom(null);
      }
    });

    // Double-click the empty canvas rotates the whole graph 90° around the
    // canvas centre. Core of the "monstrueux" feel — must stay.
    svg.on("dblclick.rotate", (ev) => {
      if (ev.target !== svgRef.current) return;
      ev.preventDefault();
      rotate(simNodes, width, height);
    });

    const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

    const linksG = root.append("g").attr("class", "links");
    const linkSel = linksG
      .selectAll<SVGLineElement, SimEdge>("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d) => TIER_STROKE[d.tier])
      .attr("stroke-width", (d) => TIER_WIDTH[d.tier])
      .attr("stroke-dasharray", (d) => TIER_DASH[d.tier] ?? null)
      .attr("stroke-opacity", (d) => TIER_OPACITY[d.tier])
      .style("filter", (d) => {
        if (d.tier !== "confirmed") return null;
        const src = nodeById.get(edgeEndpoint(d.source));
        const color = src ? GROUP_COLOR[src.group] : "#ffffff";
        return `drop-shadow(0 0 2px ${hexToRgba(color, 0.2)})`;
      })
      .on("mouseover", function () {
        d3.select(this).attr("stroke-opacity", 1);
      })
      .on("mouseout", function (_ev, d) {
        d3.select(this).attr("stroke-opacity", TIER_OPACITY[d.tier]);
      });
    linkSel
      .append("title")
      .text((d) => `${d.type}${d.label ? ": " + d.label : ""} [${d.tier}]`);

    // Directional arrowheads — 4 px triangle at 70% along each edge.
    const arrowSel = root
      .append("g")
      .attr("class", "arrows")
      .selectAll<SVGPolygonElement, SimEdge>("polygon")
      .data(simEdges)
      .join("polygon")
      .attr("points", "0,0 -4,-2 -4,2")
      .attr("fill", (d) => TIER_STROKE[d.tier])
      .attr("fill-opacity", (d) => TIER_OPACITY[d.tier])
      .attr("pointer-events", "none");

    const nodeG = root
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        // In editable mode + connect-from set: create an edge and exit.
        if (editable && connectFrom && connectFrom !== d.id) {
          setEdges((prev) => {
            const exists = prev.some(
              (e) =>
                (e.source === connectFrom && e.target === d.id) ||
                (e.source === d.id && e.target === connectFrom),
            );
            if (exists) return prev;
            return [
              ...prev,
              { source: connectFrom, target: d.id, type: "linked", tier: "suspected" },
            ];
          });
          setConnectFrom(null);
          notifyDirty(true);
          return;
        }
        setSelectedId(d.id);
      });

    // Halos for the top-3 hubs — rendered FIRST inside each node's <g> so
    // they sit behind the body circle. Opacities 16/9/5% give the hubs a
    // readable aura without pushing into "cosmic glow" territory.
    const haloSel = nodeG.filter((d) => top3Hubs.has(d.id));
    haloSel
      .append("circle")
      .attr("class", "halo halo-3")
      .attr("r", (d) => d.r * 1.8)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.05)
      .attr("pointer-events", "none");
    haloSel
      .append("circle")
      .attr("class", "halo halo-2")
      .attr("r", (d) => d.r * 1.4)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.09)
      .attr("pointer-events", "none");
    haloSel
      .append("circle")
      .attr("class", "halo halo-1")
      .attr("r", (d) => d.r * 1.1)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.16)
      .attr("pointer-events", "none");

    // Main body. Border width picks up the median-degree threshold so hubs
    // read heavier at a glance. Drop shadow lifts the node off the canvas.
    // Connect-from target keeps the original orange border cue (editor UX).
    nodeG
      .append("circle")
      .attr("class", "node-body")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) => (d.id === connectFrom ? ACCENT : "#000"))
      .attr("stroke-width", (d) => {
        if (d.id === connectFrom) return 3;
        return (degree[d.id] ?? 0) > medianDeg ? 2 : 1;
      })
      .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.8))");

    // Selected: double ring #FF6B00 (inner 2px, 1px gap, outer 1px).
    const selRing = nodeG.filter((d) => d.id === selectedId);
    selRing
      .append("circle")
      .attr("class", "sel-ring-inner")
      .attr("r", (d) => d.r + 1)
      .attr("fill", "none")
      .attr("stroke", ACCENT)
      .attr("stroke-width", 2)
      .attr("pointer-events", "none");
    selRing
      .append("circle")
      .attr("class", "sel-ring-outer")
      .attr("r", (d) => d.r + 3.5)
      .attr("fill", "none")
      .attr("stroke", ACCENT)
      .attr("stroke-width", 1)
      .attr("pointer-events", "none");

    // Hover: ring expansion +2px on the body only (halos/selection rings
    // stay put). 80ms ease-out per spec.
    nodeG
      .on("mouseenter.hover", function (_ev, d) {
        d3.select(this)
          .select<SVGCircleElement>("circle.node-body")
          .transition()
          .duration(80)
          .ease(d3.easeCubicOut)
          .attr("r", d.r + 2);
      })
      .on("mouseleave.hover", function (_ev, d) {
        d3.select(this)
          .select<SVGCircleElement>("circle.node-body")
          .transition()
          .duration(80)
          .ease(d3.easeCubicOut)
          .attr("r", d.r);
      });

    // Flat floating labels — no pill, no border, no background. The
    // typography hierarchy (12/11/10 px + Inter/JetBrains-Mono split)
    // carries the read; a stroked text-shadow keeps legibility over edges
    // that pass behind.
    nodeG
      .append("text")
      .attr("class", "label-text")
      .attr("dx", (d) => d.r + 5)
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => labelSize(d.id, degree, top3Hubs))
      .attr("font-family", (d) => labelFont(d.group))
      .attr("font-weight", 500)
      .attr("fill", (d) => {
        if (top3Hubs.has(d.id)) return "#FFFFFF";
        return (degree[d.id] ?? 0) === 0
          ? "rgba(255,255,255,0.7)"
          : "rgba(255,255,255,0.85)";
      })
      .attr("pointer-events", "none")
      .attr("paint-order", "stroke")
      .attr("stroke", "#000000")
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.9)
      .attr("stroke-linejoin", "round")
      .text((d) => formatNodeLabel(d));

    // Pre-compute estimated label boxes for the anti-collision force.
    const labelDims = new Map<string, { w: number; h: number }>();
    for (const n of simNodes) {
      const sz = labelSize(n.id, degree, top3Hubs);
      const text = formatNodeLabel(n);
      const w = estimatedLabelWidth(text, sz, isMonoGroup(n.group));
      const h = sz;
      labelDims.set(n.id, { w, h });
    }

    const labelAntiCollide: d3.Force<SimNode, SimEdge> = (alpha) => {
      const strength = alpha * 0.6;
      for (let i = 0; i < simNodes.length; i++) {
        const a = simNodes[i];
        const aDim = labelDims.get(a.id);
        if (!aDim) continue;
        const ax = (a.x ?? 0) + a.r + 5;
        const ay = a.y ?? 0;
        const aHalfH = aDim.h / 2;
        for (let j = i + 1; j < simNodes.length; j++) {
          const b = simNodes[j];
          const bDim = labelDims.get(b.id);
          if (!bDim) continue;
          const bx = (b.x ?? 0) + b.r + 5;
          const by = b.y ?? 0;
          const bHalfH = bDim.h / 2;
          if (ax + aDim.w < bx || bx + bDim.w < ax) continue;
          if (ay + aHalfH < by - bHalfH || by + bHalfH < ay - aHalfH) continue;
          const dx = (a.x ?? 0) - (b.x ?? 0);
          const dy = (a.y ?? 0) - (b.y ?? 0);
          const dist = Math.hypot(dx, dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx = (a.vx ?? 0) + nx * strength;
          a.vy = (a.vy ?? 0) + ny * strength;
          b.vx = (b.vx ?? 0) - nx * strength;
          b.vy = (b.vy ?? 0) - ny * strength;
        }
      }
    };

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => (d.tier === "confirmed" ? 70 : 110)),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d.r + 4))
      .force("labelCollide", labelAntiCollide);
    simRef.current = simulation;

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      arrowSel.attr("transform", (d) => {
        const sx = (d.source as SimNode).x ?? 0;
        const sy = (d.source as SimNode).y ?? 0;
        const tx = (d.target as SimNode).x ?? 0;
        const ty = (d.target as SimNode).y ?? 0;
        const x = sx + (tx - sx) * 0.7;
        const y = sy + (ty - sy) * 0.7;
        const angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
        return `translate(${x},${y}) rotate(${angle})`;
      });
      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (ev, d) => {
        if (!ev.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (ev, d) => {
        d.fx = ev.x;
        d.fy = ev.y;
      })
      .on("end", (ev, d) => {
        if (!ev.active) simulation.alphaTarget(0);
        if (!radialMode || d.id !== selectedId) {
          d.fx = null;
          d.fy = null;
        }
      });
    nodeG.call(drag);

    // Double-click rotation helper — scoped so it shares the sim + selections.
    function rotate(
      targets: SimNode[],
      w: number,
      h: number,
      angleRad = Math.PI / 2,
      durationMs = 600,
    ) {
      if (targets.length === 0) return;
      const cx = w / 2;
      const cy = h / 2;
      const starts = targets.map((n) => ({ x0: n.x ?? cx, y0: n.y ?? cy }));
      simulation.alphaTarget(0).stop();
      for (const n of targets) {
        n.fx = n.x ?? cx;
        n.fy = n.y ?? cy;
      }
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const t0 = performance.now();
      const step = () => {
        const elapsed = performance.now() - t0;
        const tRaw = Math.min(1, elapsed / durationMs);
        const t = 1 - Math.pow(1 - tRaw, 3);
        for (let i = 0; i < targets.length; i++) {
          const node = targets[i];
          const s = starts[i];
          const dx = s.x0 - cx;
          const dy = s.y0 - cy;
          const rx = dx * (1 - t) + (dx * cos - dy * sin) * t;
          const ry = dy * (1 - t) + (dx * sin + dy * cos) * t;
          node.fx = cx + rx;
          node.fy = cy + ry;
          node.x = cx + rx;
          node.y = cy + ry;
        }
        linkSel
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        if (tRaw < 1) requestAnimationFrame(step);
        else {
          for (const n of targets) {
            n.fx = null;
            n.fy = null;
          }
          simulation.alpha(0.3).restart();
        }
      };
      requestAnimationFrame(step);
    }

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, editable, selectedId, connectFrom]);

  // ── Filter / search — applied directly to the selections without a
  //    simulation rebuild, because state changes here are frequent.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q = query.toLowerCase().trim();
    const matchIds = q
      ? new Set(
          nodes
            .filter(
              (n) =>
                n.label.toLowerCase().includes(q) ||
                (n.handle ?? "").toLowerCase().includes(q) ||
                (n.address ?? "").toLowerCase().includes(q) ||
                (n.notes ?? "").toLowerCase().includes(q),
            )
            .map((n) => n.id),
        )
      : null;

    d3.select(svg)
      .selectAll<SVGGElement, SimNode>(".nodes g")
      .classed(
        "dim",
        (d) =>
          !activeGroups.has(d.group) ||
          (matchIds !== null && !matchIds.has(d.id)),
      );
    const edgeDimmed = (d: SimEdge): boolean => {
      const sId = edgeEndpoint(d.source);
      const tId = edgeEndpoint(d.target);
      const s = nodes.find((n) => n.id === sId);
      const t = nodes.find((n) => n.id === tId);
      if (!s || !t) return true;
      if (!activeTiers.has(d.tier)) return true;
      if (!activeGroups.has(s.group) || !activeGroups.has(t.group)) return true;
      if (matchIds && !matchIds.has(sId) && !matchIds.has(tId)) return true;
      return false;
    };
    d3.select(svg)
      .selectAll<SVGLineElement, SimEdge>(".links line")
      .classed("dim", edgeDimmed);
    d3.select(svg)
      .selectAll<SVGPolygonElement, SimEdge>(".arrows polygon")
      .classed("dim", edgeDimmed);
  }, [activeGroups, activeTiers, query, nodes]);

  // ── Radial layout: pulls the selected node to the centre, direct
  //    neighbours to a 160px ring, second-order to 320px.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (!radialMode || !selectedId) {
      sim.force("radial", null);
      sim.alpha(0.4).restart();
      return;
    }
    const width = canvasWrapRef.current?.clientWidth ?? 800;
    const height = canvasWrapRef.current?.clientHeight ?? 600;
    const cx = width / 2;
    const cy = height / 2;
    const neighbours = new Set<string>();
    for (const e of edges) {
      if (e.source === selectedId) neighbours.add(e.target);
      if (e.target === selectedId) neighbours.add(e.source);
    }
    sim.force(
      "radial",
      d3
        .forceRadial<SimNode>(
          (d) => {
            if (d.id === selectedId) return 0;
            if (neighbours.has(d.id)) return 160;
            return 320;
          },
          cx,
          cy,
        )
        .strength((d) => (d.id === selectedId ? 2 : 0.6)),
    );
    sim.alpha(0.7).restart();
  }, [radialMode, selectedId, edges]);

  // ── Keyboard Delete (editable only) ───────────────────────────────
  useEffect(() => {
    if (!editable) return;
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
          return;
        e.preventDefault();
        setNodes((prev) => prev.filter((n) => n.id !== selectedId));
        setEdges((prev) =>
          prev.filter((ed) => ed.source !== selectedId && ed.target !== selectedId),
        );
        setSelectedId(null);
        notifyDirty(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, selectedId, notifyDirty]);

  // ── Auto-populate (editable only) ─────────────────────────────────
  const runLookup = useCallback(
    async (anchorId: string, leadType: string, leadValue: string) => {
      if (!autoMode) return;
      setOrchestrating(true);
      try {
        const r = await fetch(`/api/investigators/lookup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: leadType, value: leadValue }),
        });
        if (!r.ok) return;
        const payload = (await r.json()) as {
          uiReaction?: { cards?: LookupCard[]; suggestions?: LookupSuggestion[] } | null;
        };
        const cards = payload.uiReaction?.cards ?? [];
        const suggestions = payload.uiReaction?.suggestions ?? [];
        const newNodes: NetworkNode[] = [];
        const newEdges: NetworkEdge[] = [];
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
        for (const s of suggestions.slice(0, 8)) {
          const id = uid("sug");
          newNodes.push({
            id,
            group: mapTypeToGroup(s.type),
            tier: "alleged",
            label: s.label ?? truncate(s.value, 24),
            handle: s.type === "HANDLE" ? s.value : undefined,
            address:
              s.type === "WALLET" || s.type === "CONTRACT" ? s.value : undefined,
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
    [autoMode, notifyDirty],
  );

  // ── Add node from form ────────────────────────────────────────────
  function addNodeFromForm(args: {
    label: string;
    val: string | undefined;
    group: NodeGroup;
    tier: EvidenceTier;
  }) {
    const { label, val, group, tier } = args;
    if (!label) return;
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
      address: isWalletGroup || group === "token" ? val : undefined,
    };
    const wrap = canvasWrapRef.current;
    const width = wrap?.clientWidth ?? 900;
    const height = wrap?.clientHeight ?? 600;
    const nodeWithPos = node as NetworkNode & { x?: number; y?: number };
    nodeWithPos.x = width / 2 + (Math.random() - 0.5) * 80;
    nodeWithPos.y = height / 2 + (Math.random() - 0.5) * 80;

    setNodes((prev) => [...prev, node]);
    setSelectedId(id);
    notifyDirty(true);
    setLastAdded({ id, at: Date.now() });
    simRef.current?.alpha(0.8).restart();

    const leadType = mapLeadType(group, val);
    if (autoMode && val && leadType) runLookup(id, leadType, val);
  }

  // ── Focus + view helpers ──────────────────────────────────────────
  const focusNode = useCallback((id: string) => {
    const sim = simRef.current;
    if (!sim || !svgRef.current || !zoomRef.current) return;
    const n = nodesRef.current.find((x) => x.id === id);
    if (!n || n.x == null || n.y == null) return;
    const width = canvasWrapRef.current?.clientWidth ?? 800;
    const height = canvasWrapRef.current?.clientHeight ?? 600;
    const t = d3.zoomIdentity
      .translate(width / 2 - n.x * 1.4, height / 2 - n.y * 1.4)
      .scale(1.4);
    d3.select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, t);
  }, []);

  // Auto-focus on mount (read-only only — editable graphs start empty).
  useEffect(() => {
    if (editable || !focusOnMount) return;
    const t = setTimeout(() => {
      const target = nodesRef.current.find((n) => n.id === focusOnMount);
      if (target) focusNode(target.id);
    }, 400);
    return () => clearTimeout(t);
  }, [editable, focusOnMount, focusNode]);

  function zoomToFit() {
    if (!svgRef.current || !zoomRef.current) return;
    const visible = nodesRef.current.filter((n) => {
      if (!activeGroups.has(n.group)) return false;
      if (n.x == null || n.y == null) return false;
      return true;
    });
    if (visible.length === 0) return;
    const xs = visible.map((n) => n.x as number);
    const ys = visible.map((n) => n.y as number);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padding = 60;
    const boxW = Math.max(maxX - minX, 1) + padding * 2;
    const boxH = Math.max(maxY - minY, 1) + padding * 2;
    const width = canvasWrapRef.current?.clientWidth ?? 800;
    const height = canvasWrapRef.current?.clientHeight ?? 600;
    const scale = Math.min(width / boxW, height / boxH, 4);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const t = d3.zoomIdentity
      .translate(width / 2 - cx * scale, height / 2 - cy * scale)
      .scale(scale);
    d3.select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, t);
  }

  function resetView() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity);
    setQuery("");
    setSelectedId(null);
    setRadialMode(false);
  }

  function exportJson() {
    const payload = { ...data, nodes, edges, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `interligens-graph-${payload.generatedAt}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPng() {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const bbox = svgEl.getBoundingClientRect();
    const xml = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    img.onload = () => {
      const cnv = document.createElement("canvas");
      cnv.width = bbox.width * 2;
      cnv.height = bbox.height * 2;
      const ctx = cnv.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cnv.width, cnv.height);
      ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
      // Diagonal, semi-transparent INVESTIGATOR watermark — identical to
      // the baked PNG pattern from the read-only network page so exported
      // artefacts stay consistent between modes.
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px ui-sans-serif, system-ui, sans-serif";
      ctx.translate(cnv.width / 2, cnv.height / 2);
      ctx.rotate(-Math.PI / 6);
      const text = `INVESTIGATOR · ${investigatorHandle.toUpperCase()}`;
      for (let y = -cnv.height; y < cnv.height; y += 180) {
        for (let x = -cnv.width; x < cnv.width; x += 520) {
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
      const a = document.createElement("a");
      a.href = cnv.toDataURL("image/png");
      a.download = `interligens-graph-${new Date().toISOString()}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  // Solo vs add-to-solo UX for group chips:
  //   click        → solo this group (or reset to all if already soloed)
  //   double-click → add/remove this group from the current visible set
  const groupClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function soloGroup(g: NodeGroup) {
    setActiveGroups((prev) => {
      if (prev.size === 1 && prev.has(g)) return new Set(GROUP_VALUES);
      return new Set<NodeGroup>([g]);
    });
  }

  function addToSoloGroup(g: NodeGroup) {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) {
        if (next.size > 1) next.delete(g);
      } else {
        next.add(g);
      }
      return next;
    });
  }

  function handleGroupClick(g: NodeGroup) {
    if (groupClickTimer.current) {
      clearTimeout(groupClickTimer.current);
      groupClickTimer.current = null;
      addToSoloGroup(g);
      return;
    }
    groupClickTimer.current = setTimeout(() => {
      groupClickTimer.current = null;
      soloGroup(g);
    }, 220);
  }

  function toggleTier(t: EvidenceTier) {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  // Group node-counts and per-tier edge-counts for the sidebar.
  const groupCounts = useMemo(() => {
    const c = {} as Record<NodeGroup, number>;
    for (const g of GROUP_VALUES) c[g] = 0;
    for (const n of nodes) c[n.group] = (c[n.group] ?? 0) + 1;
    return c;
  }, [nodes]);

  const tierEdgeCounts = useMemo(() => {
    const c: Record<EvidenceTier, number> = {
      confirmed: 0,
      strong: 0,
      suspected: 0,
      alleged: 0,
    };
    for (const e of edges) c[e.tier]++;
    return c;
  }, [edges]);

  // ── Connections summary for the detail panel ─────────────────────
  const connections = useMemo(() => {
    if (!selected) return null;
    const all = edges
      .filter(
        (e) =>
          edgeEndpoint(e.source) === selected.id ||
          edgeEndpoint(e.target) === selected.id,
      )
      .map((e) => {
        const otherId =
          edgeEndpoint(e.source) === selected.id
            ? edgeEndpoint(e.target)
            : edgeEndpoint(e.source);
        const other = nodes.find((n) => n.id === otherId);
        const dir: "→" | "←" =
          edgeEndpoint(e.source) === selected.id ? "→" : "←";
        return { e, other, otherId, dir };
      })
      .filter((c) => c.other);
    const tally: Record<EvidenceTier, number> = {
      confirmed: 0,
      strong: 0,
      suspected: 0,
      alleged: 0,
    };
    for (const c of all) tally[c.e.tier]++;
    return { all, tally };
  }, [selected, edges, nodes]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr 320px",
        gap: 12,
        padding: 12,
        height: fullViewport ? "calc(100vh - 48px)" : 600,
        color: "#fff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: "#000",
      }}
    >
      {/* LEFT SIDEBAR — filters + (editable) add form + actions */}
      <aside className="graph-sidebar graph-sidebar-left">
        <style>{SIDEBAR_CSS}</style>
        {editable && backHref && (
          <a
            href={backHref}
            style={{
              display: "block",
              fontSize: 10,
              color: "rgba(255,255,255,0.35)",
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            ← {backLabel ?? "Back"}
          </a>
        )}

        <h1 className="graph-sidebar-title">
          {editable ? "Investigation Graph" : "Scam Universe"}
        </h1>

        {editable ? (
          <input
            value={title ?? ""}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder="Untitled graph"
            maxLength={160}
            aria-label="Graph title"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 15,
              fontWeight: 500,
              padding: 0,
              margin: "0 0 4px",
              fontFamily: "inherit",
            }}
          />
        ) : null}

        <div
          className="graph-sidebar-meta"
          style={{ marginBottom: editable ? 8 : 10 }}
        >
          {nodes.length} nodes · {edges.length} edges
          {!editable && data.generatedAt ? ` · ${data.generatedAt.slice(0, 10)}` : ""}
          {editable && visibility ? ` · ${visibility.replace("_", " ")}` : ""}
          {editable ? (dirty ? " · unsaved" : " · saved") : ""}
          {orchestrating ? " · lookup…" : ""}
        </div>

        {editable && (onSave || onVisibilityChange) && (
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                style={{
                  ...actionButton,
                  width: "auto",
                  flex: "1 1 auto",
                  textAlign: "center" as const,
                  background: dirty && !saving ? ACCENT : "#111",
                  color: dirty && !saving ? "#000" : "rgba(255,255,255,0.55)",
                  border: `1px solid ${dirty && !saving ? ACCENT : "rgba(255,255,255,0.08)"}`,
                  cursor: !dirty || saving ? "default" : "pointer",
                  marginBottom: 0,
                }}
              >
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
            )}
            {onVisibilityChange && visibility && visibility !== "PUBLIC" && (
              <button
                type="button"
                onClick={() =>
                  onVisibilityChange(
                    visibility === "TEAM_POOL" ? "PRIVATE" : "TEAM_POOL",
                  )
                }
                style={{
                  ...actionButton,
                  width: "auto",
                  flex: "1 1 auto",
                  textAlign: "center" as const,
                  marginBottom: 0,
                }}
                title={
                  visibility === "TEAM_POOL"
                    ? "Make this graph private again"
                    : "Share with the team pool (read-only for teammates)"
                }
              >
                {visibility === "TEAM_POOL" ? "Make private" : "Share"}
              </button>
            )}
          </div>
        )}

        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="graph-sidebar-search"
        />

        <SectionLabel>Groups</SectionLabel>
        {GROUP_VALUES.map((g) => {
          const active = activeGroups.has(g);
          const count = groupCounts[g] ?? 0;
          return (
            <button
              key={g}
              type="button"
              onClick={() => handleGroupClick(g)}
              className={`graph-chip-btn${active ? " is-active" : ""}`}
              title="Click to solo · double-click to add/remove"
            >
              <span
                className="graph-chip-dot"
                style={{ background: GROUP_COLOR[g], color: GROUP_COLOR[g] }}
              />
              <span className="graph-chip-label">{GROUP_LABEL[g]}</span>
              <span className="graph-chip-count">{count}</span>
            </button>
          );
        })}

        <SectionLabel>Evidence tier</SectionLabel>
        {TIER_VALUES.map((t) => {
          const active = activeTiers.has(t);
          const edgeCount = tierEdgeCounts[t] ?? 0;
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTier(t)}
              className={`graph-chip-btn${active ? " is-active" : ""}`}
              title={data.evidenceTiers?.[t]}
            >
              <svg width={22} height={6} className="graph-chip-dash">
                <line
                  x1={0}
                  y1={3}
                  x2={22}
                  y2={3}
                  stroke={TIER_STROKE[t]}
                  strokeWidth={t === "confirmed" ? 2 : 1.2}
                  strokeDasharray={TIER_DASH[t] ?? undefined}
                />
              </svg>
              <span className="graph-chip-label">{TIER_LABEL[t]}</span>
              <span className="graph-chip-count">{edgeCount}</span>
            </button>
          );
        })}

        <SectionLabel>Layout</SectionLabel>
        <button
          type="button"
          onClick={() => setRadialMode((v) => !v)}
          className={`graph-chip-btn${radialMode ? " is-active" : ""}`}
          disabled={!selectedId}
          title={
            selectedId
              ? "Arrange neighbours radially around the selected node"
              : "Select a node first"
          }
        >
          <span className="graph-chip-label">Radial around selection</span>
        </button>
        <button type="button" onClick={zoomToFit} className="graph-action-btn">
          Zoom to fit visible
        </button>
        <button type="button" onClick={resetView} className="graph-action-btn">
          Reset view
        </button>

        <SectionLabel>Export</SectionLabel>
        <button type="button" onClick={exportPng} className="graph-action-btn primary">
          Export PNG (watermarked)
        </button>
        <button type="button" onClick={exportJson} className="graph-action-btn">
          Export JSON
        </button>

        {editable && (
          <>
            <SectionLabel>Add node</SectionLabel>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const label = String(fd.get("label") ?? "").trim();
                const val = String(fd.get("value") ?? "").trim() || undefined;
                const group = String(fd.get("group") ?? "wallet") as NodeGroup;
                const tier = String(fd.get("tier") ?? "suspected") as EvidenceTier;
                addNodeFromForm({ label, val, group, tier });
                e.currentTarget.reset();
              }}
              style={{ display: "grid", gap: 4 }}
            >
              <select name="group" defaultValue="wallet" style={formInput} aria-label="Node type">
                {GROUP_VALUES.map((g) => (
                  <option key={g} value={g}>{GROUP_LABEL[g]}</option>
                ))}
              </select>
              <input
                name="label"
                placeholder="Label (e.g. bkokoski)"
                style={formInput}
                aria-label="Node label"
              />
              <input
                name="value"
                placeholder="Address, handle, domain…"
                style={formInput}
                aria-label="Identifier"
              />
              <select name="tier" defaultValue="suspected" style={formInput} aria-label="Evidence tier">
                {TIER_VALUES.map((t) => (
                  <option key={t} value={t}>{TIER_LABEL[t]}</option>
                ))}
              </select>
              <button
                type="submit"
                style={{
                  ...actionButton,
                  background: ACCENT,
                  color: "#000",
                  border: `1px solid ${ACCENT}`,
                  textAlign: "center" as const,
                  marginTop: 2,
                }}
              >
                Add node
              </button>
            </form>

            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setAutoMode((v) => !v)}
                aria-pressed={autoMode}
                style={{
                  ...actionButton,
                  flex: "1 1 auto",
                  width: "auto",
                  textAlign: "center" as const,
                  marginBottom: 0,
                  background: autoMode ? "rgba(255,107,0,0.08)" : "#111",
                  color: autoMode ? ACCENT : "rgba(255,255,255,0.65)",
                  borderColor: autoMode ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.08)",
                }}
                title={
                  autoMode
                    ? "Auto mode: wallets, handles and domains pull related intel on add."
                    : "Manual mode: adds only the node you typed."
                }
              >
                {autoMode ? "Auto ON" : "Manual"}
              </button>
              {selectedId && (
                <button
                  type="button"
                  onClick={() =>
                    setConnectFrom(connectFrom === selectedId ? null : selectedId)
                  }
                  style={{
                    ...actionButton,
                    flex: "1 1 auto",
                    width: "auto",
                    textAlign: "center" as const,
                    marginBottom: 0,
                    background: connectFrom ? "rgba(255,107,0,0.08)" : "#111",
                    color: connectFrom ? ACCENT : "rgba(255,255,255,0.65)",
                    borderColor: connectFrom ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  {connectFrom ? "Pick target…" : "Connect →"}
                </button>
              )}
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 16,
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            lineHeight: 1.5,
          }}
        >
          Node size ∝ documented USD loss (persons). Edge style encodes
          evidence tier.{" "}
          {editable
            ? "Double-click the canvas to rotate · Delete removes the selected node."
            : "Internal OSINT — verify before filing."}
        </div>
        {lastAdded && Date.now() - lastAdded.at < 3000 && (
          <div style={{ color: ACCENT, fontSize: 10, marginTop: 6 }}>· node added</div>
        )}

        {editable && onDelete && (
          <>
            <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
              <button
                type="button"
                onClick={onDelete}
                style={{
                  ...actionButton,
                  color: "rgba(255,59,92,0.65)",
                  borderColor: "rgba(255,59,92,0.18)",
                  textAlign: "center" as const,
                }}
                title="Permanently delete this graph"
              >
                Delete graph
              </button>
            </div>
          </>
        )}
      </aside>

      {/* CANVAS */}
      <main
        ref={canvasWrapRef}
        style={{
          position: "relative",
          background: "radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 0 20px rgba(0,0,0,0.6) inset",
        }}
      >
        <svg
          ref={svgRef}
          className="graph-canvas-svg"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
        <style>{`
          .dim { opacity: 0.12; pointer-events: none; }
          .dim line { stroke-opacity: 0.05; }
        `}</style>
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 12,
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            pointerEvents: "none",
          }}
        >
          {data.sourceOfTruth ?? ""}
        </div>
      </main>

      {/* RIGHT SIDEBAR — detail */}
      <aside className="graph-sidebar graph-sidebar-right">
        {!selected ? (
          <div className="graph-detail-empty">
            <svg
              className="graph-detail-empty-icon"
              width="48"
              height="48"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <circle
                cx="24"
                cy="24"
                r="10"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1"
              />
              <line x1="24" y1="4" x2="24" y2="14" stroke="#ffffff" strokeWidth="1" />
              <line x1="24" y1="34" x2="24" y2="44" stroke="#ffffff" strokeWidth="1" />
            </svg>
            <div className="graph-detail-empty-title">Select a node</div>
            <div className="graph-detail-empty-text">
              {editable
                ? "Click any node to inspect and edit. Use the form on the left to add a new node."
                : "Click any node in the canvas to inspect metadata, tier, and its connections."}
            </div>
          </div>
        ) : (
          <>
            <div className="graph-detail-header">
              <span
                className="graph-detail-chip"
                style={{ background: GROUP_COLOR[selected.group] }}
              />
              <span className="graph-detail-name">{selected.label}</span>
              <span className="graph-detail-type-badge">
                {GROUP_LABEL[selected.group]}
              </span>
            </div>
            <div className="graph-detail-tier-row">
              <TierBadge tier={selected.tier} />
            </div>

            <TigerScoreBadge node={selected} />

            {connections && (
              <>
                <SectionLabel>
                  Connections ({connections.all.length})
                </SectionLabel>
                <div className="graph-detail-breakdown">
                  {TIER_VALUES.map((t) =>
                    connections.tally[t] > 0 ? (
                      <span
                        key={t}
                        className="graph-detail-breakdown-chip"
                        title={TIER_LABEL[t]}
                      >
                        {TIER_LABEL[t].toLowerCase()} {connections.tally[t]}
                      </span>
                    ) : null,
                  )}
                </div>
                {connections.all.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {connections.all.map(({ e, other, otherId, dir }, i) => (
                      <li
                        key={`${otherId}-${i}`}
                        className="graph-detail-connection"
                        onClick={() => {
                          setSelectedId(otherId);
                          focusNode(otherId);
                        }}
                      >
                        <span className="graph-detail-connection-dir">
                          {dir}
                        </span>
                        <span className="graph-detail-connection-other">
                          {other!.label}{" "}
                          <em className="graph-detail-connection-type">
                            · {e.type}
                          </em>
                        </span>
                        {e.tier !== "confirmed" && (
                          <TierBadge tier={e.tier} small />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <SectionLabel>Metadata</SectionLabel>
            <KV label="handle" value={selected.handle} />
            <KV label="risk" value={selected.risk} />
            <KV label="confidence" value={selected.confidence} />
            <KV label="rugCount" value={selected.rugCount?.toString()} />
            <KV
              label="total USD"
              value={
                selected.totalScammedUsd != null
                  ? `$${selected.totalScammedUsd.toLocaleString()}`
                  : undefined
              }
            />
            <KV label="chain" value={selected.chain} />
            <KV label="address" value={selected.address} mono />
            <KV label="status" value={selected.status} />
            {selected.notes && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.5,
                }}
              >
                {selected.notes}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

// ── Small subcomponents / styled helpers ────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin: "14px 0 6px",
      }}
    >
      {children}
    </div>
  );
}

function legendButton(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    width: "100%",
    background: active ? "rgba(255,107,0,0.08)" : "transparent",
    border: `1px solid ${active ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.06)"}`,
    color: active ? "#fff" : "rgba(255,255,255,0.55)",
    padding: "5px 8px",
    borderRadius: 4,
    fontSize: 11,
    marginBottom: 4,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

const actionButton: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "#111",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 11,
  marginBottom: 4,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
};

const pillButton: React.CSSProperties = {
  flex: "1 1 auto",
  background: "#111",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center" as const,
};

const formInput: React.CSSProperties = {
  width: "100%",
  background: "#111",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "5px 7px",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "inherit",
  outline: "none",
};

function TigerScoreBadge({ node }: { node: NetworkNode }) {
  const score = (node as NetworkNode & { tigerScore?: number }).tigerScore;
  if (score == null || Number.isNaN(score)) return null;
  const tone =
    score >= 70 ? "tiger-red" : score >= 40 ? "tiger-orange" : "tiger-green";
  return (
    <div className={`graph-detail-tiger ${tone}`} title={`TigerScore ${score}`}>
      {score}
    </div>
  );
}

function TierBadge({ tier, small }: { tier: EvidenceTier; small?: boolean }) {
  const bg: Record<EvidenceTier, string> = {
    confirmed: "#ff4040",
    strong: "#ff9630",
    suspected: "#ffd060",
    alleged: "#808080",
  };
  const fg: Record<EvidenceTier, string> = {
    confirmed: "#fff",
    strong: "#000",
    suspected: "#000",
    alleged: "#fff",
  };
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 6,
        padding: small ? "1px 5px" : "2px 7px",
        borderRadius: 3,
        fontSize: small ? 9 : 10,
        background: bg[tier],
        color: fg[tier],
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        verticalAlign: "middle",
      }}
    >
      {tier}
    </span>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 6, fontSize: 11, display: "flex", gap: 8 }}>
      <div
        style={{
          width: 70,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          fontSize: 10,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          color: "rgba(255,255,255,0.85)",
          fontFamily: mono ? "ui-monospace, monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ConnectionsSummary({ tally }: { tally: Record<EvidenceTier, number> }) {
  const parts = TIER_VALUES.filter((t) => tally[t] > 0).map(
    (t) => `${tally[t]} ${t}`,
  );
  if (parts.length === 0) return null;
  return (
    <div
      style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.4)",
        marginBottom: 6,
      }}
    >
      {parts.join(" · ")}
    </div>
  );
}
