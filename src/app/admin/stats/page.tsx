"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const ACCENT = "#FF6B00";
const BG = "#000000";

type Stats = {
  scansToday: number;
  scansWeek: number;
  askToday: number;
  askWeek: number;
  watchlist: number;
  investigators: number;
  cases: number;
  kolPublished: number;
  chartData?: { date: string; scans: number; ask: number }[];
};

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: 20,
};

const DASHED: React.CSSProperties = {
  border: "1px dashed rgba(255,107,0,0.2)",
  borderRadius: 8,
  padding: 20,
  background: "rgba(255,107,0,0.02)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  letterSpacing: "0.08em",
};

const VALUE_STYLE: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: ACCENT,
  marginTop: 6,
};

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={CARD}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={VALUE_STYLE}>{value === null ? "—" : value.toLocaleString()}</div>
    </div>
  );
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<Stats["chartData"] | null>(null);
  const [gtm, setGtm] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d))
      .catch(() => null);
    fetch("/api/admin/stats?chart=true", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChart(d.chartData ?? []))
      .catch(() => null);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#FFFFFF",
        padding: "32px 40px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          STATS PLATEFORME
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.45)",
            marginTop: 6,
          }}
        >
          Analytics et métriques produit
        </div>

        {/* Vercel Analytics */}
        <div style={{ ...DASHED, marginTop: 32 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              marginBottom: 6,
            }}
          >
            Vercel Analytics — Actif
          </div>
          <div
            style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}
          >
            Les données de trafic apparaissent sous 24h.
          </div>
          <a
            href="https://vercel.com/analytics"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "8px 14px",
              background: ACCENT,
              color: "#000",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textDecoration: "none",
              borderRadius: 6,
            }}
          >
            Ouvrir Vercel Analytics →
          </a>
        </div>

        {/* 8 metric cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginTop: 24,
          }}
        >
          <MetricCard label="Scans aujourd'hui" value={stats?.scansToday ?? null} />
          <MetricCard label="Scans cette semaine" value={stats?.scansWeek ?? null} />
          <MetricCard label="ASK aujourd'hui" value={stats?.askToday ?? null} />
          <MetricCard label="ASK cette semaine" value={stats?.askWeek ?? null} />
          <MetricCard label="Watchlist actives" value={stats?.watchlist ?? null} />
          <MetricCard label="Investigators actifs" value={stats?.investigators ?? null} />
          <MetricCard label="Cases ouverts" value={stats?.cases ?? null} />
          <MetricCard label="KOL publiés" value={stats?.kolPublished ?? null} />
        </div>

        {/* Chart 30 days */}
        <div style={{ ...CARD, marginTop: 24 }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 12 }}>
            Activité — 30 derniers jours
          </div>
          <div style={{ width: "100%", height: 280 }}>
            {chart && chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: `1px solid ${ACCENT}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="scans"
                    stroke={ACCENT}
                    strokeWidth={2}
                    dot={false}
                    name="Scans"
                  />
                  <Line
                    type="monotone"
                    dataKey="ask"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={2}
                    dot={false}
                    name="ASK"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                {chart === null ? "Chargement…" : "Aucune donnée sur 30 jours"}
              </div>
            )}
          </div>
        </div>

        {/* GTM */}
        <div style={{ ...DASHED, marginTop: 24 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              marginBottom: 6,
            }}
          >
            Google Tag Manager — À configurer
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 10,
            }}
          >
            Connecte Google Ads, GA4, Facebook Pixel.
          </div>
          <ol
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              paddingLeft: 18,
              marginBottom: 14,
              lineHeight: 1.7,
            }}
          >
            <li>Crée un conteneur sur tagmanager.google.com</li>
            <li>Colle le GTM-ID ci-dessous</li>
            <li>Configure tes tags (GA4, Google Ads, Meta Pixel…)</li>
          </ol>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={gtm}
              onChange={(e) => setGtm(e.target.value)}
              placeholder="GTM-XXXXXXX"
              style={{
                flex: 1,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "#fff",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={() => console.log("GTM save:", gtm)}
              style={{
                padding: "10px 16px",
                background: ACCENT,
                color: "#000",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Sauvegarder
            </button>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              marginTop: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Prêt pour Google Ads et GA4
          </div>
        </div>
      </div>
    </div>
  );
}
