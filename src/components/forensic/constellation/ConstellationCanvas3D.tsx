"use client";

/**
 * 3D Constellation canvas — POC only. Rendered exclusively from
 * /demo/constellation. Reuses the frozen forensic palette
 * (ink / bone / signal / risk / caution / cleared) — no new tokens.
 *
 * Design constraints locked by the POC mission:
 *   - No post-processing (no bloom, no DoF, no SSAO).
 *   - Node radius bound to role taxonomy, not arbitrary.
 *   - Autopilot rotates 1 turn / 60s on Y. User interaction cuts it
 *     instantly (mousedown / wheel / touchstart). After 3s of inactivity
 *     it resumes with a 1.5s ease-in.
 *   - Hover raises a node to 1.15×, connected edges go opaque, the rest
 *     fade to 0.10.
 *   - prefers-reduced-motion disables autopilot entirely.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import { MeshBasicMaterial, SphereGeometry, Mesh, Color } from "three";
import type {
  DemoConstellationNode,
} from "@/lib/mocks/constellation-demo-01";
import type { GraphEdge, GraphData } from "@/lib/contracts/website";

type Role = DemoConstellationNode["demoRole"];

interface Props {
  graph: GraphData & { nodes: DemoConstellationNode[] };
  onNodeClick?: (node: DemoConstellationNode) => void;
  autopilotOverrideCallback?: (running: boolean) => void;
}

// Palette — frozen forensic tokens. No cyan. Every value sourced from
// src/lib/design-system/tokens.css.
const INK = "#000000";
const SIGNAL = "#ff6b00";
const RISK = "#ff3347";
const CAUTION = "#ffb000";
const BONE = "#f3f0e8";

// Role → node colour. Deployer is the accent; insiders red; relays and
// bridges orange-warn; LPs the caution amber; CEX the bone neutral (they
// receive funds but are not the perpetrators); counterparties muted.
const ROLE_COLOR: Record<Role, string> = {
  deployer: SIGNAL,
  insider: RISK,
  lp: CAUTION,
  relay: SIGNAL,
  bridge: SIGNAL,
  cex: BONE,
  counterparty: "#555555",
};

const ROLE_SIZE: Record<Role, number> = {
  deployer: 9,
  insider: 6,
  cex: 6,
  lp: 5,
  relay: 4,
  bridge: 6,
  counterparty: 3,
};

const EDGE_KIND_COLOR: Record<GraphEdge["kind"], string> = {
  transaction: BONE,
  money_flow: SIGNAL,
  suspicious: RISK,
  kol_relation: CAUTION,
};

// Autopilot rotation — 1 turn / 60 s.
const AUTOPILOT_TURN_MS = 60_000;
// Inactivity before autopilot picks back up.
const AUTOPILOT_RESUME_DELAY_MS = 3_000;
// Ease-in length when resuming.
const AUTOPILOT_EASE_MS = 1_500;

// Orbit-camera helper — compute (x, z) for a given angle and distance.
function orbit(
  distance: number,
  angle: number,
  height: number,
): { x: number; y: number; z: number } {
  return {
    x: Math.sin(angle) * distance,
    y: height,
    z: Math.cos(angle) * distance,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ConstellationCanvas3D({
  graph,
  onNodeClick,
  autopilotOverrideCallback,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  // Autopilot state
  const autopilotRef = useRef({
    running: !reducedMotion,
    lastInteractionAt: 0,
    // Angle the virtual camera sits at. Updated by the rAF loop.
    angle: 0,
    // Ease-in multiplier when resuming (0 → 1).
    ease: 1,
    easeStartAt: 0,
  });

  const setAutopilotRunning = useCallback((running: boolean) => {
    autopilotRef.current.running = running;
    autopilotOverrideCallback?.(running);
  }, [autopilotOverrideCallback]);

  // Resize observer so the force graph tracks its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Node object — a coloured sphere. Kept tiny: no lighting, no materials
  // that need the renderer to update per frame. Colour alpha is mirrored
  // off hover state.
  const nodeThreeObject = useCallback(
    (node: DemoConstellationNode) => {
      const base = ROLE_COLOR[node.demoRole];
      const size = ROLE_SIZE[node.demoRole];
      const isHover = hoveredId === node.id;
      const isAnyHover = hoveredId !== null;

      // Dim non-hovered nodes when *some* node is hovered.
      const dimmed = isAnyHover && !isHover;
      const material = new MeshBasicMaterial({
        color: new Color(base),
        transparent: true,
        opacity: dimmed ? 0.18 : 1,
      });
      const geometry = new SphereGeometry(
        isHover ? size * 1.15 : size,
        24,
        24,
      );
      return new Mesh(geometry, material);
    },
    [hoveredId],
  );

  // Edge colouring + opacity tied to hover.
  const connectedEdgeIds = useMemo(() => {
    if (!hoveredId) return null;
    const ids = new Set<string>();
    for (const edge of graph.edges) {
      const src = typeof edge.source === "string" ? edge.source : (edge.source as DemoConstellationNode).id;
      const tgt = typeof edge.target === "string" ? edge.target : (edge.target as DemoConstellationNode).id;
      if (src === hoveredId || tgt === hoveredId) ids.add(edge.id);
    }
    return ids;
  }, [hoveredId, graph.edges]);

  const linkColor = useCallback(
    (edge: GraphEdge) => {
      const base = EDGE_KIND_COLOR[edge.kind] ?? BONE;
      if (!connectedEdgeIds) {
        // Neutral, verdict-driven edge tinting.
        return hexWithAlpha(base, edge.kind === "suspicious" ? 0.55 : 0.35);
      }
      const isConnected = connectedEdgeIds.has(edge.id);
      return hexWithAlpha(base, isConnected ? 1 : 0.1);
    },
    [connectedEdgeIds],
  );

  const linkWidth = useCallback(
    (edge: GraphEdge) => {
      if (!connectedEdgeIds) return edge.kind === "suspicious" ? 1.2 : 0.6;
      return connectedEdgeIds.has(edge.id) ? 1.8 : 0.4;
    },
    [connectedEdgeIds],
  );

  // Autopilot + interaction handling.
  useEffect(() => {
    if (reducedMotion) return;
    const el = containerRef.current;
    if (!el) return;

    let frame = 0;
    let cancelled = false;
    const state = autopilotRef.current;
    const start = performance.now();
    state.easeStartAt = start;
    state.ease = 1;

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = 16; // logical step, keeps rotation independent of fps
      if (state.running) {
        // Re-engage easing from 0 → 1 if we just resumed.
        const sinceEase = now - state.easeStartAt;
        const easeFactor =
          sinceEase >= AUTOPILOT_EASE_MS
            ? 1
            : Math.min(1, sinceEase / AUTOPILOT_EASE_MS);
        state.ease = easeFactor;
        state.angle += (dt / AUTOPILOT_TURN_MS) * Math.PI * 2 * easeFactor;

        const fg = fgRef.current;
        if (fg) {
          const cam = orbit(700, state.angle, 140);
          fg.cameraPosition(cam, { x: 0, y: 0, z: 0 }, 0);
        }
      } else {
        // When paused, check if the 3s idle window elapsed.
        const idle = now - state.lastInteractionAt;
        if (idle > AUTOPILOT_RESUME_DELAY_MS) {
          state.running = true;
          state.easeStartAt = now;
          state.ease = 0;
          autopilotOverrideCallback?.(true);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onInteract = () => {
      state.running = false;
      state.lastInteractionAt = performance.now();
      autopilotOverrideCallback?.(false);
    };

    el.addEventListener("mousedown", onInteract, { passive: true });
    el.addEventListener("wheel", onInteract, { passive: true });
    el.addEventListener("touchstart", onInteract, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      el.removeEventListener("mousedown", onInteract);
      el.removeEventListener("wheel", onInteract);
      el.removeEventListener("touchstart", onInteract);
    };
  }, [reducedMotion, autopilotOverrideCallback]);

  // react-force-graph-3d expects `{ nodes, links }` — our contract shape
  // uses `edges`. Map in-place without mutating the source.
  const forceGraphData = useMemo(
    () => ({
      nodes: graph.nodes,
      links: graph.edges.map((e) => ({ ...e, source: e.source, target: e.target })),
    }),
    [graph],
  );

  // Fallback for browsers without WebGL — surface the static image.
  // Checked once on mount with a layout-time side-effect so the initial
  // paint already knows which branch to render (no cascade from an
  // in-effect setState).
  const [webglOk] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  });

  if (!webglOk) {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          background: INK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/constellation-fallback.png"
          alt="Static preview of the 3D forensic constellation."
          style={{ maxWidth: "100%", maxHeight: "100%", opacity: 0.9 }}
        />
      </div>
    );
  }

  const { width, height } = containerSize;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        background: INK,
        position: "relative",
      }}
    >
      <canvas
        aria-hidden="true"
        style={{ display: "none" }}
      />
      <div
        role="img"
        aria-label="Interactive 3D synthetic forensic graph, 45 nodes, demonstrating INTERLIGENS analytical coverage"
        style={{ width: "100%", height: "100%" }}
      >
        {width > 0 && height > 0 && (
          <ForceGraph3D
            ref={fgRef}
            graphData={forceGraphData}
            width={width}
            height={height}
            backgroundColor={INK}
            showNavInfo={false}
            nodeRelSize={4}
            nodeLabel={(n: DemoConstellationNode) => n.display}
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend={false}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkOpacity={0.8}
            linkDirectionalParticles={0}
            enableNodeDrag
            enableNavigationControls
            onNodeHover={(n) => setHoveredId((n as DemoConstellationNode | null)?.id ?? null)}
            onNodeClick={(n) => {
              setAutopilotRunning(false);
              autopilotRef.current.lastInteractionAt = performance.now();
              onNodeClick?.(n as DemoConstellationNode);
            }}
            onBackgroundClick={() => setHoveredId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
