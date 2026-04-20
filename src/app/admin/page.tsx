"use client";

import { useRouter } from "next/navigation";

type Card = {
  title: string;
  summary: string;
  href: string;
};

const CARDS: Card[] = [
  {
    title: "Operations",
    summary: "Revue de presse · Victimes · KOL · Alertes",
    href: "/admin/intel",
  },
  {
    title: "Investigators",
    summary: "Liste · Candidatures · Espace Investigateur",
    href: "/admin/investigators",
  },
  {
    title: "Intelligence",
    summary: "Base documentaire · Corroboration · Dossiers",
    href: "/admin/intel-vault",
  },
  {
    title: "Veille",
    summary: "Handles surveilles · Reseau KOL · QA ASK",
    href: "/admin/watch-sources",
  },
  {
    title: "Donnees",
    summary: "Export · Stats",
    href: "/admin/export",
  },
  {
    title: "Systeme",
    summary: "Moteur intelligence · Transparency",
    href: "/admin/intelligence",
  },
];

const BG = "#000000";
const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.3)";
const TEXT = "#FFFFFF";

function formatToday(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function AdminHubHome() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        padding: "48px 40px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.25em",
            color: ACCENT,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          INTERLIGENS ADMIN
        </div>
        <div
          style={{
            fontSize: 11,
            color: DIM,
            marginBottom: 36,
          }}
        >
          Tableau de bord — {formatToday()}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {CARDS.map((card) => (
            <button
              key={card.title}
              onClick={() => router.push(card.href)}
              className="interligens-admin-hub-card"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: 20,
                cursor: "pointer",
                transition:
                  "border-color 200ms, background 200ms, transform 200ms",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textAlign: "left",
                minHeight: 140,
                color: TEXT,
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: ACCENT,
                  textTransform: "uppercase",
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.6,
                  flex: 1,
                }}
              >
                {card.summary}
              </div>
              <div
                style={{
                  alignSelf: "flex-end",
                  fontSize: 14,
                  color: ACCENT,
                  fontWeight: 700,
                }}
              >
                -&gt;
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .interligens-admin-hub-card:hover {
          border-color: rgba(255,107,0,0.3) !important;
          background: rgba(255,107,0,0.03) !important;
        }
      `}</style>
    </main>
  );
}
