// ─── BUILD 12 · S20 — CARDINALITÉ DE CITATION, ET RÉSOLUTION ─────────────
//
// ██  RC-5 · tous les emplacements de citation dérivent de dossier.ref     ██
// ██  RC BLOCKER P1 · un champ de citation ne porte qu'UNE sémantique      ██
//
// La porte ratifiée, dans les termes qui l'ont fondée :
//
//   « Aucun espace de nommage n'est à la fois imprimé sur l'artefact et
//     résoluble en exact. »
//
// Ce fichier n'énonce PAS qui doit gouverner. GPT a élu `dossier.ref` comme
// IDENTIFIANT OPAQUE IMMUABLE ; les deux critères ci-dessous se seraient
// écrits à l'identique sous l'issue inverse, et c'est le point : ils se
// démontrent sans connaître le vainqueur.
//
// ─── (a) CARDINALITÉ ────────────────────────────────────────────────────
//
//   Pour un dossier logique, l'ensemble des identifiants extraits de tout ce
//   qu'UNE génération produit a un CARDINAL DE 1.
//
// ─── (b) RÉSOLUTION ─────────────────────────────────────────────────────
//
//   Cette valeur unique, présentée au résolveur de citation du produit, rend
//   l'enregistrement dont le document a été construit.
//
// ─── POURQUOI CE FICHIER DOIT ÊTRE ROUGE AUJOURD'HUI ────────────────────
//
// Un critère qui ne rougit pas AVANT correction ne prouvera rien APRÈS. Le
// rouge attendu est celui de (a) : le corps du document interne porte DEUX
// valeurs, `m.case_id` en h1 et `ref` partout ailleurs. Mesuré sur l'état
// servi (`origin/main`, rebasé le 2026-09-10) :
//
//   pdfGenerator.ts:312   <h1>${esc(m.case_id)}</h1>          → CASE-2024-…
//   pdfGenerator.ts:328   callout « Reference »               → IL-SHILL-…
//   pdfGenerator.ts:416   titre de section « Claims — … »     → IL-SHILL-…
//   pdfGenerator.ts:559   pied « ${ref} — CONFIDENTIEL »      → IL-SHILL-…
//
// ─── LA SONDE REND, ELLE NE GREP PAS ────────────────────────────────────
//
// Leçon AH de S15, appliquée : les deux constructeurs HTML sont exportés
// (`buildCaseFileHtml`, `buildPublicReportHtml`), donc l'artefact est
// CONSTRUIT et LU, jamais cherché dans la source. Un grep sur `pdfGenerator.ts`
// aurait manqué la question, qui n'est pas « quels littéraux le fichier
// contient-il » mais « que porte le document une fois rendu ».
//
// ─── L'UNIVERS EST DÉCOUVERT PAR EMPLACEMENT, PAS PAR FORME ─────────────
//
// Corollaire de S15 tenu ici sous une forme plus stricte encore. Une regex du
// genre /\b(?:IL|CASE)-[A-Z0-9-]+\b/ aurait été une ÉNUMÉRATION déguisée : les
// deux préfixes connus, écrits à la main, et d'accord avec moi. Un troisième
// espace de nommage lui serait passé sous le nez — exactement la faute qui m'a
// fait déclarer une forme « nulle part dans le dépôt » alors qu'un `.tsx` la
// portait.
//
// Les emplacements sont donc extraits par leur POSITION RENDUE — le h1, le
// pied de page, le `<title>`, la couverture — et comparés les uns aux autres.
// Ce que la valeur RESSEMBLE n'entre pas dans le critère. Si un jour un
// emplacement porte `BOTIFY-MAIN` ou un uuid, ce test le voit.
//
// ─── CE QUE CE FICHIER NE COUVRE PAS, ET POURQUOI JE LE DIS ─────────────
//
// Quatre emplacements de citation sortent du document et ne sont pas rendus
// ici : le `Content-Disposition` des deux routes, la clé R2, et le champ de
// transport `off_chain.case_id`. Ils vivent dans des modules qui importent
// Prisma au chargement — ils ne peuvent pas être importés sans `DATABASE_URL`,
// et c'est le défaut d'environnement qui tient déjà trois fichiers de ce
// répertoire au rouge. Les couvrir par inspection de source serait revenir au
// grep que ce fichier refuse.
//
// Ils sont donc HORS PÉRIMÈTRE ICI, nommément, plutôt que couverts en
// apparence. Le critère porte sur ce qu'il rend, et il le dit.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.
// Aucun des quatre fichiers en attente de fenêtre n'est lu par ce test.

import { describe, it, expect } from "vitest";
import { buildCaseFileHtml } from "@/lib/casefile/pdfGenerator";
import { buildPublicReportHtml } from "@/lib/casefile/pdfGeneratorPublic";
import { buildBotifyInput } from "@/lib/casefile/presets";
import {
  projectForPublication,
  BOTIFY_CASEFILE_REF,
} from "@/lib/casefile/publicProjection";
import type { CanonicalCaseFile } from "@/lib/casefile/canonicalReader";

