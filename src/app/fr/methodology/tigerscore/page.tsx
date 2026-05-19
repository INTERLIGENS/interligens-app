import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TigerScore — Méthodologie INTERLIGENS",
  description:
    "Comment fonctionne le TigerScore INTERLIGENS. Un score de risque 0–100 fondé sur des preuves, sur plusieurs catégories de signaux on-chain. Architecture, pas recette.",
  openGraph: {
    title: "TigerScore — Méthodologie INTERLIGENS",
    description:
      "Un score de risque 0–100 fondé sur des preuves, sur plusieurs catégories de signaux on-chain. Architecture, pas recette.",
  },
};

const SIGNAL_GROUPS: {
  group: string;
  signals: { code: string; desc: string }[];
}[] = [
  {
    group: "Signaux on-chain",
    signals: [
      { code: "holders_concentrated_80", desc: "Les principaux détenteurs contrôlent 80%+ de l'offre." },
      { code: "holders_concentrated_60", desc: "Les principaux détenteurs contrôlent 60%+ de l'offre." },
      { code: "liquidity_very_low", desc: "Moins de 10 000 $ de liquidité." },
      { code: "liquidity_low", desc: "Moins de 50 000 $ de liquidité." },
      { code: "token_young_7d", desc: "Token créé au cours des 7 derniers jours." },
      { code: "token_young_30d", desc: "Token créé au cours des 30 derniers jours." },
      { code: "volume_very_low", desc: "Moins de 1 000 $ de volume quotidien." },
      { code: "cluster_risk", desc: "Trois signaux forts ou plus combinés." },
      { code: "pump_fun_origin", desc: "Token lancé via pump.fun." },
    ],
  },
  {
    group: "Intelligence de dossier",
    signals: [
      { code: "Contrôle OFAC / Sanctions", desc: "Croisé avec 332K+ entités sanctionnées." },
      { code: "Scam Sniffer", desc: "Intégration de base de données d'adresses frauduleuses tierce." },
      { code: "GoPlus", desc: "Détection de contrats honeypot et phishing." },
      { code: "Allégations de dossier", desc: "Croisé avec 5 dossiers publiés." },
      { code: "Corrélation Registre KOL", desc: "Mis en correspondance avec les profils d'influenceurs documentés." },
    ],
  },
  {
    group: "Données de marché",
    signals: [
      { code: "DexScreener", desc: "Prix, capitalisation et volume en temps réel." },
      { code: "Détection Pump.fun", desc: "Identifie les tokens lancés via pump.fun." },
    ],
  },
  {
    group: "Intelligence sociale",
    signals: [
      { code: "Watcher V2", desc: "79 comptes surveillés automatiquement toutes les 72 heures." },
      { code: "Détection de schémas de shill", desc: "Identifie les vagues de promotion coordonnée." },
      { code: "Clustering de campagnes", desc: "Regroupe l'activité de promotion liée entre acteurs." },
    ],
  },
];

export default function TigerScoreMethodologyPageFR() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* Fil d'Ariane */}
        <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 32 }}>
          <a href="/fr/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>Méthodologie</a>
          <span style={{ margin: "0 8px" }}>→</span>
          <span>TigerScore</span>
        </div>

        {/* En-tête */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>SYSTÈME TIGERSCORE</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Comment fonctionne le TigerScore</h1>
          <div style={{ marginTop: 12, fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            Le TigerScore est un score de risque 0–100 fondé sur des preuves, calculé à partir de plusieurs catégories de signaux indépendantes. Un score plus élevé indique un risque observé plus élevé.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>Architecture, pas recette.</div>
        </div>

        {/* Paliers de score */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>PALIERS DE RISQUE</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            {[
              { tier: "VERT", range: "0 – 39", label: "Risque observé plus faible", color: "#10b981", desc: "Aucun signal critique relevé. Indicateurs de risque dans les normes observées pour cette chaîne et ce type de token." },
              { tier: "ORANGE", range: "40 – 69", label: "Risque élevé — prudence", color: "#f59e0b", desc: "Un ou plusieurs signaux suspects détectés. Vérification indépendante recommandée avant toute interaction." },
              { tier: "ROUGE", range: "70 – 100", label: "Risque critique", color: "#ef4444", desc: "Plusieurs signaux à forte gravité détectés. Preuves documentées de schémas à haut risque." },
            ].map((t) => (
              <div
                key={t.tier}
                style={{
                  background: "#0f0f0f",
                  border: `1px solid ${t.color}44`,
                  borderLeft: `3px solid ${t.color}`,
                  borderRadius: 8,
                  padding: "18px 22px",
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 84 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: t.color, letterSpacing: "0.15em", marginBottom: 4 }}>{t.tier}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: t.color, fontFamily: "monospace" }}>{t.range}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Catégories de signaux */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>CATÉGORIES DE SIGNAUX</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
            Le TigerScore s&apos;appuie sur quatre groupes de signaux, tous actuellement en production. Les poids internes, seuils et logiques de détection ne sont pas publiés — seulement l&apos;architecture ci-dessous.
          </div>
          {SIGNAL_GROUPS.map((g) => (
            <div key={g.group} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#f9fafb", letterSpacing: "0.05em" }}>{g.group}</div>
                <span
                  style={{
                    background: "#00FF9415",
                    border: "1px solid #00FF9444",
                    color: "#00FF94",
                    fontSize: 8,
                    fontWeight: 900,
                    padding: "3px 9px",
                    borderRadius: 4,
                    letterSpacing: "0.12em",
                  }}
                >
                  EN PRODUCTION
                </span>
              </div>
              <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "6px 22px" }}>
                {g.signals.map((s, i) => (
                  <div
                    key={s.code}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      padding: "12px 0",
                      borderTop: i === 0 ? "none" : "1px solid #161616",
                      flexWrap: "wrap" as const,
                    }}
                  >
                    <code style={{ fontSize: 12, fontFamily: "monospace", color: "#FF6B00", fontWeight: 700 }}>{s.code}</code>
                    <span style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Avis propriétaire */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #FF6B0022",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 10 }}>PROPRIÉTAIRE</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>
            Les poids individuels des signaux, les seuils de score, les mécanismes internes des détecteurs et la logique anti-évasion ne sont pas divulgués. Leur divulgation permettrait une évasion ciblée des systèmes de détection. INTERLIGENS publie l&apos;architecture — pas la recette.
          </div>
        </div>

        {/* Avertissement sur l'usage du score */}
        <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.7, borderTop: "1px solid #111827", paddingTop: 24 }}>
          Le TigerScore est un instrument analytique. Ce n&apos;est pas une recommandation financière, une conclusion juridique ni un résultat d&apos;audit.
          Les scores reflètent les signaux observés au moment du calcul et peuvent évoluer à mesure que de nouvelles preuves émergent.
          <br /><br />
          <a href="/fr/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>← Retour à la méthodologie</a>
          <span style={{ margin: "0 12px", color: "#1f2937" }}>·</span>
          <a href="/fr/methodology/kol-risk" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Profil de risque KOL →</a>
        </div>
      </div>
    </div>
  );
}
