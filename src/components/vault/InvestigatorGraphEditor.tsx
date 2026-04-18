"use client";

/**
 * InvestigatorGraphEditor (v6) — full-fidelity port of
 * /Users/dood/osint/scam-universe/NETWORK_GRAPH.html wrapped in React +
 * overlaid with editor capabilities (add / delete / connect / save / AUTO
 * mode / double-click rotation).
 *
 * Layout (matches the HTML):
 *   280px left sidebar   | fluid canvas | 340px right detail panel
 *
 * Left sidebar: search · group filters · tier filters · add-node form ·
 *               actions (Add / Reset view / Export JSON / Export PNG).
 * Canvas:       D3 force simulation · drag · zoom · click-to-select ·
 *               dblclick empty canvas = rotate 90° · in AUTO mode the
 *               orchestrator lookup feeds cards + suggestions back in
 *               as child nodes.
 * Right panel:  selected node header with tier badge · KV block · notes ·
 *               clickable connections list.
 *
 * Form submission uses a native <form> with FormData so it survives any
 * React Compiler quirks.
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
const BG = "#000000";
const PANEL = "#0b0b0b";
const LINE = "#222222";
const DIM = "#a0a0a0";
const EDITOR_BUILD = "v6";

// Palette — mirrors NETWORK_GRAPH.html's :root variables, extended with
// the investigator-grade categories we added to NodeGroup.
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
  person: "People",
  project: "Projects",
  token: "Tokens",
  wallet: "Key wallets",
  wallet_family: "Family (F&F)",
  infra_cex: "CEX hot wallets",
  infra_service: "Services",
  source: "External sources",
  claim: "Allegation bundles",
  handle: "Handles",
  contract: "Contracts",
  domain: "Domains",
  transaction: "Transactions",
  pool: "Pools",
  bridge: "Bridges",
  mixer: "Mixers",
  email: "Emails",
  evidence: "Evidence",
};

const TIER_DEF: {
  id: EvidenceTier;
  label: string;
  stroke: string;
  dash: string;
  width: number;
}[] = [
  { id: "confirmed", label: "Confirmed (primary/on-chain)", stroke: "#d0d0d0", dash: "", width: 1.6 },
  { id: "strong",    label: "Strong (multi-source)",         stroke: "#b0b0b0", dash: "6 2",   width: 1.2 },
  { id: "suspected", label: "Suspected (repo claim)",        stroke: "#808080", dash: "3 3",   width: 1.0 },
  { id: "alleged",   label: "Alleged (unverified)",          stroke: "#505050", dash: "1 3",   width: 1.0 },
];

// HTML uses node size ∝ sqrt(totalScammedUsd) for persons. We keep that
// for data imported from NETWORK_GRAPH pattern; new nodes default to a
// group-based radius.
function nodeRadius(n: NetworkNode): number {
  if (n.group === "person") {
    const s = n.totalScammedUsd ?? 0;
    return Math.max(12, Math.min(34, 12 + Math.sqrt(s) / 120));
  }
  if (n.group === "project") return 16;
  if (n.group === "token") return 9;
  if (n.group === "wallet") return 8;
  if (n.group === "wallet_family") return 6;
  return 10;
}

type SimNode = NetworkNode & d3.SimulationNodeDatum & { r: number };
type SimEdge = NetworkEdge & { source: SimNode | string; target: SimNode | string };

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function short(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

type OrchestrateCard = {
  title: string;
  sourceModule: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
};
type OrchestrateSuggestion = {
  type: string;
  value: string;
  label?: string | null;
  reason: string;
};
type OrchestrateResult = {
  success?: boolean;
  uiReaction?: { cards?: OrchestrateCard[]; suggestions?: OrchestrateSuggestion[] } | null;
};

type Props = {
  initialGraph: NetworkGraph;
  onDirtyChange?: (dirty: boolean) => void;
  onGraphChanged?: (graph: NetworkGraph) => void;
};

export default function InvestigatorGraphEditor({
  initialGraph,
  onDirtyChange,
  onGraphChanged,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<NetworkNode[]>(initialGraph.nodes);
  const [edges, setEdges] = useState<NetworkEdge[]>(initialGraph.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  const [orchestrating, setOrchestrating] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ id: string; at: number } | null>(null);

  const [search, setSearch] = useState("");
  const [activeGroups, setActiveGroups] = useState<Set<NodeGroup>>(
    () => new Set(GROUP_VALUES),
  );
  const [activeTiers, setActiveTiers] = useState<Set<EvidenceTier>>(
    () => new Set(TIER_VALUES),
  );

  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

  useEffect(() => {
    onGraphChanged?.({ ...initialGraph, nodes, edges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ── D3 mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const wrap = canvasWrapRef.current;
    const width = wrap?.clientWidth || 900;
    const height = wrap?.clientHeight || 700;

    const simNodes: SimNode[] = nodes.map((n) => {
      const base = { ...n, r: nodeRadius(n) } as SimNode;
      // Preserve any previous position from state so tick doesn't jitter.
      const prev = n as NetworkNode & { x?: number; y?: number };
      if (prev.x != null) base.x = prev.x;
      if (prev.y != null) base.y = prev.y;
      return base;
    });
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
    zoomRef.current = zoom;

    svg.on("click", (ev) => {
      if (ev.target === svgRef.current) {
        setSelectedId(null);
        setConnectFrom(null);
      }
    });

    svg.on("dblclick.rotate", (ev) => {
      if (ev.target !== svgRef.current) return;
      ev.preventDefault();
      rotate(simNodes, width, height);
    });

    const linkSel = root
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, SimEdge>("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d) => TIER_DEF.find((t) => t.id === d.tier)?.stroke ?? "#808080")
      .attr("stroke-width", (d) => TIER_DEF.find((t) => t.id === d.tier)?.width ?? 1)
      .attr("stroke-dasharray", (d) => TIER_DEF.find((t) => t.id === d.tier)?.dash ?? "")
      .attr("stroke-opacity", 0.55)
      .on("mouseover", function () {
        d3.select(this).attr("stroke-opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-opacity", 0.55);
      });
    linkSel
      .append("title")
      .text((d) => `${d.type}${d.label ? ": " + d.label : ""} [${d.tier}]`);

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
        if (connectFrom && connectFrom !== d.id) {
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

    nodeG
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) =>
        d.id === selectedId || d.id === connectFrom ? ACCENT : "#000",
      )
      .attr("stroke-width", (d) =>
        d.id === selectedId || d.id === connectFrom ? 3 : 1.5,
      );

    nodeG
      .append("text")
      .attr("dx", (d) => d.r + 3)
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

    nodeG.call(
      d3
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
          // Keep the position the user dragged to; persist into state on
          // release so save captures it.
          d.fx = null;
          d.fy = null;
        }),
    );

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

    // Double-click rotation helper (scoped so it shares the simulation +
    // selections without re-defining them).
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

    // Apply current filters at mount (may already be "all on").
    applyFilterClasses(nodeG, linkSel, activeGroups, activeTiers, search);

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, selectedId, connectFrom, notifyDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter / search — applied directly to the selections without a
  //    full re-render because React state changes for these are frequent.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const nodeG = d3.select(svg).select<SVGGElement>("g.nodes").selectAll<SVGGElement, SimNode>("g");
    const linkSel = d3.select(svg).select<SVGGElement>("g.links").selectAll<SVGLineElement, SimEdge>("line");
    applyFilterClasses(nodeG, linkSel, activeGroups, activeTiers, search);
  }, [activeGroups, activeTiers, search, nodes, edges]);

  // ── Keyboard Delete removes selected ─────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
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
  }, [selectedId, notifyDirty]);

  // ── Auto-populate via /lookup ────────────────────────────────────────
  const mapTypeToGroup = useCallback((type: string): NodeGroup => {
    const up = type.toUpperCase();
    if (up === "WALLET") return "wallet";
    if (up === "CONTRACT") return "contract";
    if (up === "HANDLE" || up === "ALIAS" || up === "EMAIL") return "person";
    if (up === "URL" || up === "DOMAIN") return "domain";
    return "claim";
  }, []);

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
        const data = (await r.json()) as OrchestrateResult;
        const cards = data.uiReaction?.cards ?? [];
        const suggestions = data.uiReaction?.suggestions ?? [];

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
    [autoMode, mapTypeToGroup, notifyDirty],
  );

  // ── Add from form ────────────────────────────────────────────────────
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
    const svg = svgRef.current;
    const wrap = canvasWrapRef.current;
    const width = wrap?.clientWidth ?? 900;
    const height = wrap?.clientHeight ?? 700;
    const nodeWithPos = node as NetworkNode & { x?: number; y?: number };
    nodeWithPos.x = width / 2 + (Math.random() - 0.5) * 80;
    nodeWithPos.y = height / 2 + (Math.random() - 0.5) * 80;
    void svg;

    setNodes((prev) => [...prev, node]);
    setSelectedId(id);
    notifyDirty(true);
    setLastAdded({ id, at: Date.now() });
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
    if (autoMode && val && leadType) runLookup(id, leadType, val);
  }

  // ── Selected node + its connections for the right panel ─────────────
  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );
  const selectedConnections = useMemo(() => {
    if (!selected) return [] as Array<{ dir: "→" | "←"; otherId: string; edge: NetworkEdge }>;
    const out: Array<{ dir: "→" | "←"; otherId: string; edge: NetworkEdge }> = [];
    for (const e of edges) {
      const src = typeof e.source === "string" ? e.source : String(e.source);
      const tgt = typeof e.target === "string" ? e.target : String(e.target);
      if (src === selected.id) out.push({ dir: "→", otherId: tgt, edge: e });
      else if (tgt === selected.id) out.push({ dir: "←", otherId: src, edge: e });
    }
    return out;
  }, [edges, selected]);

  function focusNode(id: string) {
    setSelectedId(id);
    const svg = svgRef.current;
    const wrap = canvasWrapRef.current;
    const zoom = zoomRef.current;
    if (!svg || !wrap || !zoom) return;
    const n = (d3.select(svg).select<SVGGElement>("g.nodes").selectAll<SVGGElement, SimNode>("g").data() as SimNode[]).find(
      (m) => m.id === id,
    );
    if (!n || n.x == null || n.y == null) return;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    const t = d3.zoomIdentity
      .translate(width / 2 - n.x * 1.4, height / 2 - n.y * 1.4)
      .scale(1.4);
    d3.select(svg).transition().duration(700).call(zoom.transform, t);
  }

  function resetView() {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    setSearch("");
    setActiveGroups(new Set(GROUP_VALUES));
    setActiveTiers(new Set(TIER_VALUES));
  }

  function exportJson() {
    const payload = { ...initialGraph, nodes, edges, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "graph-export.json";
    a.click();
  }

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const { width, height } = svg.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      const cnv = document.createElement("canvas");
      cnv.width = Math.round(width * 2);
      cnv.height = Math.round(height * 2);
      const ctx = cnv.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cnv.width, cnv.height);
      ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
      const a = document.createElement("a");
      a.href = cnv.toDataURL("image/png");
      a.download = "graph.png";
      a.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  function toggleGroup(g: NodeGroup) {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }
  function toggleTier(t: EvidenceTier) {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr) 340px",
        gap: 0,
        border: `1px solid ${LINE}`,
        borderRadius: 6,
        overflow: "hidden",
        background: BG,
        height: "min(80vh, 720px)",
      }}
    >
      {/* LEFT SIDEBAR */}
      <aside
        style={{
          background: PANEL,
          padding: 14,
          overflow: "auto",
          borderRight: `1px solid ${LINE}`,
          color: "#fff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 15, margin: "0 0 8px", color: ACCENT, letterSpacing: "0.5px" }}>
          INTERLIGENS — Network
        </h1>
        <div style={{ fontSize: 11, color: DIM, marginBottom: 12 }}>
          Investigator-grade graph · editor {EDITOR_BUILD}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, address, token…"
          aria-label="Search graph"
          style={{
            width: "100%",
            background: "#111",
            border: "1px solid #333",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: 4,
            fontSize: 12,
            outline: "none",
          }}
        />

        <Section title="Filter by group">
          {GROUP_VALUES.map((g) => {
            const on = activeGroups.has(g);
            return (
              <LegendRow
                key={g}
                muted={!on}
                onClick={() => toggleGroup(g)}
                swatch={<span style={{ width: 12, height: 12, borderRadius: "50%", flex: "0 0 12px", background: GROUP_COLOR[g] }} />}
                label={GROUP_LABEL[g]}
              />
            );
          })}
        </Section>

        <Section title="Evidence tier">
          {TIER_DEF.map((t) => {
            const on = activeTiers.has(t.id);
            return (
              <LegendRow
                key={t.id}
                muted={!on}
                onClick={() => toggleTier(t.id)}
                swatch={
                  <span
                    style={{
                      width: 28,
                      height: 0,
                      borderTop: `2px ${t.dash ? "dashed" : "solid"} ${t.stroke}`,
                      flex: "0 0 28px",
                    }}
                  />
                }
                label={t.label}
              />
            );
          })}
        </Section>

        <Section title="Add node">
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
            style={{ display: "grid", gap: 6 }}
          >
            <select name="group" defaultValue="wallet" style={FORM_INPUT} aria-label="Node type">
              {GROUP_VALUES.map((g) => (
                <option key={g} value={g}>{GROUP_LABEL[g]}</option>
              ))}
            </select>
            <input name="label" placeholder="Label (e.g. bkokoski)" style={FORM_INPUT} aria-label="Node label" />
            <input name="value" placeholder="Address, handle, domain…" style={FORM_INPUT} aria-label="Identifier" />
            <select name="tier" defaultValue="suspected" style={FORM_INPUT} aria-label="Evidence tier">
              {TIER_VALUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="submit" style={{ ...PILL_BTN, background: ACCENT, color: "#000", border: `1px solid ${ACCENT}` }}>
              Add node
            </button>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setAutoMode((v) => !v)}
              aria-pressed={autoMode}
              style={{ ...PILL_BTN, background: autoMode ? "rgba(255,107,0,0.12)" : "#111", color: autoMode ? ACCENT : "#fff" }}
            >
              {autoMode ? "Auto on" : "Manual"}
            </button>
            {selectedId && (
              <button
                type="button"
                onClick={() => setConnectFrom(selectedId)}
                style={{ ...PILL_BTN, background: connectFrom ? "rgba(255,107,0,0.12)" : "#111", color: connectFrom ? ACCENT : "#fff" }}
              >
                {connectFrom ? "Pick target…" : "Connect →"}
              </button>
            )}
          </div>
        </Section>

        <Section title="Actions">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button type="button" onClick={resetView} style={PILL_BTN}>Reset view</button>
            <button type="button" onClick={exportPng} style={PILL_BTN}>Export PNG</button>
            <button type="button" onClick={exportJson} style={PILL_BTN}>Export JSON</button>
          </div>
        </Section>

        <Section title="Notes">
          <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
            Node size ∝ documented USD (persons) or qualitative weight. Edge
            style encodes tier. Click a node for details. Double-click the
            canvas to rotate 90°. Delete key removes the selected node.
          </div>
        </Section>

        <div style={{ fontSize: 10, color: DIM, marginTop: 14 }}>
          {nodes.length} nodes · {edges.length} edges
          {orchestrating && " · lookup running…"}
          {lastAdded && Date.now() - lastAdded.at < 3000 && (
            <span style={{ color: ACCENT, marginLeft: 6 }}>· added</span>
          )}
        </div>
      </aside>

      {/* CENTER CANVAS */}
      <main
        ref={canvasWrapRef}
        style={{
          position: "relative",
          overflow: "hidden",
          background: "radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%)",
        }}
      >
        <svg ref={svgRef} style={{ display: "block", width: "100%", height: "100%" }} />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            fontSize: 10,
            color: DIM,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Double-click to rotate · Drag to reposition · Click node to inspect
        </div>
      </main>

      {/* RIGHT DETAIL PANEL */}
      <aside
        style={{
          background: PANEL,
          padding: 14,
          overflow: "auto",
          borderLeft: `1px solid ${LINE}`,
          color: "#fff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {!selected ? (
          <>
            <h3 style={{ margin: "0 0 4px", fontSize: 14, color: ACCENT }}>Select a node</h3>
            <div style={{ fontSize: 11, color: DIM, marginBottom: 12 }}>
              Click any node in the graph to see its metadata and linked
              entities. Edges are colour-coded by evidence tier.
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: "0 0 4px", fontSize: 14, color: ACCENT }}>
              {selected.label}
              <TierBadge tier={selected.tier} />
            </h3>
            <KVBlock node={selected} />
            {selected.notes && (
              <div style={{ fontSize: 11, color: DIM, marginTop: 6 }}>{selected.notes}</div>
            )}
            <div style={{ marginTop: 10 }}>
              <h2 style={SECTION_H2}>
                Connections ({selectedConnections.length})
              </h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {selectedConnections.map((c, i) => {
                  const other = nodes.find((n) => n.id === c.otherId);
                  return (
                    <li
                      key={i}
                      onClick={() => other && focusNode(other.id)}
                      style={{
                        fontSize: 11,
                        color: DIM,
                        margin: "2px 0",
                        cursor: "pointer",
                      }}
                      className="graph-conn"
                    >
                      {c.dir}{" "}
                      <span style={{ color: "#fff" }}>{other?.label ?? c.otherId}</span>{" "}
                      · <em>{c.edge.type}</em>
                      <TierBadge tier={c.edge.tier} />
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
        <style>{`
          .graph-conn:hover { color: ${ACCENT} !important; }
        `}</style>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 style={SECTION_H2}>{title}</h2>
      <div>{children}</div>
    </>
  );
}

function LegendRow({
  swatch,
  label,
  muted,
  onClick,
}: {
  swatch: React.ReactNode;
  label: string;
  muted: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        margin: "4px 0",
        cursor: "pointer",
        userSelect: "none",
        opacity: muted ? 0.35 : 1,
      }}
    >
      {swatch}
      <span>{label}</span>
    </div>
  );
}

function TierBadge({ tier }: { tier: EvidenceTier }) {
  const map: Record<EvidenceTier, { bg: string; fg: string }> = {
    confirmed: { bg: "#ff4040", fg: "#fff" },
    strong: { bg: "#ff9630", fg: "#000" },
    suspected: { bg: "#ffd060", fg: "#000" },
    alleged: { bg: "#808080", fg: "#fff" },
  };
  const c = map[tier] ?? map.alleged;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 3,
        marginLeft: 4,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        background: c.bg,
        color: c.fg,
      }}
    >
      {tier}
    </span>
  );
}