// ═══ LE DOSSIER LOGIQUE, UN SEUL, DANS LES DEUX GÉNÉRATIONS ══════════════
//
// C'est la même autorité que celle qu'appelle `api/casefile/pdf` : la ligne
// `token_casefiles` de BOTIFY. Elle est ici une fixture — exercer la vraie
// base testerait la base, pas la citation.

const DOSSIER: CanonicalCaseFile = {
  ref: BOTIFY_CASEFILE_REF,
  codename: "BOTIFY",
  ticker: "$BOTIFY",
  title: "BOTIFY — dossier canonique",
  tigerScore: null,
  verdict: "UNDETERMINED",
  claims: [],
  sources: [],
  keyWallets: [],
};

/**
 * L'entrée du gabarit INTERNE, construite EXACTEMENT comme la route la
 * construit — `{ ...buildBotifyInput(), canonical: { ref, claims } }`
 * (`api/casefile/pdf/route.ts:161-164`, `api/casefile/generate/route.ts:68-71`).
 *
 * C'est ce détail qui a fait basculer AG4 : les deux identités n'arrivent pas
 * par deux chemins, elles arrivent DANS UN SEUL OBJET, et c'est le gabarit qui
 * tranche. Reconstruire l'objet autrement dissoudrait le sujet du test.
 */
const entreeInterne = () => ({
  ...buildBotifyInput(),
  canonical: { ref: DOSSIER.ref, claims: DOSSIER.claims },
});

// ═══ LES EMPLACEMENTS, DÉFINIS PAR LEUR POSITION RENDUE ══════════════════

interface Emplacement {
  /** Où le lecteur le voit. Pas où le code l'écrit. */
  readonly nom: string;
  readonly extrait: (html: string) => string | null;
}

const premier = (re: RegExp) => (html: string): string | null => {
  const m = html.match(re);
  return m?.[1] ? m[1].trim() : null;
};

