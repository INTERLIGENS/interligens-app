// ─── BUILD 13 · S1B — L'IDENTITÉ PORTABLE DU CASEFILE CANONIQUE ───────────
//
// ██  Ce qui distingue deux documents doit VOYAGER AVEC LE FICHIER.        ██
//
// Mesuré le 2026-09-10, avant ce lot : trois générateurs produisaient des PDF
// nommés `casefile-*.pdf`, et AUCUN ne portait de marque d'autorité.
//
//   pdfRenderer        NON autoritaire   « INTERLIGENS CaseFile »      ← le plus officiel
//   pdfGenerator       AUTORITAIRE       « INTERLIGENS — CASEFILE »
//   pdfGeneratorPublic canonique public  « <docTitle> · <dossier.ref> » ← seul à porter une ref
//
// La distinction n'existait que dans le CHEMIN D'URL, qui ne voyage pas avec
// le fichier. Deuxième inversion mesurée : les deux générateurs canoniques
// s'horodataient À LA JOURNÉE (`slice(0, 10)`), le non autoritaire à la
// minute — deux tirages canoniques du même jour étaient indistinguables.
//
// Ce corpus tient les quatre faits que le document doit porter, plus les deux
// pièges nommés à la revue : ce que l'empreinte mesure, et ce que l'absence
// d'horodatage de mesure a le droit de laisser croire.

import { describe, it, expect } from "vitest";
import {
  buildCaseFileHtml,
  caseFileSourceDigest,
  CASEFILE_AUTHORITY,
  CASEFILE_DOC_FORMAT,
  type CaseFileInput,
} from "@/lib/casefile/pdfGenerator";
import { CASEFILE_SURFACES } from "@/lib/casefile/surfaceRegistry";

const BASE: CaseFileInput = {
  case_meta: {
    case_id: "IL-PND-TEST-001",
    ticker: "TEST",
    chain: "sol",
    mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
    severity: "HIGH",
  },
};

