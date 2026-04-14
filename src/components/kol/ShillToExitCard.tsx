"use client";

import { useEffect, useState } from "react";

type Signal = {
  handle: string;
  tokenCA: string;
  tokenSymbol: string;
  shillDate: string;
  exitDate: string;
  hoursToExit: number;
  amountUsd: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  evidence: string[];
  postUrl?: string;
  txHash: string;
};

type ApiResponse = {
  handle: string;
  signals: Signal[];
  fallback: boolean;
};

type Lang = "en" | "fr";

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Shill-to-Exit",
    subtitle: "Promoted then sold — matched on-chain",
    critical_tag: "Sold within 24h of promoting",
    high_tag: "Sold within 72h of promoting",
    medium_tag: "Sold within 7 days of promoting",
    shilled: "Shilled",
    on: "on",
    sold: "Sold",
    deposited: "CEX deposit",
    delay: "Delay",
    amount: "Amount",
    post: "Source post",
    tx: "Transaction",
    no_signals_hidden: "",
  },
  fr: {
    title: "Shill-to-Exit",
    subtitle: "A promu puis vendu — prouvé on-chain",
    critical_tag: "Vendu dans les 24h après le shill",
    high_tag: "Vendu dans les 72h après le shill",
    medium_tag: "Vendu dans les 7 jours après le shill",
    shilled: "A promu",
    on: "le",
    sold: "Vendu",
    deposited: "Dépôt CEX",
    delay: "Délai",
    amount: "Montant",
    post: "Post source",
    tx: "Transaction",
    no_signals_hidden: "",
  },
};

function severityColor(sev: Signal["severity"]): { fg: string; border: string; bg: string } {
  if (sev === "CRITICAL") {
    return { fg: "#FF3B5C", border: "rgba(255,59,92,0.4)", bg: "rgba(255,59,92,0.06)" };
  }
  if (sev === "HIGH") {
    return { fg: "#FF6B00", border: "rgba(255,107,0,0.5)", bg: "rgba(255,107,0,0.06)" };
  }
  return { fg: "#FFB020", border: "rgba(255,176,32,0.4)", bg: "rgba(255,176,32,0.05)" };
}

function formatDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDelay(hours: number, lang: Lang): string {
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return lang === "fr" ? `${days.toFixed(1)} jours` : `${days.toFixed(1)} days`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export default function ShillToExitCard({
  handle,
  lang = "en",
}: {
  handle: string;
  lang?: Lang;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/kol/${encodeURIComponent(handle)}/shill-to-exit`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ handle, signals: [], fallback: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) return null;
  if (!data || data.signals.length === 0) return null;

  const t = COPY[lang];
  return (
    <section
      aria-labelledby="shill-to-exit-title"
      style={{
        backgroundColor: "#000000",
        border: "1px solid rgba(255,107,0,0.2)",
        borderRadius: 8,
        padding: 20,
        marginTop: 24,
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "#FF6B00",
          marginBottom: 4,
        }}
      >
        {t.title}
      </div>
      <h2
        id="shill-to-exit-title"
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#FFFFFF",
          margin: "0 0 18px 0",
          lineHeight: 1.3,
        }}
      >
        {t.subtitle}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.signals.slice(0, 10).map((s, i) => {
          const colors = severityColor(s.severity);
          const tag =
            s.severity === "CRITICAL"
              ? t.critical_tag
              : s.severity === "HIGH"
                ? t.high_tag
                : t.medium_tag;
          return (
            <article
              key={`${s.tokenCA}-${s.txHash}-${i}`}
              style={{
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: colors.fg,
                    fontWeight: 700,
                  }}
                >
                  {s.severity} · {tag}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "ui-monospace, monospace",
                    color: "#FFFFFF",
                  }}
                >
                  {s.tokenSymbol}
                </span>
              </header>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto 1fr auto",
                  columnGap: 10,
                  rowGap: 4,
                  alignItems: "center",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{t.shilled}</span>
                <span>{formatDate(s.shillDate, lang)}</span>
                <span style={{ color: colors.fg, fontWeight: 700, padding: "0 6px" }}>→</span>
                <span>
                  {s.hoursToExit < 24
                    ? formatDate(s.exitDate, lang)
                    : formatDate(s.exitDate, lang)}
                </span>
                <span style={{ color: "#FFFFFF", fontWeight: 700 }}>{formatUsd(s.amountUsd)}</span>
              </div>

              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                {t.delay}: {formatDelay(s.hoursToExit, lang)}
              </div>

              {(s.postUrl || s.txHash) && (
                <footer
                  style={{
                    display: "flex",
                    gap: 14,
                    marginTop: 4,
                    fontSize: 11,
                  }}
                >
                  {s.postUrl && (
                    <a
                      href={s.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "rgba(255,107,0,0.7)",
                        textDecoration: "none",
                      }}
                    >
                      {t.post} ↗
                    </a>
                  )}
                  {s.txHash && (
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {t.tx}: {s.txHash.slice(0, 10)}…{s.txHash.slice(-6)}
                    </span>
                  )}
                </footer>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