/** Gabarit INTERNE — `buildCaseFileHtml`. */
const INTERNE: readonly Emplacement[] = [
  { nom: "interne · titre de tête (h1)", extrait: premier(/<h1>([^<]*)<\/h1>/) },
  {
    nom: "interne · encart d'identité, champ « Reference »",
    extrait: premier(/Reference<\/span>[^<]*<span class="mono"[^>]*>([^<]*)<\/span>/),
  },
  {
    nom: "interne · titre de la section des claims",
    extrait: premier(/Claims — autorité canonique · ([^(<]*)\(/),
  },
  {
    nom: "interne · pied de page",
    extrait: premier(/<span>([^<]*) — CONFIDENTIEL<\/span>/),
  },
];

/** Gabarit PUBLIC — `buildPublicReportHtml`. */
const PUBLIC: readonly Emplacement[] = [
  { nom: "public · <title> du document", extrait: premier(/<title>[^<]*·\s*([^<]*)<\/title>/) },
  { nom: "public · référence de couverture", extrait: premier(/<div class="cover-case">([^<]*)<\/div>/) },
  { nom: "public · en-tête de page", extrait: premier(/<div class="case-ref">[^<]*·\s*([^<]*)<\/div>/) },
  {
    nom: "public · pied de page",
    extrait: premier(/<footer class="page-footer">\s*<span>[^<]*<\/span>\s*<span>([^<]*)<\/span>/),
  },
];

const releve = (html: string, emplacements: readonly Emplacement[]) =>
  emplacements.map((e) => ({ nom: e.nom, valeur: e.extrait(html) }));

// ═══ (a) CARDINALITÉ ═════════════════════════════════════════════════════

describe("S20/a1 — CRITÈRE (a) : un dossier logique, un seul identifiant rendu", () => {
  // ── La garde de la garde ────────────────────────────────────────────
  //
  // Un critère peut rougir pour deux raisons : parce que la propriété est
  // fausse, ou parce que la sonde n'a rien trouvé. Ce sont deux résultats
  // opposés, et les confondre rendrait le rouge d'aujourd'hui ininterprétable
  // — donc le vert de demain aussi. La distinction est faite AVANT la mesure.
  it("PRÉALABLE — les huit emplacements sont effectivement rendus et lus", () => {
    const releves = [
      ...releve(buildCaseFileHtml(entreeInterne()), INTERNE),
      ...releve(buildPublicReportHtml("en", projectForPublication(DOSSIER, "s20")), PUBLIC),
    ];
    const muets = releves.filter((r) => r.valeur === null).map((r) => r.nom);
    expect(
      muets,
      `sonde muette sur ${muets.length} emplacement(s) — le balisage a bougé, ` +
        "la mesure de cardinalité qui suit ne porterait sur rien",
    ).toEqual([]);
    expect(releves).toHaveLength(8);
  });

  it("⛔ CARDINALITÉ — l'union des emplacements rendus a un cardinal de 1", () => {
    const releves = [
      ...releve(buildCaseFileHtml(entreeInterne()), INTERNE),
      ...releve(buildPublicReportHtml("en", projectForPublication(DOSSIER, "s20")), PUBLIC),
    ];
    const valeurs = releves.map((r) => r.valeur).filter((v): v is string => v !== null);
    const distincts = [...new Set(valeurs)].sort();

    // Le message porte la CARTE, pas seulement le compte : un rouge qui dit
    // « 2 au lieu de 1 » n'apprend rien ; un rouge qui dit QUEL emplacement
    // porte QUOI est le rapport lui-même.
    const carte = releves.map((r) => `    ${r.nom.padEnd(46)} → ${r.valeur}`).join("\n");
    expect(
      distincts.length,
      `${distincts.length} identifiants distincts pour UN dossier logique :\n` +
        `${distincts.map((d) => `      · ${d}`).join("\n")}\n` +
        `  emplacement par emplacement :\n${carte}\n`,
    ).toBe(1);
  });

  it("le gabarit PUBLIC, à lui seul, est déjà conforme — il est à geler, pas à corriger", () => {
    // Mesuré séparément parce que la conclusion diffère du gabarit interne, et
    // qu'un test qui ne rend qu'un verdict global le cacherait. Le public ne
    // fait rien de mal ; le fermer ici empêche une correction de l'interne de
    // le casser au passage.
    const html = buildPublicReportHtml("en", projectForPublication(DOSSIER, "s20"));
    const valeurs = releve(html, PUBLIC).map((r) => r.valeur);
    expect(new Set(valeurs).size).toBe(1);
  });
});

// ═══ (b) RÉSOLUTION ══════════════════════════════════════════════════════

describe("S20/b1 — CRITÈRE (b) : la valeur citée est acceptée par le résolveur", () => {
  /**
   * LA RÈGLE D'EXTRACTION DE CLÉ DU RÉSOLVEUR, telle qu'elle est servie.
   *
   * `src/app/en/explorer/[caseId]/page.tsx:43` — la seule surface du produit
   * qui résolve un dossier À PARTIR D'UNE RÉFÉRENCE. Recopiée ici et non
   * importée : la page est un composant client qui monte `useParams`, et
   * l'importer exercerait Next, pas la règle.
   *
   * Le repli n'a jamais été posé comme une règle d'identité — il est né
   * comme un contournement documenté de la réécriture annuelle. Il est
   * pourtant, aujourd'hui, le SEUL pont entre deux millésimes d'un même
   * dossier. Une élection par effet de bord, déjà en place.
   */
  const cleDeRepli = (ref: string): string | null =>
    ref.match(/^CASE-\d{4}-(.+?)-\d+$/)?.[1] ?? null;

  it("CONSTAT — le repli du résolveur est agnostique à l'année, et ne l'est qu'à elle", () => {
    // Le pont entre millésimes existe, et c'est le contournement lui-même.
    expect(cleDeRepli("CASE-2024-BOTIFY-001")).toBe("BOTIFY");
    expect(cleDeRepli("CASE-2026-BOTIFY-001")).toBe("BOTIFY");
    expect(cleDeRepli("CASE-2024-BOTIFY-001")).toBe(cleDeRepli("CASE-2026-BOTIFY-001"));

    // Et il ne franchit rien d'autre : la référence gouvernée ne produit
    // aucune clé, donc la page retombe sur la seule recherche par titre exact.
    expect(cleDeRepli(BOTIFY_CASEFILE_REF)).toBeNull();
  });

  // ── it.fails, jamais .skip ──────────────────────────────────────────────
  //
  // `.skip` retirerait la mesure du décompte : le harnais dirait « vert » sur
  // une propriété que personne n'a exercée, ce qui est le motif que ce corpus
  // ferme depuis S10. `it.fails` la GARDE au décompte, avec son verdict à
  // l'envers — et le jour où elle passe, le harnais rougit et exige qu'on
  // retire le marqueur. La bascule est donc forcée par la mécanique, pas
  // confiée à la mémoire de celui qui armera la surface.
  //
  // RAISON NOMMÉE DU ROUGE, et elle n'est pas un oubli :
  //   `src/lib/explorer/explorerItems.ts` interroge `kolCase` (titre = caseId)
  //   et `platformCaseFile` (titre = codename). `tokenCaseFile` n'y est JAMAIS
  //   interrogée. La référence gouvernée n'est atteignable depuis aucune
  //   orthographe.
  //
  // CE QUE COÛTE SA LEVÉE : indexer `tokenCaseFile.ref` dans le résolveur est
  // une SURFACE PUBLIQUE NOUVELLE, pas un renommage. Le marqueur se retire
  // dans le changement même qui arme la surface — jamais avant, jamais après.
  it.fails(
    "⛔ RÉSOLUTION — la référence gouvernée est acceptée par le résolveur de citation",
    () => {
      expect(cleDeRepli(BOTIFY_CASEFILE_REF)).not.toBeNull();
    },
  );
});
