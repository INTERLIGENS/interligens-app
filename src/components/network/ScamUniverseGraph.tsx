"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type {
  EvidenceTier,
  NetworkEdge,
  NetworkGraph,
  NetworkNode,
  NodeGroup,
} from "@/lib/network/schema";
import { GROUP_VALUES, TIER_VALUES } from "@/lib/network/schema";
import {
  ACCENT,
  GROUP_COLOR,
  GROUP_LABEL,
  LABEL_PILL,
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

const SVG_HEIGHT = 600;

// Sidebar CSS — scoped by `.graph-sidebar` so it can't leak to other pages.
// Inline-in-JSX so the whole component stays self-contained.
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
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  margin: 0 0 6px;
  padding-bottom: 4px;
  border-bottom: 2px solid ${ACCENT};
  display: inline-block;
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
  gap: 8px;
  width: 100%;
  height: 26px;
  padding: 0 8px;
  margin-bottom: 2px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: rgba(255,255,255,0.7);
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease-out, color 120ms ease-out, border-color 120ms ease-out;
}
.graph-sidebar .graph-chip-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.04);
  color: #fff;
}
.graph-sidebar .graph-chip-btn.is-active {
  color: #fff;
  border-color: rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
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
}
.graph-sidebar .graph-chip-dash {
  flex: 0 0 22px;
}
.graph-sidebar .graph-chip-label {
  flex: 1;
  font-size: 11px;
}
.graph-sidebar .graph-chip-count {
  font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  min-width: 22px;
  text-align: right;
}
.graph-sidebar .graph-action-btn {
  display: block;
  width: 100%;
  height: 28px;
  padding: 0 10px;
  margin-bottom: 4px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  color: rgba(255,255,255,0.7);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease-out, color 120ms ease-out;
}
.graph-sidebar .graph-action-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.04);
  color: #fff;
}
.graph-sidebar .graph-sidebar-note {
  margin-top: 16px;
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  line-height: 1.5;
}
`;

type SimNode = d3.SimulationNodeDatum & NetworkNode & { r: number };
type SimEdge = d3.SimulationLinkDatum<SimNode> & NetworkEdge;

function edgeEndpoint(v: SimEdge["source"] | SimEdge["target"]): string {
  return typeof v === "string" ? v : (v as SimNode).id;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type Props = {
  data: NetworkGraph;
  investigatorHandle: string;
};

export default function ScamUniverseGraph({ data, investigatorHandle }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeGroups, setActiveGroups] = useState<Set<NodeGroup>>(
    () => new Set(GROUP_VALUES)
  );
  const [activeTiers, setActiveTiers] = useState<Set<EvidenceTier>>(
    () => new Set(TIER_VALUES)
  );
  const [query, setQuery] = useState("");
  const [radialMode, setRadialMode] = useState(false);

  const selected = useMemo(
    () => data.nodes.find((n) => n.id === selectedId) ?? null,
    [data.nodes, selectedId]
  );

  // Main simulation setup — runs once per data payload.
  useEffect(() => {
    if (!svgRef.current) return;
    const width = svgRef.current.clientWidth || 800;
    const height = SVG_HEIGHT;

    // Degree centrality — drives radius scaling (6→22 px), border weight
    // (median threshold), and the top-3 hub halos.
    const degree: Record<string, number> = {};
    for (const e of data.edges) {
      degree[e.source] = (degree[e.source] ?? 0) + 1;
      degree[e.target] = (degree[e.target] ?? 0) + 1;
    }
    const degValues = data.nodes.map((n) => degree[n.id] ?? 0);
    const maxDeg = Math.max(1, ...degValues);
    const sortedDeg = [...degValues].sort((a, b) => a - b);
    const medianDeg = sortedDeg.length
      ? sortedDeg[Math.floor(sortedDeg.length / 2)]
      : 0;
    const top3Hubs = new Set(
      data.nodes
        .map((n) => ({ id: n.id, d: degree[n.id] ?? 0 }))
        .filter((x) => x.d > 0)
        .sort((a, b) => b.d - a.d)
        .slice(0, 3)
        .map((x) => x.id),
    );
    const radiusFor = (id: string) =>
      6 + Math.min(1, (degree[id] ?? 0) / maxDeg) * 16;

    const nodes: SimNode[] = data.nodes.map((n) => ({
      ...n,
      r: radiusFor(n.id),
    }));
    const edges: SimEdge[] = data.edges.map((e) => ({ ...e }));
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Constellation grid — renders inside the zoom group so panning/zooming
    // gives a sense of depth. Non-scaling stroke keeps lines hairline at any
    // zoom level.
    const defs = svg.append("defs");
    const gridPattern = defs
      .append("pattern")
      .attr("id", "constellation-grid")
      .attr("width", 48)
      .attr("height", 48)
      .attr("patternUnits", "userSpaceOnUse");
    gridPattern
      .append("path")
      .attr("d", "M 48 0 L 0 0 0 48")
      .attr("stroke", "#ffffff")
      .attr("stroke-opacity", 0.02)
      .attr("stroke-width", 1)
      .attr("fill", "none")
      .attr("vector-effect", "non-scaling-stroke");

    const root = svg.append("g");

    root
      .append("rect")
      .attr("class", "constellation-grid-bg")
      .attr("x", -20000)
      .attr("y", -20000)
      .attr("width", 40000)
      .attr("height", 40000)
      .attr("fill", "url(#constellation-grid)")
      .attr("pointer-events", "none");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (ev) => root.attr("transform", ev.transform.toString()));
    svg.call(zoom);
    zoomRef.current = zoom;

    svg.on("click", (ev) => {
      if (ev.target === svgRef.current) setSelectedId(null);
    });

    const nodeById = new Map(data.nodes.map((n) => [n.id, n] as const));

    const linksG = root.append("g").attr("class", "links");
    const linkSel = linksG
      .selectAll<SVGLineElement, SimEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => TIER_STROKE[d.tier])
      .attr("stroke-width", (d) => TIER_WIDTH[d.tier])
      .attr("stroke-dasharray", (d) => TIER_DASH[d.tier])
      .attr("stroke-opacity", (d) => TIER_OPACITY[d.tier])
      .style("filter", (d) => {
        if (d.tier !== "confirmed") return null;
        const src = nodeById.get(edgeEndpoint(d.source));
        const color = src ? GROUP_COLOR[src.group] : "#ffffff";
        return `drop-shadow(0 0 2px ${hexToRgba(color, 0.2)})`;
      });
    linkSel.append("title").text((d) => `${d.type}${d.label ? ": " + d.label : ""} [${d.tier}]`);

    // Directional arrowheads — small triangle placed 70% along each line so
    // it sits clear of the target node's body. Position + rotation update
    // every simulation tick.
    const arrowSel = root
      .append("g")
      .attr("class", "arrows")
      .selectAll<SVGPolygonElement, SimEdge>("polygon")
      .data(edges)
      .join("polygon")
      .attr("points", "0,0 -4,-2 -4,2")
      .attr("fill", (d) => TIER_STROKE[d.tier])
      .attr("fill-opacity", (d) => TIER_OPACITY[d.tier])
      .attr("pointer-events", "none");

    const nodeG = root
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        setSelectedId(d.id);
      });

    // Halos for the top-3 hubs — rendered FIRST inside each node's <g> so
    // they sit behind the body circle.
    const haloSel = nodeG.filter((d) => top3Hubs.has(d.id));
    haloSel
      .append("circle")
      .attr("class", "halo halo-3")
      .attr("r", (d) => d.r * 1.8)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.03)
      .attr("pointer-events", "none");
    haloSel
      .append("circle")
      .attr("class", "halo halo-2")
      .attr("r", (d) => d.r * 1.4)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.06)
      .attr("pointer-events", "none");
    haloSel
      .append("circle")
      .attr("class", "halo halo-1")
      .attr("r", (d) => d.r * 1.1)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.12)
      .attr("pointer-events", "none");

    // Main body. Border width picks up the median-degree threshold so hubs
    // read heavier at a glance. Drop shadow lifts the node off the canvas.
    nodeG
      .append("circle")
      .attr("class", "node-body")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#000")
      .attr("stroke-width", (d) =>
        (degree[d.id] ?? 0) > medianDeg ? 2 : 1,
      )
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

    // Hover: ring expansion +2px on the body only.
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

    // Label pill: <g class="label"> with <rect> background + <text>. Pill
    // sits to the right of the node body and is measured per-node so
    // addresses/hashes keep their monospace rhythm. Rect is inserted before
    // the text so it renders behind.
    const labelG = nodeG
      .append("g")
      .attr("class", "label")
      .attr("pointer-events", "none")
      .attr("transform", (d) => `translate(${d.r + 5}, 0)`);

    labelG
      .append("rect")
      .attr("class", "label-bg")
      .attr("rx", LABEL_PILL.radius)
      .attr("ry", LABEL_PILL.radius)
      .attr("fill", LABEL_PILL.bg)
      .attr("stroke", LABEL_PILL.border)
      .attr("stroke-width", 1);

    labelG
      .append("text")
      .attr("class", "label-text")
      .attr("x", LABEL_PILL.padX)
      .attr("fill", "#fff")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => labelSize(d.id, degree, top3Hubs))
      .attr("font-family", (d) => labelFont(d.group))
      .text((d) => formatNodeLabel(d));

    // Size each pill rect to its actual rendered text bbox, with a 3×6
    // padding and a 3 px corner radius.
    labelG.each(function () {
      const g = d3.select(this);
      const textEl = g.select<SVGTextElement>("text.label-text").node();
      if (!textEl) return;
      let bbox: DOMRect | null = null;
      try {
        bbox = textEl.getBBox() as DOMRect;
      } catch {
        bbox = null;
      }
      const w = (bbox?.width ?? 0) + LABEL_PILL.padX * 2;
      const h = (bbox?.height ?? 12) + LABEL_PILL.padY * 2;
      g.select<SVGRectElement>("rect.label-bg")
        .attr("x", 0)
        .attr("y", -h / 2)
        .attr("width", w)
        .attr("height", h);
    });

    // Pre-compute estimated label boxes for the custom anti-collision force
    // below. Re-measuring with getBBox on every tick would torch the main
    // thread; estimation is accurate enough for layout decisions.
    const labelDims = new Map<string, { w: number; h: number }>();
    for (const n of nodes) {
      const sz = labelSize(n.id, degree, top3Hubs);
      const text = formatNodeLabel(n);
      const w = estimatedLabelWidth(text, sz, isMonoGroup(n.group));
      const h = sz + LABEL_PILL.padY * 2;
      labelDims.set(n.id, { w, h });
    }

    const labelAntiCollide: d3.Force<SimNode, SimEdge> = (alpha) => {
      const strength = alpha * 0.6;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const aDim = labelDims.get(a.id);
        if (!aDim) continue;
        const ax = (a.x ?? 0) + a.r + 5;
        const ay = a.y ?? 0;
        const aHalfH = aDim.h / 2;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
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
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance((d) => (d.tier === "confirmed" ? 70 : 110))
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

    return () => {
      simulation.stop();
    };
  }, [data, radialMode, selectedId]);

  // Filter effect — re-run without rebuilding the simulation.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const q = query.toLowerCase().trim();
    const matchIds = q
      ? new Set(
          data.nodes
            .filter(
              (n) =>
                n.label.toLowerCase().includes(q) ||
                (n.handle ?? "").toLowerCase().includes(q) ||
                (n.address ?? "").toLowerCase().includes(q) ||
                (n.notes ?? "").toLowerCase().includes(q)
            )
            .map((n) => n.id)
        )
      : null;

    svg
      .selectAll<SVGGElement, SimNode>(".nodes g")
      .classed(
        "dim",
        (d) =>
          !activeGroups.has(d.group) ||
          (matchIds !== null && !matchIds.has(d.id))
      );
    const edgeDimmed = (d: SimEdge): boolean => {
      const sId = edgeEndpoint(d.source);
      const tId = edgeEndpoint(d.target);
      const s = data.nodes.find((n) => n.id === sId);
      const t = data.nodes.find((n) => n.id === tId);
      if (!s || !t) return true;
      if (!activeTiers.has(d.tier)) return true;
      if (!activeGroups.has(s.group) || !activeGroups.has(t.group)) return true;
      if (matchIds && !matchIds.has(sId) && !matchIds.has(tId)) return true;
      return false;
    };
    svg
      .selectAll<SVGLineElement, SimEdge>(".links line")
      .classed("dim", edgeDimmed);
    svg
      .selectAll<SVGPolygonElement, SimEdge>(".arrows polygon")
      .classed("dim", edgeDimmed);
  }, [activeGroups, activeTiers, query, data.nodes]);

  // Radial layout: when enabled AND a node is selected, pull the selected
  // node hard toward the canvas center, direct neighbors to a 160px ring,
  // and second-order nodes to a 320px ring. Implemented purely via
  // d3.forceRadial so we avoid mutating ref-held data (React Compiler
  // immutability rule) — a strong radial strength on the selected id is
  // equivalent to pinning for UX purposes.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (!radialMode || !selectedId) {
      sim.force("radial", null);
      sim.alpha(0.4).restart();
      return;
    }
    const width = svgRef.current?.clientWidth ?? 800;
    const cx = width / 2;
    const cy = SVG_HEIGHT / 2;
    const neighbors = new Set<string>();
    for (const e of data.edges) {
      if (e.source === selectedId) neighbors.add(e.target);
      if (e.target === selectedId) neighbors.add(e.source);
    }
    sim.force(
      "radial",
      d3
        .forceRadial<SimNode>(
          (d) => {
            if (d.id === selectedId) return 0;
            if (neighbors.has(d.id)) return 160;
            return 320;
          },
          cx,
          cy
        )
        .strength((d) => (d.id === selectedId ? 2 : 0.6))
    );
    sim.alpha(0.7).restart();
  }, [radialMode, selectedId, data.edges]);

  const focusNode = useCallback((id: string) => {
    const sim = simRef.current;
    if (!sim || !svgRef.current || !zoomRef.current) return;
    const n = nodesRef.current.find((x) => x.id === id);
    if (!n || n.x == null || n.y == null) return;
    const width = svgRef.current.clientWidth;
    const t = d3.zoomIdentity
      .translate(width / 2 - n.x * 1.4, SVG_HEIGHT / 2 - n.y * 1.4)
      .scale(1.4);
    d3.select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, t);
  }, []);

  // After first layout settles, focus on bkokoski if present (same behavior
  // as the source HTML). The 400ms delay lets the sim find its shape.
  useEffect(() => {
    const t = setTimeout(() => {
      const bk = nodesRef.current.find((n) => n.id === "bkokoski");
      if (bk) focusNode(bk.id);
    }, 400);
    return () => clearTimeout(t);
  }, [data, focusNode]);

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
    const width = svgRef.current.clientWidth;
    const scale = Math.min(width / boxW, SVG_HEIGHT / boxH, 4);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const t = d3.zoomIdentity
      .translate(width / 2 - cx * scale, SVG_HEIGHT / 2 - cy * scale)
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
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `interligens-network-${data.generatedAt}.json`;
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
      // Rasterized investigator watermark — diagonal, semi-transparent,
      // same pattern as the live WatermarkOverlay but baked into the PNG.
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
      a.download = `interligens-network-${data.generatedAt}.png`;
      a.click();
    };
    img.src =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  // Solo vs add-to-solo UX for group chips:
  //   click        → solo this group (or reset to all if already soloed)
  //   double-click → add/remove this group from the current visible set
  // Implemented with a 220 ms timer so the single-click action doesn't fire
  // while a double-click is in progress.
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

  // Group node-counts and per-tier edge-counts, memoised so the sidebar
  // renders O(1) instead of O(N × groups).
  const groupCounts = useMemo(() => {
    const c = {} as Record<NodeGroup, number>;
    for (const g of GROUP_VALUES) c[g] = 0;
    for (const n of data.nodes) c[n.group] = (c[n.group] ?? 0) + 1;
    return c;
  }, [data.nodes]);

  const tierEdgeCounts = useMemo(() => {
    const c: Record<EvidenceTier, number> = {
      confirmed: 0,
      strong: 0,
      suspected: 0,
      alleged: 0,
    };
    for (const e of data.edges) c[e.tier]++;
    return c;
  }, [data.edges]);

  // Connections summary for the detail panel. CONFIRMED edges are the
  // dominant tier (~95%) — showing a badge for every one spams the panel.
  // Instead we collapse confirmed into a single count line and surface
  // individual badges only for non-confirmed tiers.
  const connections = useMemo(() => {
    if (!selected) return null;
    const all = data.edges
      .filter(
        (e) => edgeEndpoint(e.source) === selected.id || edgeEndpoint(e.target) === selected.id
      )
      .map((e) => {
        const otherId =
          edgeEndpoint(e.source) === selected.id
            ? edgeEndpoint(e.target)
            : edgeEndpoint(e.source);
        const other = data.nodes.find((n) => n.id === otherId);
        const dir = edgeEndpoint(e.source) === selected.id ? "→" : "←";
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
  }, [selected, data.edges, data.nodes]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr 320px",
        gap: 12,
        padding: 12,
        height: `calc(100vh - 48px)`,
        color: "#fff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* LEFT SIDEBAR — filters */}
      <aside className="graph-sidebar graph-sidebar-left">
        <style>{SIDEBAR_CSS}</style>
        <h1 className="graph-sidebar-title">Scam Universe</h1>
        <div className="graph-sidebar-meta">
          {data.nodes.length} nodes · {data.edges.length} edges
          {data.generatedAt ? ` · ${data.generatedAt.slice(0, 10)}` : ""}
        </div>

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
                style={{ background: GROUP_COLOR[g] }}
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
              title={data.evidenceTiers[t]}
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
          title={selectedId ? "Arrange neighbors radially around the selected node" : "Select a node first"}
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
        <button type="button" onClick={exportPng} className="graph-action-btn">
          Export PNG (watermarked)
        </button>
        <button type="button" onClick={exportJson} className="graph-action-btn">
          Export JSON
        </button>

        <div className="graph-sidebar-note">
          Node size ∝ degree. Edge style encodes evidence tier. Internal OSINT — verify before filing.
        </div>
      </aside>

      {/* CANVAS */}
      <main
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
          {data.sourceOfTruth}
        </div>
      </main>

      {/* RIGHT SIDEBAR — detail */}
      <aside
        style={{
          background: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          padding: 14,
          overflowY: "auto",
          fontSize: 12,
        }}
      >
        {!selected ? (
          <div style={{ color: "rgba(255,255,255,0.35)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: ACCENT, marginBottom: 6 }}>
              Select a node
            </div>
            Click any node to see metadata, tier, and its connections. Edges are colour-coded by evidence tier; confirmed edges dominate so only non-confirmed ties show an individual badge.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: ACCENT, marginBottom: 4 }}>
              {selected.label}
              <TierBadge tier={selected.tier} />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {GROUP_LABEL[selected.group]}
            </div>
            <KV label="handle" value={selected.handle} />
            <KV label="risk" value={selected.risk} />
            <KV label="confidence" value={selected.confidence} />
            <KV label="rugCount" value={selected.rugCount?.toString()} />
            <KV
              label="total USD"
              value={selected.totalScammedUsd != null ? `$${selected.totalScammedUsd.toLocaleString()}` : undefined}
            />
            <KV label="chain" value={selected.chain} />
            <KV label="address" value={selected.address} mono />
            <KV label="status" value={selected.status} />
            {selected.notes && (
              <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                {selected.notes}
              </div>
            )}

            {connections && connections.all.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <SectionLabel>Connections ({connections.all.length})</SectionLabel>
                <ConnectionsSummary tally={connections.tally} />
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {connections.all.map(({ e, other, otherId, dir }, i) => (
                    <li
                      key={`${otherId}-${i}`}
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        margin: "4px 0",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onClick={() => {
                        setSelectedId(otherId);
                        focusNode(otherId);
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.3)", width: 10 }}>{dir}</span>
                      <span style={{ flex: 1 }}>
                        {other!.label}{" "}
                        <em style={{ color: "rgba(255,255,255,0.35)", fontStyle: "normal" }}>· {e.type}</em>
                      </span>
                      {e.tier !== "confirmed" && <TierBadge tier={e.tier} small />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

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
      <div style={{ width: 70, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em" }}>
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
    (t) => `${tally[t]} ${t}`
  );
  if (parts.length === 0) return null;
  return (
    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
      {parts.join(" · ")}
    </div>
  );
}
