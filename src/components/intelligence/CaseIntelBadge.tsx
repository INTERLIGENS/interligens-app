// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence Badge + Drawer — Scanner integration
// Shows when a scanned address has a match in CanonicalEntity (RETAIL_SAFE).
// ─────────────────────────────────────────────────────────────────────────────

"use client";
import { useEffect, useRef, useState } from "react";

interface CaseIntelData {
  match: boolean;
  ims: number;
  ics: number;
  matchCount: number;
  hasSanction: boolean;
  topRiskClass: string | null;
  sourceSlug: string | null;
  externalUrl: string | null;
  matchBasis: string | null;
}

interface Props {
  address: string;
  chain?: string;
  locale?: "en" | "fr";
}

// ── i18n copy ────────────────────────────────────────────────────────────────

const COPY = {
  en: {
    title: "Case Intelligence",
    sanction: "SANCTIONED ENTITY",
    risk: {
      SANCTION: "Sanctioned",
      HIGH: "High Risk",
      MEDIUM: "Flagged",
      LOW: "Low Signal",
    } as Record<string, string>,
    source: "Source",
    basis: "Match basis",
    score: "Intel Match Score",
    corroboration: "Corroboration",
    sources: (n: number) => `${n} source${n > 1 ? "s" : ""} confirm`,
    details: "View details",
    collapse: "Collapse",
  },
  fr: {
    title: "Case Intelligence",
    sanction: "ENTITÉ SANCTIONNÉE",
    risk: {
      SANCTION: "Sanctionné",
      HIGH: "Risque élevé",
      MEDIUM: "Signalé",
      LOW: "Signal faible",
    } as Record<string, string>,
    source: "Source",
    basis: "Base de correspondance",
    score: "Score Intel",
    corroboration: "Corroboration",
    sources: (n: number) => `${n} source${n > 1 ? "s" : ""} confirmé${n > 1 ? "es" : "e"}`,
    details: "Voir détails",
    collapse: "Réduire",
  },
} as const;

// ── Severity mapping ─────────────────────────────────────────────────────────

function getSeverity(data: CaseIntelData): "critical" | "danger" | "warn" | "info" {
  if (data.hasSanction) return "critical";
  if (data.topRiskClass === "HIGH") return "danger";
  if (data.topRiskClass === "MEDIUM") return "warn";
  return "info";
}

const SEV_STYLES = {
  critical: {
    border: "border-red-600/50",
    glow: "shadow-red-600/20",
    badge: "bg-red-600/20 text-red-300",
    dot: "bg-red-500",
    bar: "#ef4444",
  },
  danger: {
    border: "border-orange-500/40",
    glow: "shadow-orange-500/15",
    badge: "bg-orange-500/15 text-orange-300",
    dot: "bg-orange-400",
    bar: "#f97316",
  },
  warn: {
    border: "border-yellow-500/30",
    glow: "shadow-yellow-500/10",
    badge: "bg-yellow-500/15 text-yellow-300",
    dot: "bg-yellow-400",
    bar: "#eab308",
  },
  info: {
    border: "border-blue-500/30",
    glow: "shadow-blue-500/10",
    badge: "bg-blue-500/15 text-blue-300",
    dot: "bg-blue-400",
    bar: "#3b82f6",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  ofac: "OFAC SDN List",
  amf: "AMF Blacklist",
  fca: "FCA Warning List",
  scamsniffer: "ScamSniffer",
  forta: "Forta Scam Detector",
  goplus: "GoPlus Security",
};

const BASIS_LABELS: Record<string, string> = {
  EXACT_ADDRESS: "Exact address match",
  EXACT_CONTRACT: "Exact contract match",
  EXACT_DOMAIN: "Exact domain match",
  EXACT_TOKEN_CA: "Exact token CA match",
  INFERRED_LINKAGE: "Inferred linkage",
  FUZZY_ALIAS: "Fuzzy alias match",
};

// ── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500 w-24 shrink-0 uppercase tracking-wider font-semibold">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold text-gray-300 w-8 text-right font-mono">
        {value}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CaseIntelBadge({ address, chain, locale = "en" }: Props) {
  const [data, setData] = useState<CaseIntelData | null>(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevMatch = useRef(false);
  const t = COPY[locale];

  useEffect(() => {
    if (!address) return;
    setData(null);
    setVisible(false);
    setExpanded(false);
    prevMatch.current = false;

    const ctrl = new AbortController();
    fetch(
      `/api/scan/intelligence?value=${encodeURIComponent(address)}${chain ? `&chain=${chain}` : ""}`,
      { signal: ctrl.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.match) {
          setData(d);
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [address, chain]);

  useEffect(() => {
    if (data?.match && !prevMatch.current) {
      const id = setTimeout(() => setVisible(true), 10);
      prevMatch.current = true;
      return () => clearTimeout(id);
    }
    if (!data?.match) {
      setVisible(false);
      prevMatch.current = false;
    }
  }, [data?.match]);

  if (!data?.match) return null;

  const sev = getSeverity(data);
  const s = SEV_STYLES[sev];

  return (
    <div
      role="alert"
      aria-label="Case Intelligence match"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
      className={`
        w-full rounded-xl
        bg-gray-900/80 backdrop-blur-sm
        border ${s.border}
        shadow-lg ${s.glow}
        overflow-hidden
      `}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${s.dot} ${sev === "critical" ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold text-gray-200 tracking-wide uppercase">
            {t.title}
          </span>
          {data.hasSanction && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 tracking-wider uppercase">
              {t.sanction}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
            {t.risk[data.topRiskClass ?? ""] ?? data.topRiskClass}
          </span>
          <span className="text-gray-600 text-xs">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {/* Expandable drawer */}
      <div
        style={{
          maxHeight: expanded ? 300 : 0,
          opacity: expanded ? 1 : 0,
          transition: "max-height 250ms ease, opacity 200ms ease",
          overflow: "hidden",
        }}
      >
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {/* Score bars */}
          <ScoreBar value={data.ims} label={t.score} color={s.bar} />
          <ScoreBar value={data.ics} label={t.corroboration} color={s.bar} />

          {/* Source info */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
            <div>
              <span className="text-gray-500">{t.source}: </span>
              <span className="text-gray-300 font-semibold">
                {SOURCE_LABELS[data.sourceSlug ?? ""] ?? data.sourceSlug}
              </span>
            </div>
            <div>
              <span className="text-gray-500">{t.basis}: </span>
              <span className="text-gray-300 font-semibold">
                {BASIS_LABELS[data.matchBasis ?? ""] ?? data.matchBasis}
              </span>
            </div>
            <div>
              <span className="text-gray-500">{t.sources(data.matchCount)}</span>
            </div>
          </div>

          {/* External link */}
          {data.externalUrl && (
            <a
              href={data.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
            >
              {t.details} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default CaseIntelBadge;