describe("S1B/a — le document porte son identité, pas seulement son contenu", () => {
  const html = buildCaseFileHtml(BASE);

  it("une RÉFÉRENCE, reprise du bloc canonique quand il existe", () => {
    expect(html).toContain("IL-PND-TEST-001");
    const avecRef = buildCaseFileHtml({
      ...BASE,
      canonical: { ref: "IL-PND-CANON-042", claims: [] },
    });
    // La ref canonique PRIME sur le case_id : c'est l'autorité qui nomme.
    expect(avecRef).toContain("IL-PND-CANON-042");
  });

  it("et elle est imprimée AVEC l'autorité qui la nomme, jamais nue", () => {
    // Mesuré : le même dossier BOTIFY porte CASE-2025-BOTIFY-001 depuis
    // presets.ts et CASE-2026-BOTIFY-001 depuis data/cases/botify.json. Une
    // référence instable est pire qu'une absence : le document doit donc dire
    // DE QUEL enregistrement elle vient, et ne rien affirmer de plus.
    expect(html).toContain("(case metadata)");
    expect(
      buildCaseFileHtml({ ...BASE, canonical: { ref: "IL-PND-CANON-042", claims: [] } }),
    ).toContain("(canonical record)");
  });

  it("et le document NE L'AFFIRME PAS stable entre systèmes", () => {
    expect(html).toMatch(/not asserted to be stable across systems/i);
    // Aucune qualification de citabilité tant que l'autorité de nommage n'est
    // pas unifiée — c'est un chantier, pas une mention.
    for (const trop of ["citable", "stable identifier", "permanent reference"]) {
      expect(html.toLowerCase()).not.toContain(trop);
    }
  });

  it("un ÉTAT D'AUTORITÉ, dans le vocabulaire du registre des surfaces", () => {
    expect(CASEFILE_AUTHORITY).toBe("CANONICAL");
    expect(html).toContain(">CANONICAL<");
  });

  it("une VERSION DE FORMAT, dans un espace de noms distinct de GraphReport", () => {
    expect(CASEFILE_DOC_FORMAT).toBe("casefile-doc/1");
    expect(html).toContain("casefile-doc/1");
    // Le piège explicitement interdit : reprendre le `version: "1.0"` de
    // GraphReport ferait croire à un contrat commun là où il n'y en a aucun.
    expect(CASEFILE_DOC_FORMAT).not.toBe("1.0");
  });

  it("un HORODATAGE DE GÉNÉRATION à la SECONDE — pas à la journée", () => {
    const m = html.match(/Generated: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
    expect(m, "l'horodatage doit être un ISO 8601 à la seconde").not.toBeNull();
    // ANTI-RÉGRESSION de l'inversion mesurée : une date seule ne suffit pas.
    expect(html).not.toMatch(/Generated: \d{4}-\d{2}-\d{2}</);
  });

  it("et le PIED reporte l'identité — une page détachée reste attribuable", () => {
    expect(html).toContain(`INTERLIGENS CaseFile · ${CASEFILE_AUTHORITY} · ${CASEFILE_DOC_FORMAT}`);
  });
});

describe("S1B/b — l'empreinte dit CE QU'ELLE MESURE", () => {
  it("elle porte sur l'ENREGISTREMENT SOURCE, et le document le déclare", () => {
    const html = buildCaseFileHtml(BASE);
    expect(html).toContain(caseFileSourceDigest(BASE));
    // Un PDF ne peut pas contenir son propre sha256 : l'y insérer change le
    // fichier. Le document doit donc DIRE ce que l'empreinte couvre, sinon un
    // lecteur croit tenir l'empreinte du fichier qu'il a en main.
    expect(html).toMatch(/SHA-256 of the source record[\s\S]{0,80}not<\/strong> of this PDF/);
  });

  it("STABLE — l'ordre des clés ne change pas l'empreinte", () => {
    const a = caseFileSourceDigest({ x: 1, y: { p: "a", q: "b" } });
    const b = caseFileSourceDigest({ y: { q: "b", p: "a" }, x: 1 });
    expect(a).toBe(b);
  });

  it("INSENSIBLE AU TIRAGE — deux rendus de la même source, même empreinte", () => {
    // C'est la propriété qui la rend utile : elle identifie la SOURCE, pas
    // l'instant du rendu. Si l'horodatage y entrait, elle ne vaudrait rien.
    expect(caseFileSourceDigest(BASE)).toBe(caseFileSourceDigest(BASE));
    const h1 = buildCaseFileHtml(BASE);
    const h2 = buildCaseFileHtml(BASE);
    const d = (h: string) => h.match(/[0-9a-f]{64}/)![0];
    expect(d(h1)).toBe(d(h2));
  });

  it("SENSIBLE À LA SOURCE — une donnée qui change, une empreinte qui change", () => {
    const autre: CaseFileInput = { ...BASE, case_meta: { ...BASE.case_meta, ticker: "AUTRE" } };
    expect(caseFileSourceDigest(autre)).not.toBe(caseFileSourceDigest(BASE));
  });
});

describe("S1B/c — l'horodatage de MESURE n'est pas celui de GÉNÉRATION", () => {
  it("fourni, il est publié tel quel", () => {
    const html = buildCaseFileHtml({ ...BASE, snapshot_at: "2026-09-01T08:00:00Z" });
    expect(html).toContain("2026-09-01T08:00:00Z");
  });

  it("ABSENT, le document le DIT — il ne laisse pas supposer l'autre", () => {
    // La leçon de S8, appliquée ici : une absence se nomme, elle ne se
    // remplace pas par la valeur voisine qui aurait l'air plausible.
    const html = buildCaseFileHtml(BASE);
    expect(html).toContain("not recorded");
    expect(html).toMatch(/generation time above is NOT the measurement time/);
  });
});

describe("S1B/d — on dit CE QUE C'EST, jamais ce que ça vaut", () => {
  it("aucune formule suggérant une certification ou une valeur probante", () => {
    const html = buildCaseFileHtml(BASE).toLowerCase();
    for (const interdit of [
      "official forensic report",
      "certified",
      "certification",
      "legally binding",
      "court-admissible",
      "admissible in court",
      "expert witness",
      "sworn",
    ]) {
      expect(html, `formule interdite servie : ${interdit}`).not.toContain(interdit);
    }
  });

  it("l'autorité VISUELLE ne contredit pas l'autorité GOUVERNÉE", () => {
    // Le registre déclare cette surface CANONICAL ; le document imprime
    // CANONICAL. Le jour où l'un des deux bouge sans l'autre, ceci rougit.
    const s = CASEFILE_SURFACES.find((x) => x.route === "/api/casefile/pdf");
    expect(s, "/api/casefile/pdf doit être déclarée au registre").toBeDefined();
    expect(s?.authority).toBe(CASEFILE_AUTHORITY);
  });
});
