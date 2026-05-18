import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Graphe de preuve — INTERLIGENS",
  description:
    "L'architecture derrière chaque TigerScore : signaux on-chain, intelligence de dossier, signaux marché & social. Architecture, pas recette — proportions affichées, poids non divulgués.",
  openGraph: {
    title: "Graphe de preuve — Architecture du TigerScore",
    description:
      "Comment le TigerScore est construit — signaux on-chain, intelligence de dossier, marché & social. Architecture, pas recette.",
  },
};

type NodeStatus = "LIVE" | "PARTIAL" | "PLANNED";

const STATUS_STYLE: Record<NodeStatus, { color: string; label: string }> = {
  LIVE: { color: "#00FF94", label: "EN PRODUCTION" },
  PARTIAL: { color: "#FFB800", label: "PARTIEL" },
  PLANNED: { color: "#6b7280", label: "PRÉVU" },
};

// `share` ne pilote que la largeur de la barre proportionnelle — le poids
// numérique n'est jamais affiché. Architecture, pas recette.
const BRANCHES: {
  name: string;
  caption: string;
  share: number;
  children: { name: string; status: NodeStatus }[];
}[] = [
  {
    name: "Signaux on-chain",
    caption: "Ce que la blockchain révèle elle-même sur le token.",
    share: 100,
    children: [
      { name: "Concentration des détenteurs", status: "LIVE" },
      { name: "Analyse de liquidité", status: "LIVE" },
      { name: "Âge du token", status: "LIVE" },
      { name: "Analyse du volume", status: "LIVE" },
      { name: "Risque de cluster", status: "PARTIAL" },
    ],
  },
  {
    name: "Intelligence de dossier",
    caption: "Preuves documentées et sources de sécurité tierces.",
    share: 86,
    children: [
      { name: "OFAC / Sanctions", status: "LIVE" },
      { name: "Scam Sniffer", status: "LIVE" },
      { name: "GoPlus", status: "LIVE" },
      { name: "Allégations de dossier", status: "LIVE" },
      { name: "Registre KOL", status: "LIVE" },
    ],
  },
  {
    name: "Marché & Social",
    caption: "Contexte des lieux de trading et signaux de diffusion sociale.",
    share: 62,
    children: [
      { name: "Données DexScreener", status: "LIVE" },
      { name: "Détection Pump.fun", status: "LIVE" },
      { name: "Signaux communautaires", status: "PLANNED" },
    ],
  },
];

function StatusBadge({ status }: { status: NodeStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        background: s.color + "15",
        border: "1px solid " + s.color + "44",
        color: s.color,
        fontSize: 8,
        fontWeight: 900,
        padding: "3px 9px",
        borderRadius: 4,
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default function ProofGraphPageFr() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* ── EN-TÊTE ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>GRAPHE DE PREUVE</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 16 }}>
            Architecture du TigerScore
          </h1>
          <div style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            Chaque TigerScore est assemblé à partir de trois couches de preuves. Le graphe ci-dessous montre l&apos;architecture — quelles données alimentent le score et la contribution relative de chaque couche.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af", lineHeight: 1.7 }}>
            Les barres sont proportionnelles, pas numériques. Les poids exacts, seuils et mécanismes internes des détecteurs restent propriétaires. <span style={{ color: "#FF6B00", fontWeight: 700 }}>Architecture, pas recette.</span>
          </div>
        </div>

        {/* ── NŒUD RACINE ── */}
        <div style={{ background: "#0f0f0f", border: "1px solid #FF6B00", borderRadius: 10, padding: "20px 24px", marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 6 }}>RACINE</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb" }}>TIGERSCORE · 0–100</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Un score de risque unique, composé à partir des trois branches ci-dessous.</div>
        </div>

        {/* connecteur */}
        <div style={{ width: 1, height: 24, background: "#1f2937", margin: "0 auto" }} />

        {/* ── BRANCHES ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {BRANCHES.map((b) => (
            <div key={b.name} style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" as const }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#f9fafb" }}>{b.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{b.caption}</div>
              </div>

              {/* barre proportionnelle — sans poids numérique */}
              <div style={{ marginTop: 12, marginBottom: 18, height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: b.share + "%", height: "100%", background: "#FF6B00", borderRadius: 4 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {b.children.map((c, i) => (
                  <div
                    key={c.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "9px 0",
                      borderTop: i === 0 ? "none" : "1px solid #161616",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#374151", fontFamily: "monospace", fontSize: 13 }}>
                        {i === b.children.length - 1 ? "└─" : "├─"}
                      </span>
                      <span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>{c.name}</span>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── LÉGENDE ── */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "18px 24px", marginTop: 28 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#374151", letterSpacing: "0.2em", marginBottom: 12 }}>LÉGENDE DES STATUTS</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const }}>
            {([
              ["LIVE", "En production — activement pris en compte."],
              ["PARTIAL", "Partiellement implémenté — couverture limitée."],
              ["PLANNED", "Pas encore implémenté — sur la feuille de route."],
            ] as [NodeStatus, string][]).map(([status, desc]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusBadge status={status} />
                <span style={{ fontSize: 11, color: "#6b7280" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PIED DE PAGE ── */}
        <div
          style={{
            borderTop: "1px solid #111827",
            marginTop: 32,
            paddingTop: 24,
            fontSize: 11,
            color: "#374151",
            lineHeight: 1.7,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 8,
          }}
        >
          <span>
            Architecture, pas recette. Les poids internes restent propriétaires.
            <br />INTERLIGENS Delaware C-Corp · Pas un conseil juridique · Pas un conseil financier
          </span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
            <a href="/fr/methodology" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>← Méthodologie</a>
            <a href="/en/methodology/tigerscore" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>TigerScore →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
