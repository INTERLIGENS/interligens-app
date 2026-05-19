import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil de risque KOL — Méthodologie INTERLIGENS",
  description:
    "Comment INTERLIGENS évalue le risque des influenceurs. Sept axes directionnels. Fondé sur des preuves. Architecture, pas recette.",
  openGraph: {
    title: "Profil de risque KOL — Méthodologie INTERLIGENS",
    description:
      "Comment INTERLIGENS évalue le risque des influenceurs. Sept axes directionnels. Fondé sur des preuves.",
  },
};

const AXES = [
  {
    id: "laundry-linkage",
    label: "Lien de blanchiment",
    desc: "Connexions on-chain observées entre les portefeuilles documentés de l'acteur et des adresses associées à des flux à haut risque, des mixers ou des contreparties signalées.",
  },
  {
    id: "observed-proceeds",
    label: "Produits observés",
    desc: "Événements de cashout minimaux documentés attribués à l'acteur sur des clusters de portefeuilles vérifiés. Les chiffres représentent des planchers on-chain, pas des gains totaux.",
  },
  {
    id: "mm-coordination",
    label: "Coordination MM",
    desc: "Preuves d'activité de market-making coordonné ou de wash-trading liée aux tokens promus par cet acteur, sur la base de schémas de transactions observables.",
  },
  {
    id: "rug-avoidance",
    label: "Évitement de rug",
    desc: "Schéma de sortie des positions promues avant les effondrements documentés. Évalué sur plusieurs lancements avec données de timing vérifiées.",
  },
  {
    id: "timing-quality",
    label: "Qualité du timing",
    desc: "Cohérence entre le timing de promotion publique et l'activité documentée des portefeuilles initiés. L'accès anticipé et le positionnement pré-lancement sont évalués.",
  },
  {
    id: "holding-pattern",
    label: "Schéma de détention",
    desc: "Comportement observable des portefeuilles attribués après promotion : timing de vente, durée de détention et schémas de distribution relativement à l'activité retail.",
  },
  {
    id: "disclosure-honesty",
    label: "Honnêteté de divulgation publique",
    desc: "Évaluation des déclarations publiques — relations d'équipe, propriété de portefeuilles, divulgations de rémunération — au regard des preuves vérifiables on-chain et du registre public.",
  },
];

export default function KolRiskMethodologyPageFR() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* Fil d'Ariane */}
        <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 32 }}>
          <a href="/fr/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>Méthodologie</a>
          <span style={{ margin: "0 8px" }}>→</span>
          <span>Profil de risque KOL</span>
        </div>

        {/* En-tête */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>PROFIL DE RISQUE KOL</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Comment le risque des influenceurs est évalué</h1>
          <div style={{ marginTop: 12, fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            INTERLIGENS évalue les key opinion leaders (KOL) sur sept axes directionnels. Chaque axe contribue à un profil de risque holistique.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>Architecture, pas recette.</div>
        </div>

        {/* Registre en un coup d'œil */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>LE REGISTRE EN UN COUP D&apos;ŒIL</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { value: "370+", label: "Profils KOL dans le registre" },
              { value: "220", label: "Profils avec portefeuilles liés" },
              { value: "484", label: "Portefeuilles attribués au total" },
              { value: "17,6 M$", label: "Produits observés tracés" },
              { value: "5 657", label: "Événements de produits documentés" },
              { value: "79", label: "Comptes sous surveillance automatisée" },
            ].map((s) => (
              <div
                key={s.label}
                style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "18px 20px" }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: "#FF6B00", fontFamily: "monospace", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.6, marginTop: 12 }}>
            Les chiffres reflètent des preuves on-chain documentées et sont révisés à mesure que l&apos;attribution s&apos;améliore. Les chiffres de produits sont des planchers, pas des plafonds.
          </div>
        </div>

        {/* Axes */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>AXES DIRECTIONNELS</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            Les formules, poids de scoring et seuils d&apos;axes ne sont pas publiés. INTERLIGENS documente les axes — pas l&apos;arithmétique.
          </div>
          {AXES.map((axis, i) => (
            <div
              key={axis.id}
              style={{
                marginBottom: 10,
                background: "#0f0f0f",
                border: "1px solid #1a1a1a",
                borderRadius: 8,
                padding: "18px 22px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#FF6B0018",
                  border: "1px solid #FF6B0044",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  color: "#FF6B00",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#f9fafb", marginBottom: 6 }}>{axis.label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{axis.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Note holistique */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #1f2937",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.2em", marginBottom: 10 }}>SCORING HOLISTIQUE</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>
            Aucun axe seul ne détermine un résultat. Les profils de risque émergent de la combinaison, du poids et de la corroboration des signaux sur tous les axes. Une lecture élevée sur un axe peut être compensée par des preuves documentées sur un autre. Tous les profils sont revus avant publication.
          </div>
        </div>

        {/* Standard de publication */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #FF6B0022",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 10 }}>STANDARD DE PUBLICATION</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>
            Les profils KOL ne sont publiés que lorsqu&apos;un seuil minimum de preuves est atteint sur au moins deux axes indépendants. Les profils en revision, restreints ou en brouillon ne sont pas visibles publiquement. INTERLIGENS ne publie pas de spéculation — uniquement des observations documentées.
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.7, borderTop: "1px solid #111827", paddingTop: 24 }}>
          Les profils de risque KOL sont des instruments analytiques. Ce ne sont pas des conclusions juridiques, de la diffamation ni un conseil financier.
          Tous les profils publiés atteignent un seuil de preuves documenté et sont sujets à des demandes de correction.
          <br /><br />
          <a href="/fr/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>← Retour à la méthodologie</a>
          <span style={{ margin: "0 12px", color: "#1f2937" }}>·</span>
          <a href="/fr/methodology/tigerscore" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>TigerScore →</a>
          <span style={{ margin: "0 12px", color: "#1f2937" }}>·</span>
          <a href="/fr/kol" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Registre KOL →</a>
        </div>
      </div>
    </div>
  );
}
