"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  confidence: number | null;
  extractionMethod: string | null;
  sourceFileId: string | null;
};

type Props = { entities: Entity[] };

type GraphNode = d3.SimulationNodeDatum & {
  id: string;
  label: string;
  type: string;
  value: string;
  kind: "entity" | "file";
};

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
};

const COLORS: Record<string, string> = {
  WALLET: "#FF6B00",
  TX_HASH: "rgba(255,107,0,0.5)",
  HANDLE: "#FFFFFF",
  URL: "rgba(255,255,255,0.4)",
  DOMAIN: "rgba(255,255,255,0.4)",
  CONTRACT: "#FF3B5C",
  OTHER: "rgba(255,255,255,0.2)",
  FILE: "rgba(255,107,0,0.2)",
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function CaseGraph({ entities }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Apply filter to existing D3 selection without re-running the sim.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg
      .selectAll<SVGCircleElement, GraphNode>("g g circle")
      .transition()
      .duration(200)
      .attr("opacity", (d) =>
        typeFilter ? (d.type === typeFilter ? 1 : 0.15) : 1
      )
      .attr("r", (d) => {
        const base = d.kind === "file" ? 6 : 8;
        if (!typeFilter) return base;
        return d.type === typeFilter ? base + 2 : base - 2;
      });
    svg
      .selectAll<SVGTextElement, GraphNode>("g g text")
      .transition()
      .duration(200)
      .attr("opacity", (d) =>
        typeFilter ? (d.type === typeFilter ? 1 : 0.1) : 1
      );
  }, [typeFilter]);

  function zoomBy(factor: number) {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(200)
      .call(zoomRef.current.scaleBy, factor);
  }
  function resetView() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }

  useEffect(() => {
    if (entities.length < 2 || !svgRef.current) return;

    const width = svgRef.current.clientWidth || 800;
    const height = 500;

    const fileIds = new Set(
      entities.map((e) => e.sourceFileId).filter((x): x is string => !!x)
    );

    const nodes: GraphNode[] = [
      ...entities.map<GraphNode>((e) => ({
        id: e.id,
        label: truncate(e.value, 20),
        value: e.value,
        type: e.type,
        kind: "entity",
      })),
      ...Array.from(fileIds).map<GraphNode>((fid) => ({
        id: `file:${fid}`,
        label: `file ${fid.slice(0, 6)}`,
        value: fid,
        type: "FILE",
        kind: "file",
      })),
    ];

    const links: GraphLink[] = [];
    const seen = new Set<string>();
    function addLink(a: string, b: string, label: string) {
      const key = a < b ? `${a}|${b}|${label}` : `${b}|${a}|${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ source: a, target: b, label });
    }

    for (const e of entities) {
      if (e.sourceFileId) {
        addLink(e.id, `file:${e.sourceFileId}`, "from file");
      }
    }

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        if (a.sourceFileId && a.sourceFileId === b.sourceFileId) {
          addLink(a.id, b.id, "same file");
        }
        if (
          a.extractionMethod &&
          a.extractionMethod === b.extractionMethod &&
          a.type === b.type
        ) {
          addLink(a.id, b.id, "same method");
        }
      }
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const container = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    svg.on("click", (event) => {
      if (event.target === svgRef.current) setSelected(null);
    });

    const link = container
      .append("g")
      .attr("stroke", "rgba(255,255,255,0.1)")
      .attr("stroke-width", 1)
      .selectAll("line")
      .data(links)
      .join("line");

    const node = container
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => setSelected(d));

    node
      .append("circle")
      .attr("r", (d) => (d.kind === "file" ? 6 : 8))
      .attr("fill", (d) => COLORS[d.type] ?? COLORS.OTHER)
      .attr("stroke", "rgba(0,0,0,0.8)")
      .attr("stroke-width", 1.5);

    node
      .append("text")
      .text((d) => d.label)
      .attr("x", 0)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.6)")
      .attr("font-size", 10)
      .attr("font-family", "ui-monospace, monospace");

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    return () => {
      simulation.stop();
    };
  }, [entities]);

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
    <div>
      <div
        className="flex flex-wrap gap-2"
        style={{ marginBottom: 10, alignItems: "center" }}
      >
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.3)",
            marginRight: 4,
          }}
        >
          Filter
        </span>
        {["ALL", "WALLET", "TX_HASH", "HANDLE", "URL", "DOMAIN", "CONTRACT"].map(
          (t) => {
            const active = (typeFilter ?? "ALL") === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t === "ALL" ? null : t)}
                style={{
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: active
                    ? "1px solid #FF6B00"
                    : "1px solid rgba(255,255,255,0.1)",
                  backgroundColor: active
                    ? "rgba(255,107,0,0.15)"
                    : "transparent",
                  color: active ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {t}
              </button>
            );
          }
        )}
      </div>
      <div
        style={{
          backgroundColor: "#000",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {[
            { label: "+", fn: () => zoomBy(1.3), title: "Zoom in" },
            { label: "−", fn: () => zoomBy(0.77), title: "Zoom out" },
            { label: "⊙", fn: resetView, title: "Reset view" },
          ].map((btn) => (
            <button
              key={btn.title}
              type="button"
              onClick={btn.fn}
              title={btn.title}
              style={{
                width: 28,
                height: 28,
                backgroundColor: "#111",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                color: "rgba(255,255,255,0.6)",
                fontSize: 14,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <svg
          ref={svgRef}
          style={{ width: "100%", height: 500, display: "block" }}
        />
      </div>
      {/* GRAPH LEGEND */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 11,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        {[
          { label: "WALLET", color: COLORS.WALLET },
          { label: "TX_HASH", color: COLORS.TX_HASH },
          { label: "HANDLE", color: COLORS.HANDLE },
          { label: "URL", color: COLORS.URL },
          { label: "CONTRACT", color: COLORS.CONTRACT },
        ].map((row) => (
          <span
            key={row.label}
            className="flex items-center gap-1"
            style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 8,
                backgroundColor: row.color,
              }}
            />
            {row.label}
          </span>
        ))}
      </div>
      {selected && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            backgroundColor: "#0a0a0a",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {selected.type}
          </div>
          <div
            style={{
              marginTop: 4,
              color: "#FFFFFF",
              fontSize: 13,
              fontFamily: "ui-monospace, monospace",
              wordBreak: "break-all",
            }}
          >
            {selected.value}
          </div>
        </div>
      )}
    </div>
  );
}
