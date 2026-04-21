import type { ConstellationSnapshot, GraphNode, GraphEdge } from "@/lib/contracts/website";
import { signal, risk, caution, cleared, bone } from "@/lib/design-system";

/**
 * Public Constellation snapshot renderer.
 *
 * Server component — renders a deterministic SVG from the frozen snapshot.
 * No live polling, no randomness: same schema as the investigator graph but
 * with coordinates baked in. The investigator app runs a separate live graph
 * (different component) on the same GraphData shape.
 */

const NODE_RADIUS: Record<GraphNode["kind"], number> = {
  token: 14,
  wallet: 8,
  kol: 12,
  cex: 10,
  bridge: 9,
  evidence: 7,
};

const NODE_FILL = (n: GraphNode): string => {
  if (n.verdict === "critical" || n.verdict === "high") return risk.base;
  if (n.verdict === "elevated") return signal.base;
  if (n.verdict === "monitoring") return caution.base;
  if (n.verdict === "cleared") return cleared.base;
  return bone.base;
};

const EDGE_STROKE: Record<GraphEdge["kind"], string> = {
  transaction: "rgba(243,240,232,0.25)",
  kol_relation: signal.base,
  suspicious: risk.base,
  money_flow: cleared.base,
};

const EDGE_DASH: Record<GraphEdge["kind"], string | undefined> = {
  transaction: undefined,
  kol_relation: undefined,
  suspicious: "6 4",
  money_flow: "2 3",
};

function computeViewBox(nodes: GraphNode[]): string {
  if (nodes.length === 0) return "0 0 1000 600";
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const pad = 60;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) - x0 + pad;
  const h = Math.max(...ys) - y0 + pad;
  return `${x0} ${y0} ${w} ${h}`;
}

export function ConstellationCanvas({ snapshot }: { snapshot: ConstellationSnapshot }) {
  const { nodes, edges } = snapshot.graph;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const viewBox = computeViewBox(nodes);

  return (
    <div className="fx-constellation" role="img" aria-label="Case constellation">
      <svg className="fx-constellation__svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        {/* edges */}
        <g fill="none">
          {edges.map((e) => {
            const s = byId.get(e.source);
            const t = byId.get(e.target);
            if (!s || !t) return null;
            return (
              <line
                key={e.id}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={EDGE_STROKE[e.kind]}
                strokeWidth={e.kind === "suspicious" ? 1.5 : 1}
                strokeDasharray={EDGE_DASH[e.kind]}
                opacity={0.9}
              />
            );
          })}
        </g>
        {/* nodes */}
        <g>
          {nodes.map((n) => (
            <g key={n.id}>
              <circle
                cx={n.x} cy={n.y} r={n.r ?? NODE_RADIUS[n.kind]}
                fill={NODE_FILL(n)}
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={1}
              />
              <text
                x={n.x} y={(n.r ?? NODE_RADIUS[n.kind]) + n.y + 14}
                fontFamily='"JetBrains Mono", monospace'
                fontSize={10}
                fill={bone.dim}
                textAnchor="middle"
                letterSpacing={1}
              >
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className="fx-constellation__legend" aria-hidden>
        <span className="fx-constellation__swatch" style={{ background: risk.base }} />
        <span>Critical / High</span>
        <span className="fx-constellation__swatch" style={{ background: signal.base }} />
        <span>Elevated</span>
        <span className="fx-constellation__swatch" style={{ background: caution.base }} />
        <span>Monitoring</span>
        <span className="fx-constellation__swatch" style={{ background: cleared.base }} />
        <span>Cleared</span>
      </div>
    </div>
  );
}