function KVBlock({ node }: { node: NetworkNode }) {
  const rows: Array<[string, React.ReactNode]> = [];
  rows.push(["group", GROUP_LABEL[node.group] ?? node.group]);
  if (node.handle) rows.push(["handle", node.handle]);
  if (node.risk) rows.push(["risk", node.risk]);
  if (node.confidence) rows.push(["confidence", node.confidence]);
  if (node.rugCount != null) rows.push(["rugCount", String(node.rugCount)]);
  if (node.totalScammedUsd != null)
    rows.push(["totalScammedUsd", `$${Number(node.totalScammedUsd).toLocaleString()}`]);
  if (node.chain) rows.push(["chain", node.chain]);
  if (node.address)
    rows.push([
      "address",
      <code
        key="a"
        style={{
          background: "#111",
          padding: "1px 4px",
          borderRadius: 3,
          fontSize: 10,
          wordBreak: "break-all",
        }}
      >
        {node.address}
      </code>,
    ]);
  if (node.status) rows.push(["status", node.status]);
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        gap: "4px 8px",
        margin: "6px 0",
        fontSize: 11,
      }}
    >
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt style={{ color: DIM, margin: 0 }}>{k}</dt>
          <dd style={{ margin: 0 }}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// Apply filter / search classes to node + link selections. Mutates the
