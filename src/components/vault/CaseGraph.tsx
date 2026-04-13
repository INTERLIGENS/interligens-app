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
  const [selected, setSelected] = useState<GraphNode | null>(null);

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
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

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
        style={{
          backgroundColor: "#000",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <svg
          ref={svgRef}
          style={{ width: "100%", height: 500, display: "block" }}
        />
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
