// ─── /mm/legal — mentions légales (spec §12.6) ────────────────────────────
// Page reste noindex tant que D1 (directeur de publication) et D2 (loi
// applicable + juridiction) n'ont pas été arbitrés par l'avocat presse.

import type { Metadata } from "next";
import { MmPageShell } from "@/components/mm/MmPageShell";

export const metadata: Metadata = {
  title: "Mentions légales — MM Intelligence | INTERLIGENS",
  description:
    "Mentions légales du module Market Maker Intelligence d'INTERLIGENS.",
  robots: { index: false, follow: false },
};

export default function MmLegalPage() {
  return (
    <MmPageShell activeNav="legal">
      <header style={{ marginBottom: 40 }}>
        <div
          style={{
            padding: "8px 12px",
            border: "1px solid #FF6B00",
            borderRadius: 2,
            color: "#FF6B00",
            fontSize: 11,
            marginBottom: 22,
            display: "inline-block",
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          DRAFT · D1 directeur de publication &amp; D2 juridiction à valider
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -1,
          }}
        >
          Mentions légales
        </h1>
      </header>

      <LegalSection title="Éditeur">
        <p>
          <strong>INTERLIGENS Inc.</strong>
          <br />
          Delaware C-Corporation — United States
          <br />
          Adresse postale :{" "}
          <em style={{ color: "#FF6B00" }}>
            [à compléter après validation juridique]
          </em>
          <br />
          Contact éditorial :{" "}
          <a href="mailto:contact@interligens.com" style={LINK_STYLE}>
            contact@interligens.com
          </a>
          <br />
          Contact légal :{" "}
          <a href="mailto:legal@interligens.com" style={LINK_STYLE}>
            legal@interligens.com
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Directeur de publication">
        <p>
          <em style={{ color: "#FF6B00" }}>
            [à compléter — décision D1 en cours]
          </em>{" "}
          — la nomination formelle intervient avant toute mise à disposition
          publique du module, conformément à la spec v1.2.1 §12.6 (annexe A).
        </p>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <p>
          Vercel Inc.
          <br />
          340 S Lemon Ave #4133
          <br />
          Walnut, CA 91789, United States
          <br />
          <a
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
          >
            https://vercel.com
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Contact légal">
        <p>
          Toute notification d&apos;ordre juridique — demande de correction,
          mise en demeure, droit de réponse — doit être adressée à :
        </p>
        <p>
          <a href="mailto:legal@interligens.com" style={LINK_STYLE}>
            legal@interligens.com
          </a>
        </p>
        <p>
          Ou déposée via l&apos;endpoint structuré{" "}
          <code style={{ color: "#FF6B00" }}>POST /api/v1/mm/challenge</code>.
        </p>
      </LegalSection>

      <LegalSection title="Loi applicable &amp; juridiction">
        <p>
          <em style={{ color: "#FF6B00" }}>
            [à compléter — décision D2 en cours]
          </em>{" "}
          — clause arbitrée avec conseil presse/diffamation avant mise à
          disposition publique. Position provisoire : droit du Delaware pour
          l&apos;éditeur, compétence reconnue des tribunaux français pour les
          publications en langue française au sens de la loi du 29 juillet 1881.
        </p>
      </LegalSection>

      <LegalSection title="Objet du site">
        <p>
          INTERLIGENS est une plateforme d&apos;intelligence crypto anti-scam.
          Le module <strong>Market Maker Intelligence</strong> fournit des
          analyses éditoriales et comportementales sur les market makers
          opérant dans l&apos;écosystème crypto. Les fiches publiées respectent
          le cadre de la loi 1881 (France) et le First Amendment (US) sur les
          déclarations de fait sourcées.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus publiés sur ce module — textes, schémas,
          méthodologies de scoring, visualisations — est protégé par le droit
          d&apos;auteur et par les dispositions applicables du Code de la
          propriété intellectuelle. Toute reproduction partielle ou totale est
          soumise à autorisation préalable, hors usage personnel ou citation
          journalistique dûment référencée.
        </p>
      </LegalSection>

      <LegalSection title="Protection des données">
        <p>
          Le module MM Intelligence ne collecte aucune donnée personnelle par
          défaut :
        </p>
        <ul style={UL_STYLE}>
          <li>Pas de cookie de tracking.</li>
          <li>Pas d&apos;analytics tiers sur les pages du module.</li>
          <li>
            Seules les données transmises volontairement via l&apos;endpoint
            <code style={{ color: "#FF6B00" }}> /api/v1/mm/challenge</code>
            (email, nom, texte de la réponse) sont stockées. Elles sont
            conservées aux seules fins d&apos;exercice du droit de réponse et
            supprimées sur demande à <a href="mailto:legal@interligens.com" style={LINK_STYLE}>legal@interligens.com</a>.
          </li>
          <li>
            Les adresses on-chain discutées dans les fiches sont par nature
            publiques et ne sont pas considérées comme des données personnelles
            au sens du RGPD.
          </li>
        </ul>
      </LegalSection>

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
        Document provisoire — version finale publiée après arbitrage D1 / D2.
      </footer>
    </MmPageShell>
  );
}

const LINK_STYLE: React.CSSProperties = { color: "#FF6B00" };

const UL_STYLE: React.CSSProperties = {
  lineHeight: 1.7,
  color: "#CCCCCC",
  fontSize: 14,
  paddingLeft: 20,
  margin: 0,
};

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: 12,
          letterSpacing: 3,
          fontWeight: 900,
          color: "#FF6B00",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      <div style={{ color: "#CCCCCC", fontSize: 15, lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}
