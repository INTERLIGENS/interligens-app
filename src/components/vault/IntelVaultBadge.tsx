// src/components/vault/IntelVaultBadge.tsx
"use client";
import { useEffect, useRef, useState } from "react";

export interface IntelVaultData {
  match: boolean;
  categories: string[];
  topLabel?: string;
  confidence?: "low" | "medium" | "high";
  severity?: "info" | "warn" | "danger";
  explainAvailable?: boolean;
}

interface Props {
  intelVault: IntelVaultData | null | undefined;
  locale?: "en" | "fr";
}

// ── i18n copy ──────────────────────────────────────────────────────────────────
const COPY = {
  en: {
    title: "Intel Vault",
    severity: { info: "Intel (info)", warn: "Watchlist", danger: "High-risk list" },
    label: (v: string) => `Label: ${v}`,
    confidence: { low: "Confidence: Low", medium: "Confidence: Medium", high: "Confidence: High" },
    feeds: (n: number) => `Feeds matched: ${n}`,
  },
  fr: {
    title: "Intel Vault",
    severity: { info: "Info", warn: "Surveillance", danger: "Liste à risque" },
    label: (v: string) => `Label : ${v}`,
    confidence: { low: "Confiance : Faible", medium: "Confiance : Moyen", high: "Confiance : Élevé" },
    feeds: (n: number) => `Sources matchées : ${n}`,
  },
} as const;

const CATEGORY_LABELS: Record<string, { en: string; fr: string }> = {
  airdrop_target:  { en: "Airdrop target",    fr: "Cible d'airdrop" },
  whale:           { en: "Whale",              fr: "Whale" },
  scam:            { en: "Scam",               fr: "Arnaque" },
  phishing:        { en: "Phishing",           fr: "Hameçonnage" },
  drainer:         { en: "Drainer",            fr: "Drainer" },
  exploiter:       { en: "Exploiter",          fr: "Exploit" },
  insider:         { en: "Insider",            fr: "Insider" },
  kol:             { en: "KOL",                fr: "KOL" },
  cluster_member:  { en: "Cluster link",       fr: "Lien de cluster" },
  incident_related:{ en: "Incident-related",   fr: "Lié à un incident" },
  other:           { en: "Intel",              fr: "Intel" },
};

function catLabel(cat: string, locale: "en" | "fr"): string {
  return CATEGORY_LABELS[cat]?.[locale] ?? cat;
}

// ── Severity styles ────────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  info:   { border: "border-blue-500/30",   glow: "shadow-blue-500/10",   badge: "bg-blue-500/15 text-blue-300",   dot: "bg-blue-400" },
  warn:   { border: "border-yellow-500/30", glow: "shadow-yellow-500/10", badge: "bg-yellow-500/15 text-yellow-300", dot: "bg-yellow-400" },
  danger: { border: "border-red-500/30",    glow: "shadow-red-500/10",    badge: "bg-red-500/15 text-red-300",     dot: "bg-red-400" },
};

// ── Chip ───────────────────────────────────────────────────────────────────────
function Chip({ label, severity }: { label: string; severity: "info" | "warn" | "danger" }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${s.badge} border border-current/20`}>
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function IntelVaultBadge({ intelVault, locale = "en" }: Props) {
  const [visible, setVisible] = useState(false);
  const prevMatch = useRef(false);
  const t = COPY[locale];

  useEffect(() => {
    if (intelVault?.match && !prevMatch.current) {
      // Small delay so CSS transition triggers
      const id = setTimeout(() => setVisible(true), 10);
      prevMatch.current = true;
      return () => clearTimeout(id);
    }
    if (!intelVault?.match) {
      setVisible(false);
      prevMatch.current = false;
    }
  }, [intelVault?.match]);

  if (!intelVault?.match) return null;

  const sev = intelVault.severity ?? "info";
  const s = SEVERITY_STYLES[sev];
  const cats = intelVault.categories ?? [];
  const visibleCats = cats.slice(0, 3);
  const overflow = cats.length - visibleCats.length;
  const feedsCount = cats.length;

  return (
    <div
      role="status"
      aria-label="Intel Vault match"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
      className={`
        w-full rounded-xl px-4 py-3
        bg-gray-900/80 backdrop-blur-sm
        border ${s.border}
        shadow-lg ${s.glow}
        flex flex-col gap-2
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          <span className="text-xs font-semibold text-gray-200 tracking-wide uppercase">
            {t.title}
          </span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
          {t.severity[sev]}
        </span>
      </div>

      {/* Category chips */}
      {visibleCats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleCats.map(cat => (
            <Chip key={cat} label={catLabel(cat, locale)} severity={sev} />
          ))}
          {overflow > 0 && (
            <span className="text-[11px] text-gray-500">+{overflow}</span>
          )}
          {intelVault.topLabel && (
            <span className="text-[11px] text-gray-400 ml-1">
              {t.label(intelVault.topLabel)}
            </span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between">
        {intelVault.confidence && (
          <span className="text-[11px] text-gray-500">
            {t.confidence[intelVault.confidence]}
          </span>
        )}
        <span className="text-[11px] text-gray-600 ml-auto">
          {t.feeds(feedsCount)}
        </span>
      </div>
    </div>
  );
}

export default IntelVaultBadge;
