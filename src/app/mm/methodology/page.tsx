// ─── /mm/methodology — editorial policy & scoring explainer (spec §12) ────
// Server component, static. Refactored Phase 6 with five anchored sections
// that match the deep links emitted by MmMethodologyFooter.

import type { Metadata } from "next";
import { MmPageShell } from "@/components/mm/MmPageShell";
import { MmRiskBandBadge } from "@/components/mm/MmRiskBandBadge";

export const metadata: Metadata = {
  title: "Méthodologie — MM Intelligence | INTERLIGENS",
  description:
    "Policy éditoriale, grille de scoring, détecteurs, corrections et droit de réponse du module Market Maker Intelligence.",
  openGraph: {
    title: "Méthodologie — MM Intelligence | INTERLIGENS",
    description:
      "Comment INTERLIGENS construit et publie ses fiches Market Maker, et comment les contester.",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function MmMethodologyPage() {
  return (
    <MmPageShell activeNav="methodology">
      <header style={{ marginBottom: 48 }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            fontSize: 10,
            letterSpacing: 3,
            fontWeight: 900,
            border: "1px solid #FF6B00",
            color: "#FF6B00",
            borderRadius: 2,
            marginBottom: 14,
          }}
        >
          MÉTHODOLOGIE
        </span>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -1,
            marginBottom: 12,
          }}
        >
          Comment on fabrique — et comment on corrige — une fiche MM
        </h1>
        <p style={{ color: "#999", fontSize: 16, lineHeight: 1.6, maxWidth: 760 }}>
          Ce module est structuré en deux produits strictement séparés : un
          <strong style={{ color: "#FFFFFF" }}> registre éditorial </strong>
          humain et un
          <strong style={{ color: "#FFFFFF" }}> moteur algorithmique </strong>
          anonyme. Ils ne sont consolidés qu&apos;au niveau de l&apos;adaptateur
          <code style={{ color: "#FF6B00" }}> MmRiskAssessment</code>.
        </p>

        <nav
          aria-label="Table of contents"
          style={{
            marginTop: 24,
            padding: 14,
            border: "1px solid #222",
            background: "#0A0A0A",
            borderRadius: 2,
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <a href="#editorial" style={TOC_LINK}>1. Editorial policy</a>
          <a href="#scoring" style={TOC_LINK}>2. Score consolidé</a>
          <a href="#detectors" style={TOC_LINK}>3. Détecteurs</a>
          <a href="#corrections" style={TOC_LINK}>4. Corrections</a>
          <a href="#right-of-reply" style={TOC_LINK}>5. Droit de réponse</a>
        </nav>
      </header>

      <Section id="editorial" number={1} title="Editorial policy">
        <p>
          Le <strong>Registry</strong> est un ensemble structuré et édité
          manuellement de fiches d&apos;entités market makers. Chaque claim est
          typée — <code>FACT</code>, <code>ALLEGATION</code>, <code>INFERENCE</code>,{" "}
          <code>RESPONSE</code> — et référencée à une source publique
          archivée. Le <strong>Pattern Engine</strong> est un ensemble de
          détecteurs comportementaux ; il n&apos;émet jamais le nom d&apos;une
          entité, uniquement un <code>internalClusterId</code> anonyme.
        </p>

        <h3 style={HEADING_STYLE}>Sources par tier de crédibilité</h3>
        <ul style={LIST_STYLE}>
          <li>
            <strong style={{ color: "#D1FAE5" }}>TIER 1 — Officiel : </strong>
            DOJ, CFTC, SEC, pièces judiciaires, régulateurs.
          </li>
          <li>
            <strong style={{ color: "#FEF3C7" }}>TIER 2 — Presse établie : </strong>
            WSJ, Reuters, FT, Bloomberg, CoinDesk, The Block, DL News.
          </li>
          <li>
            <strong style={{ color: "#9CA3AF" }}>TIER 3 — OSINT : </strong>
            chercheurs indépendants et presse secondaire. Exige une
            corroboration Tier 1 ou Tier 2.
          </li>
        </ul>

        <h3 style={HEADING_STYLE}>Processus éditorial</h3>
        <ol style={LIST_STYLE}>
          <li>
            <strong>Draft.</strong> Rédaction à partir de sources atomiques.
            Archivage R2 obligatoire, Wayback best-effort.
          </li>
          <li>
            <strong>Self-review.</strong> Vérification de la matrice de wording
            autorisée par statut.
          </li>
          <li>
            <strong>Legal review.</strong> Obligatoire pour Tier S+, Tier S et
            Tier A. Avocat presse/diffamation France.
          </li>
          <li>
            <strong>Publication.</strong> Workflow{" "}
            <code>DRAFT → REVIEWED → PUBLISHED</code>, logué dans{" "}
            <code>MmReviewLog</code>.
          </li>
          <li>
            <strong>Monitoring.</strong> Alertes sur mise en demeure ou
            demande de droit de réponse.
          </li>
        </ol>

        <p>
          Engagement : <strong>INTERLIGENS n&apos;accepte aucun contrat
          commercial</strong> avec les entités listées. Le module est financé
          par l&apos;activité retail de la plateforme.
        </p>
      </Section>

      <Section id="scoring" number={2} title="Score consolidé">
        <p>
          Chaque scan produit cinq dimensions et deux métadonnées. Aucune
          n&apos;est masquée : elles sont toutes exposées dans l&apos;endpoint
          et dans les exports investigateurs.
        </p>

        <ul style={LIST_STYLE}>
          <li>
            <code>registryDrivenScore</code> (0-100) — plancher appliqué si le
            wallet est attribué à une entité du Registry avec confiance
            suffisante.
          </li>
          <li>
            <code>behaviorDrivenScore</code> (0-90) — somme des contributions
            détecteurs du Pattern Engine. Plafonné architecturalement à 90.
          </li>
          <li>
            <code>displayScore</code> (0-100) — <code>max</code> des deux
            précédents, borné par les <em>hard caps</em> anti-faux-positif.
          </li>
          <li>
            <code>confidence</code> (low/medium/high) — nombre de détecteurs
            core concordants avec signal de sévérité HIGH.
          </li>
          <li>
            <code>coverage</code> (low/medium/high) — complétude des sources
            de données à disposition du scan.
          </li>
          <li>
            <code>freshness</code> (fresh/aging/stale) — âge de l&apos;analyse.
            Un scan de plus de 24h est systématiquement affiché avec un
            disclaimer explicite.
          </li>
          <li>
            <code>dominantDriver</code> (REGISTRY / BEHAVIORAL / MIXED / NONE)
            — d&apos;où vient majoritairement le displayScore.
          </li>
        </ul>

        <h3 style={HEADING_STYLE}>Bandes de risque</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto 1fr",
            gap: 10,
            alignItems: "center",
            marginTop: 16,
            padding: 16,
            border: "1px solid #1A1A1A",
            background: "#0A0A0A",
            borderRadius: 2,
          }}
        >
          <BandRow band="GREEN" range="0–19" text="Aucun signal, comportement cohérent avec la cohorte." />
          <BandRow band="YELLOW" range="20–39" text="Signaux isolés, à surveiller." />
          <BandRow band="ORANGE" range="40–69" text="Plusieurs signaux concordants ou entité documentée." />
          <BandRow band="RED" range="70–89" text="Pattern établi, entité inculpée ou documentée." />
          <BandRow band="RED" range="90–100" text="Entité condamnée (contribution Registry requise)." />
        </div>
      </Section>

      <Section id="detectors" number={3} title="Détecteurs">
        <p>
          Le moteur embarque trois détecteurs <em>core</em> et deux détecteurs{" "}
          <em>secondaires corroboratifs</em>. Les détecteurs secondaires ne
          contribuent au score qu&apos;en <strong>co-occurrence</strong> avec
          au moins un signal HIGH d&apos;un détecteur core — cela évite de
          déclencher le module sur des unlocks ou buybacks légitimes.
        </p>

        <DetectorCard
          name="Wash Trading"
          kind="Core · max 30 pts"
          body="Volume par buyer au-dessus du P99 de cohorte, round-trips A→B→A à moins de 100 blocs, symétrie achats/ventes ≥ 0.85 sur 1h."
        />
        <DetectorCard
          name="Cluster Coordination"
          kind="Core · max 25 pts"
          body="Graphe de funding sur 3 niveaux, taille P99 de cohorte, pondération temporelle (heure / 24h / 7j). Aucune attribution d'entité — uniquement des internalClusterId anonymes."
        />
        <DetectorCard
          name="Concentration Abnormality"
          kind="Core · max 20 pts"
          body="Part des 3 premiers wallets au-dessus du P99 de cohorte, coefficient de Gini, HHI ≥ 2500 (seuil antitrust classique)."
        />
        <DetectorCard
          name="Price Asymmetry"
          kind="Secondaire corroboratif · max 8 pts"
          body="Ratio up-volume / down-volume ≥ 3.0 sur 30 jours. Ne contribue qu'en co-occurrence avec un core HIGH."
        />
        <DetectorCard
          name="Post-Listing Pump"
          kind="Secondaire corroboratif · max 7 pts"
          body="Performance > +100% en 7 jours post-listing avec top-10 wallets > 70% du volume. Co-occurrence requise."
        />

        <p style={{ marginTop: 20, color: "#888", fontSize: 13 }}>
          Les seuils sont calibrés nocturnement par cohorte{" "}
          <code>(chain, age, liquidity)</code>. Les wallets déjà flaggés haute
          confiance dans le Registry sont exclus du calcul des percentiles pour
          éviter la contamination.
        </p>
      </Section>

      <Section id="corrections" number={4} title="Corrections policy">
        <p>
          Une erreur factuelle identifiée dans une fiche est instruite sous
          <strong> 14 jours calendaires maximum</strong>. Le workflow est le
          suivant :
        </p>
        <ol style={LIST_STYLE}>
          <li>Signalement par e-mail ou via l&apos;endpoint de droit de réponse.</li>
          <li>Review éditoriale + legal sur le périmètre concerné.</li>
          <li>Correction publiée en place avec mention dans le changelog.</li>
          <li>Log d&apos;audit dans <code>MmReviewLog</code> (action <code>CORRECTED</code>).</li>
          <li>Notification de l&apos;auteur du signalement par retour.</li>
        </ol>
        <p>
          Un changelog public est tenu par fiche entité. Les retractations
          suivent le même workflow avec action <code>RETRACTED</code>.
        </p>
      </Section>

      <Section id="right-of-reply" number={5} title="Droit de réponse">
        <p>
          Toute entité listée peut demander un droit de réponse via l&apos;endpoint{" "}
          <code style={{ color: "#FF6B00" }}>POST /api/v1/mm/challenge</code>. La
          vérification d&apos;identité est <strong>obligatoire</strong>.
        </p>

        <h3 style={HEADING_STYLE}>Format accepté</h3>
        <ul style={LIST_STYLE}>
          <li>
            E-mail DKIM-signé envoyé depuis un domaine officiel de
            l&apos;entité.
          </li>
          <li>
            Pour les entités Tier A (DWF Labs, Wintermute, Jump, Cumberland…) :
            document légal signé en complément de l&apos;email.
          </li>
          <li>
            Envoi alternatif via canal officiel vérifiable (formulaire de
            contact sur le site de l&apos;entité).
          </li>
        </ul>

        <h3 style={HEADING_STYLE}>Délai & publication</h3>
        <ul style={LIST_STYLE}>
          <li>
            Accusé de réception automatique à la création du challenge.
          </li>
          <li>
            <strong>7 jours ouvrés</strong> pour instruire la vérification
            d&apos;identité.
          </li>
          <li>
            La réponse vérifiée est publiée dans la fiche avec le même niveau
            de visibilité que les claims originales, sous la catégorie{" "}
            <code>RESPONSE</code>.
          </li>
          <li>
            Tout rejet est motivé par écrit au challenger et logué dans{" "}
            <code>MmReviewLog</code> (action <code>CHALLENGE_REJECTED</code>).
          </li>
        </ul>

        <h3 style={HEADING_STYLE}>Contact</h3>
        <p>
          <a href="mailto:legal@interligens.com" style={{ color: "#FF6B00" }}>
            legal@interligens.com
          </a>{" "}
          — ou directement via l&apos;API{" "}
          <code style={{ color: "#FF6B00" }}>/api/v1/mm/challenge</code>.
        </p>
      </Section>

      <footer
        style={{
          marginTop: 56,
          paddingTop: 24,
          borderTop: "1px solid #1A1A1A",
          color: "#555",
          fontSize: 11,
          letterSpacing: 1,
        }}
      >
        Document éditorial. Voir également les{" "}
        <a href="/mm/legal" style={{ color: "#FF6B00" }}>mentions légales</a>.
      </footer>
    </MmPageShell>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────

const TOC_LINK: React.CSSProperties = {
  color: "#FFFFFF",
  textDecoration: "none",
  fontWeight: 700,
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: 14,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#FF6B00",
  fontWeight: 900,
  marginTop: 24,
  marginBottom: 10,
};

const LIST_STYLE: React.CSSProperties = {
  lineHeight: 1.7,
  color: "#CCCCCC",
  fontSize: 14,
  paddingLeft: 20,
};

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 56, scrollMarginTop: 90 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: 2.5,
            color: "#FF6B00",
            fontWeight: 900,
          }}
        >
          {number.toString().padStart(2, "0")}
        </span>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: -0.5,
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      <div style={{ color: "#CCCCCC", fontSize: 15, lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

function BandRow({
  band,
  range,
  text,
}: {
  band: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  range: string;
  text: string;
}) {
  return (
    <>
      <MmRiskBandBadge band={band} size="sm" />
      <div
        style={{
          color: "#FFFFFF",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: 1,
          fontSize: 13,
        }}
      >
        {range}
      </div>
      <div style={{ color: "#CCCCCC", fontSize: 13, lineHeight: 1.5 }}>{text}</div>
    </>
  );
}

function DetectorCard({
  name,
  kind,
  body,
}: {
  name: string;
  kind: string;
  body: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        marginBottom: 10,
        background: "#0A0A0A",
        border: "1px solid #1A1A1A",
        borderRadius: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: 0.5,
            color: "#FFFFFF",
            textTransform: "uppercase",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#FF6B00",
            fontWeight: 700,
          }}
        >
          {kind}
        </span>
      </div>
      <p style={{ color: "#CCCCCC", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
}
