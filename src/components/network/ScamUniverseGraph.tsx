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

// Color palette mirrors NETWORK_GRAPH.html. Brand accent #FF6B00 stays on
// UI chrome; the nine group colors are categorical.
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

const TIER_LABEL: Record<EvidenceTier, string> = {
  confirmed: "Confirmed",
  strong: "Strong",
  suspected: "Suspected",
  alleged: "Alleged",
};

const TIER_STROKE: Record<EvidenceTier, string> = {
  confirmed: "#d0d0d0",
  strong: "#b0b0b0",
  suspected: "#808080",
  alleged: "#505050",
};

const TIER_DASH: Record<EvidenceTier, string | null> = {
  confirmed: null,
  strong: "6 2",
  suspected: "3 3",
  alleged: "1 3",
};

const ACCENT = "#FF6B00";
const SVG_HEIGHT = 600;

type SimNode = d3.SimulationNodeDatum & NetworkNode & { r: number };
type SimEdge = d3.SimulationLinkDatum<SimNode> & NetworkEdge;

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

function edgeEndpoint(v: SimEdge["source"] | SimEdge["target"]): string {
  return typeof v === "string" ? v : (v as SimNode).id;
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

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n, r: nodeRadius(n) }));
    const edges: SimEdge[] = data.edges.map((e) => ({ ...e }));
    nodesRef.current = nodes;
    edgesRef.current = edges;

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
      if (ev.target === svgRef.current) setSelectedId(null);
    });

    const linkSel = root
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, SimEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => TIER_STROKE[d.tier])
      .attr("stroke-width", (d) => (d.tier === "confirmed" ? 1.6 : 1))
      .attr("stroke-dasharray", (d) => TIER_DASH[d.tier])
      .attr("stroke-opacity", 0.55);
    linkSel.append("title").text((d) => `${d.type}${d.label ? ": " + d.label : ""} [${d.tier}]`);

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

    nodeG
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => GROUP_COLOR[d.group])
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5);

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
    svg
      .selectAll<SVGLineElement, SimEdge>(".links line")
      .classed("dim", (d) => {
        const sId = edgeEndpoint(d.source);
        const tId = edgeEndpoint(d.target);
        const s = data.nodes.find((n) => n.id === sId);
        const t = data.nodes.find((n) => n.id === tId);
        if (!s || !t) return true;
        if (!activeTiers.has(d.tier)) return true;
        if (!activeGroups.has(s.group) || !activeGroups.has(t.group)) return true;
        if (matchIds && !matchIds.has(sId) && !matchIds.has(tId)) return true;
        return false;
      });
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
      <aside
        style={{
          background: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          padding: 12,
          overflowY: "auto",
          fontSize: 12,
        }}
      >
        <h1 style={{ fontSize: 13, color: ACCENT, margin: "0 0 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Scam Universe
        </h1>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
          {data.nodes.length} nodes · {data.edges.length} edges · {data.generatedAt}
        </div>

        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            background: "#111",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: 4,
            fontSize: 11,
            marginBottom: 14,
          }}
        />

        <SectionLabel>Groups</SectionLabel>
        {GROUP_VALUES.map((g) => {
          const active = activeGroups.has(g);
          const count = data.nodes.filter((n) => n.group === g).length;
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGroup(g)}
              style={legendButton(active)}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 10,
                  background: GROUP_COLOR[g],
                  display: "inline-block",
                  marginRight: 8,
                }}
              />
              <span style={{ flex: 1, textAlign: "left" }}>{GROUP_LABEL[g]}</span>
              <span style={{ opacity: 0.45, fontSize: 10 }}>{count}</span>
            </button>
          );
        })}

        <SectionLabel>Evidence tier</SectionLabel>
        {TIER_VALUES.map((t) => {
          const active = activeTiers.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTier(t)}
              style={legendButton(active)}
              title={data.evidenceTiers[t]}
            >
              <svg width={22} height={6} style={{ marginRight: 8, flex: "0 0 22px" }}>
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
              <span style={{ flex: 1, textAlign: "left" }}>{TIER_LABEL[t]}</span>
            </button>
          );
        })}

        <SectionLabel>Layout</SectionLabel>
        <button
          type="button"
          onClick={() => setRadialMode((v) => !v)}
          style={legendButton(radialMode)}
          disabled={!selectedId}
          title={selectedId ? "Arrange neighbors radially around the selected node" : "Select a node first"}
        >
          <span style={{ flex: 1, textAlign: "left" }}>Radial around selection</span>
        </button>
        <button type="button" onClick={zoomToFit} style={actionButton}>
          Zoom to fit visible
        </button>
        <button type="button" onClick={resetView} style={actionButton}>
          Reset view
        </button>

        <SectionLabel>Export</SectionLabel>
        <button type="button" onClick={exportPng} style={actionButton}>
          Export PNG (watermarked)
        </button>
        <button type="button" onClick={exportJson} style={actionButton}>
          Export JSON
        </button>

        <div style={{ marginTop: 16, fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
          Node size ∝ documented USD loss (persons). Edge style encodes evidence tier. Internal OSINT — verify before filing.
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
