"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type StatsResponse = {
  scansToday: number;
  scansWeek: number;
  askToday: number;
  askWeek: number;
  watchlist: number;
  investigators: number;
  cases: number;
  kolPublished: number;
  chartData?: Array<{ date: string; scans: number; ask: number }>;
};

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.4)";
const MUTED = "rgba(255,255,255,0.25)";
const CARD_BG = "rgba(255,255,255,0.02)";
const CARD_BORDER = "rgba(255,255,255,0.06)";

function fmtToday(): string {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") +
    "/" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "/" +
    d.getFullYear()
  );
}

const CARD: React.CSSProperties = {
  background: CARD_BG,
  border: "1px solid " + CARD_BORDER,
  borderRadius: 8,
  padding: 20,
};

const METRIC_VALUE: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: ACCENT,
  lineHeight: 1.1,
};

const METRIC_LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: DIM,
  marginTop: 8,
};

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: ACCENT,
  marginBottom: 16,
  marginTop: 36,
};

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [gtmId, setGtmId] = useState("");
  const [gtmSaving, setGtmSaving] = useState(false);
  const [gtmStatus, setGtmStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats?chart=true", {
          credentials: "include",
        });
        if (!res.ok) return;
        const d = (await res.json()) as StatsResponse;
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleGtmSave() {
    setGtmSaving(true);
    setGtmStatus(null);
    try {
      const res = await fetch("/api/admin/gtm/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gtmId: gtmId.trim() }),
      });
      if (res.ok) {
        setGtmStatus("Sauvegardé — ajoute " + gtmId.trim() + " dans Vercel env vars pour activer.");
      } else {
        const b = await res.json().catch(() => null);
        setGtmStatus("Erreur : " + (b?.error ?? res.status));
      }
    } catch (err) {
      setGtmStatus("Erreur réseau");
    } finally {
      setGtmSaving(false);
    }
  }

  const cards: Array<{ label: string; value: number | undefined }> = [
    { label: "Scans aujourd'hui", value: data?.scansToday },
    { label: "Scans cette semaine", value: data?.scansWeek },
    { label: "Requêtes ASK aujourd'hui", value: data?.askToday },
    { label: "Requêtes ASK cette semaine", value: data?.askWeek },
    { label: "Adresses en watchlist", value: data?.watchlist },
    { label: "Investigators actifs", value: data?.investigators },
    { label: "Cases ouverts", value: data?.cases },
    { label: "KOL profiles publiés", value: data?.kolPublished },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        padding: "40px 40px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 6,
          }}
        >
          STATS PLATEFORME
        </div>
        <div style={{ fontSize: 12, color: DIM }}>
          Analytics & métriques produit · {fmtToday()}
        </div>

        {/* SECTION 1 — Vercel Analytics placeholder */}
        <div style={SECTION_HEADER}>1 · Trafic Vercel</div>
        <div
          style={{
            ...CARD,
            borderStyle: "dashed",
            borderColor: "rgba(255,107,0,0.2)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: ACCENT,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Vercel Analytics — Actif
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            Les données de trafic apparaissent dans 24h après l'activation.
            Consulter le dashboard Vercel pour voir visiteurs, pages vues,
            durée de session et taux de rebond en temps réel.
          </div>
          <a
            href="https://vercel.com/analytics"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: ACCENT,
              color: BG,
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Ouvrir Vercel Analytics →
          </a>
        </div>

        {/* SECTION 2 — Metrics grid */}
        <div style={SECTION_HEADER}>2 · Métriques produit</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {cards.map((c) => (
            <div key={c.label} style={CARD}>
              <div style={METRIC_VALUE}>
                {loading || c.value == null
                  ? "—"
                  : c.value.toLocaleString("fr-FR")}
              </div>
              <div style={METRIC_LABEL}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* SECTION 3 — 30-day chart */}
        <div style={SECTION_HEADER}>3 · Activité 30 jours</div>
        <div
          style={{
            ...CARD,
            padding: 16,
            height: 320,
          }}
        >
          {loading ? (
            <div
              style={{
                color: MUTED,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              Loading…
            </div>
          ) : data?.chartData && data.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.35)"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.35)"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid " + ACCENT,
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: ACCENT }}
                  itemStyle={{ color: TEXT }}
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
                color: MUTED,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              Pas encore assez de données.
            </div>
          )}
        </div>

        {/* SECTION 4 — GTM placeholder */}
        <div style={SECTION_HEADER}>4 · Google Tag Manager</div>
        <div
          style={{
            ...CARD,
            borderStyle: "dashed",
            borderColor: "rgba(255,107,0,0.2)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: ACCENT,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Google Tag Manager — À configurer
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 14,
            }}
          >
            Connecte Google Ads, GA4, Facebook Pixel en un seul endroit.
          </div>
          <ol
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.8,
              margin: "0 0 16px 18px",
              padding: 0,
            }}
          >
            <li>Créer un compte sur tagmanager.google.com</li>
            <li>Copier le Container ID (format GTM-XXXXXXX)</li>
            <li>Coller ci-dessous et sauvegarder</li>
          </ol>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={gtmId}
              onChange={(e) => setGtmId(e.target.value.toUpperCase())}
              placeholder="GTM-XXXXXXX"
              style={{
                flex: 1,
                background: "#0d0d0d",
                border: "1px solid " + CARD_BORDER,
                color: TEXT,
                padding: "10px 14px",
                fontSize: 13,
                fontFamily: "monospace",
                outline: "none",
                borderRadius: 6,
              }}
            />
            <button
              onClick={handleGtmSave}
              disabled={gtmSaving || !gtmId.trim()}
              style={{
                padding: "10px 20px",
                background: ACCENT,
                color: BG,
                border: "none",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: gtmSaving || !gtmId.trim() ? "not-allowed" : "pointer",
                opacity: gtmSaving || !gtmId.trim() ? 0.5 : 1,
              }}
            >
              {gtmSaving ? "…" : "Sauvegarder"}
            </button>
          </div>
          {gtmStatus && (
            <div
              style={{
                fontSize: 11,
                color: DIM,
                marginTop: 10,
                fontFamily: "monospace",
              }}
            >
              {gtmStatus}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              marginTop: 12,
              fontStyle: "italic",
            }}
          >
            Le code sera injecté automatiquement dans toutes les pages
            INTERLIGENS une fois GTM_ID configuré dans Vercel env vars.
          </div>
        </div>
      </div>
    </main>
  );
}
