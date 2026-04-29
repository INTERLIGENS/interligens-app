import React, { useEffect, useRef, useState } from "react";

export type WidgetTier = "GREEN" | "ORANGE" | "RED";

export interface InterligensWidgetProps {
  address: string;
  partnerKey: string;
  apiBase?: string;
  size?: number;
}

interface ScoreResult {
  score: number;
  tier: WidgetTier;
  verdict: string;
  error?: never;
}
interface ScoreError {
  error: string;
  score?: never;
}
type ScoreState = ScoreResult | ScoreError | null;

const TIER_COLOR: Record<WidgetTier, string> = {
  GREEN:  "#00C853",
  ORANGE: "#FF6B00",
  RED:    "#FF1744",
};

function Ring({ score, tier, size }: { score: number; tier: WidgetTier; size: number }) {
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = ((100 - score) / 100) * circ;
  const color = TIER_COLOR[tier];

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ffffff1a" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${circ}`}
        strokeDashoffset={progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.9s ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 700, fontFamily: "sans-serif" }}>
        {score}
      </text>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        dy={size * 0.18}
        style={{ fill: "#ffffff80", fontSize: size * 0.1, fontFamily: "sans-serif" }}>
        {tier}
      </text>
    </svg>
  );
}

function Spinner({ size }: { size: number }) {
  const r = (size - 16) / 2;
  return (
    <svg width={size} height={size} style={{ display: "block", animation: "iw-spin 1s linear infinite" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff1a" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FF6B00"
        strokeWidth={8} strokeDasharray={`${r * 1.5} ${2 * Math.PI * r}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

export function InterligensWidget({
  address,
  partnerKey,
  apiBase = "https://app.interligens.com",
  size = 120,
}: InterligensWidgetProps) {
  const [state, setState] = useState<ScoreState>(null);
  const cacheRef = useRef<Record<string, ScoreResult>>({});

  useEffect(() => {
    if (!address || !partnerKey) return;
    if (cacheRef.current[address]) { setState(cacheRef.current[address]); return; }
    setState(null);
    fetch(`${apiBase}/api/partner/v1/score-lite?address=${encodeURIComponent(address)}`, {
      headers: { "X-Partner-Key": partnerKey },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setState({ error: d.error }); return; }
        const result: ScoreResult = { score: d.score, tier: d.tier, verdict: d.verdict };
        cacheRef.current[address] = result;
        setState(result);
      })
      .catch(() => setState({ error: "fetch_failed" }));
  }, [address, partnerKey, apiBase]);

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    maxWidth: size,
  };

  const linkStyle: React.CSSProperties = {
    fontSize: 9,
    color: "#ffffff50",
    textDecoration: "none",
    fontFamily: "sans-serif",
    letterSpacing: "0.05em",
  };

  return (
    <div style={containerStyle}>
      <style>{`@keyframes iw-spin { to { transform: rotate(360deg); transform-origin: center; } }`}</style>
      {!state ? (
        <Spinner size={size} />
      ) : "error" in state ? (
        <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#ff1744", fontSize: 10, fontFamily: "sans-serif", textAlign: "center" }}>
            unavailable
          </span>
        </div>
      ) : (
        <Ring score={state.score} tier={state.tier} size={size} />
      )}
      <a href="https://app.interligens.com" target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Powered by INTERLIGENS
      </a>
    </div>
  );
}

export default InterligensWidget;