// DOM directly — cheaper than rebuilding the simulation on every toggle.
function applyFilterClasses(
  nodeG: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
  linkSel: d3.Selection<SVGLineElement, SimEdge, SVGGElement, unknown>,
  activeGroups: Set<NodeGroup>,
  activeTiers: Set<EvidenceTier>,
  search: string,
) {
  const q = search.trim().toLowerCase();
  const matches = (n: NetworkNode) =>
    !q ||
    (n.label ?? "").toLowerCase().includes(q) ||
    (n.handle ?? "").toLowerCase().includes(q) ||
    (n.address ?? "").toLowerCase().includes(q) ||
    (n.notes ?? "").toLowerCase().includes(q);
  nodeG.each(function (d) {
    const dim = !activeGroups.has(d.group) || !matches(d);
    d3.select(this).select<SVGCircleElement>("circle").attr("fill-opacity", dim ? 0.15 : 0.85);
    d3.select(this).select<SVGTextElement>("text").attr("opacity", dim ? 0.15 : 1);
  });
  linkSel.each(function (d) {
    const s: SimNode | undefined =
      typeof d.source === "object" ? (d.source as SimNode) : undefined;
    const t: SimNode | undefined =
      typeof d.target === "object" ? (d.target as SimNode) : undefined;
    const groupOk =
      (s?.group ? activeGroups.has(s.group) : true) &&
      (t?.group ? activeGroups.has(t.group) : true);
    const tierOk = activeTiers.has(d.tier);
    const searchOk = !q || (s && matches(s)) || (t && matches(t));
    d3.select(this).attr(
      "stroke-opacity",
      !groupOk || !tierOk || !searchOk ? 0.05 : 0.55,
    );
  });
}

// Import React for the Fragment use above — named namespace so we don't
// have to change the top import.
import React from "react";

const FORM_INPUT: React.CSSProperties = {
  width: "100%",
  background: "#111",
  border: "1px solid #333",
  color: "#fff",
  padding: "6px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

const PILL_BTN: React.CSSProperties = {
  background: "#111",
  border: "1px solid #333",
  color: "#fff",
  padding: "6px 10px",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
};

const SECTION_H2: React.CSSProperties = {
  fontSize: 12,
  margin: "18px 0 6px",
  color: DIM,
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: 600,
};
