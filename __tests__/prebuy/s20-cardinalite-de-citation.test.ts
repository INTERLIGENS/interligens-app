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
//   Cette valeur unique doit être résoluble EXACTEMENT, par une AUTORITÉ
//   D'IDENTITÉ DE DOSSIER GOUVERNÉE, vers LE dossier logique qui a produit
//   l'artefact.
//
//   Le critère ne désigne aucun résolveur, et n'en importe aucun : il dit ce
//   qui devrait exister, pas ce qui existe. RÉSOLVEUR DE RECHERCHE ≠
//   RÉSOLVEUR DE CITATION, et prendre le premier pour référence — même
//   implicitement, même faute de mieux — serait l'élire par effet de bord.
//   Aucune capacité du dépôt ne satisfait ce contrat aujourd'hui : c'est
//   enregistré comme un MANQUE DE CAPACITÉ DE CITABILITÉ RC, en attente de
//   ruling d'architecture, et non comblé ici.
//
// ─── CE FICHIER A ÉTÉ ÉCRIT ROUGE, ET IL EST PASSÉ AU VERT ──────────────
//
// Un critère qui ne rougit pas AVANT correction ne prouve rien APRÈS. Celui-ci
// a été écrit et commité alors qu'il rougissait, sur l'état servi : le corps du
// document interne portait DEUX valeurs — le titre de tête lisait les
// métadonnées de l'entrée quand les trois autres emplacements du même document
// dérivaient déjà de `ref`.
//
// Le titre de tête dérive désormais de `ref`. La cardinalité est de 1, mesurée
// sur les mêmes huit emplacements découverts, avec le même diagnostic par
// emplacement — la carte n'a pas été retirée du message d'échec en même temps
// que le rouge, précisément parce que c'est elle qui rendra le prochain rouge
// lisible.
//
// Ce que ce fichier garde désormais : que la valeur reste UNE. Ce qu'il ne
// garde pas : LAQUELLE — l'élection est ailleurs, et un critère de cardinalité
// n'a pas à trancher une question d'autorité.
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
  /**
   * Le MOTIF DE POSITION, gardé accessible et non refermé dans une closure.
   *
   * La garde de non-régression en a besoin pour altérer UN emplacement et un
   * seul : les quatre emplacements publics portant aujourd'hui la même valeur,
   * une substitution textuelle naïve les toucherait tous les quatre et le
   * mutant ne prouverait rien.
   */
  readonly motif: RegExp;
}

const valeurDe = (html: string, e: Emplacement): string | null => {
  const m = html.match(e.motif);
  return m?.[1] ? m[1].trim() : null;
};

/**
 * TOUTES les occurrences d'un emplacement, pas la première.
 *
 * Deux des quatre emplacements publics — l'en-tête et le pied — sont répétés
 * sur les neuf pages du document. Ne lire que la première occurrence laisserait
 * passer une régression qui ne toucherait que la page 5, c'est-à-dire une
 * régression invisible à la relecture et parfaitement présente sur la pièce.
 */
const toutesValeursDe = (html: string, e: Emplacement): string[] =>
  [...html.matchAll(new RegExp(e.motif.source, "g"))].map((m) => (m[1] ?? "").trim());

/**
 * Altère UN emplacement, et un seul.
 *
 * La substitution est faite DANS la portion capturée par le motif de position,
 * jamais sur le document entier : les emplacements portant la même valeur, un
 * `replace` global les toucherait tous et le mutant, passant partout, ne
 * prouverait rien du tout.
 */
const muter = (html: string, e: Emplacement, nouvelle: string): string => {
  const m = html.match(e.motif);
  if (!m?.[1]) throw new Error(`mutation impossible — emplacement introuvable : ${e.nom}`);
  return html.replace(m[0], m[0].replace(m[1], nouvelle));
};

/** Gabarit INTERNE — `buildCaseFileHtml`. */
const INTERNE: readonly Emplacement[] = [
  { nom: "interne · titre de tête (h1)", motif: /<h1>([^<]*)<\/h1>/ },
  {
    nom: "interne · encart d'identité, champ « Reference »",
    motif: /Reference<\/span>[^<]*<span class="mono"[^>]*>([^<]*)<\/span>/,
  },
  {
    nom: "interne · titre de la section des claims",
    motif: /Claims — autorité canonique · ([^(<]*)\(/,
  },
  { nom: "interne · pied de page", motif: /<span>([^<]*) — CONFIDENTIEL<\/span>/ },
];

/** Gabarit PUBLIC — `buildPublicReportHtml`. */
const PUBLIC: readonly Emplacement[] = [
  { nom: "public · <title> du document", motif: /<title>[^<]*·\s*([^<]*)<\/title>/ },
  { nom: "public · référence de couverture", motif: /<div class="cover-case">([^<]*)<\/div>/ },
  { nom: "public · en-tête de page", motif: /<div class="case-ref">[^<]*·\s*([^<]*)<\/div>/ },
  {
    nom: "public · pied de page",
    motif: /<footer class="page-footer">\s*<span>[^<]*<\/span>\s*<span>([^<]*)<\/span>/,
  },
];

const releve = (html: string, emplacements: readonly Emplacement[]) =>
  emplacements.map((e) => ({ nom: e.nom, valeur: valeurDe(html, e) }));

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

  // ── CE BLOC A CHANGÉ DE SENS — LE SEUL SITE DÉVIANT A ÉTÉ CORRIGÉ ──────
  //
  // Il ÉPINGLAIT : « le gabarit INTERNE seul porte l'écart », deux valeurs
  // contre une. Le titre de tête lisait `m.case_id` quand les trois autres
  // emplacements du même document dérivaient de `ref` ; il dérive désormais de
  // `ref` comme eux.
  //
  // Le diagnostic PAR GABARIT est conservé, et ce n'est pas une redondance
  // avec la cardinalité globale ci-dessus : celle-ci rendrait le même vert si
  // les deux gabarits convergeaient un jour sur une valeur FAUSSE. Mesurer
  // chaque gabarit séparément dit lequel a bougé, ce qu'un verdict d'ensemble
  // ne dit jamais.
  it("CLÔTURE — chaque gabarit, pris séparément, ne porte qu'UNE valeur", () => {
    const interne = releve(buildCaseFileHtml(entreeInterne()), INTERNE);
    const pub = releve(buildPublicReportHtml("en", projectForPublication(DOSSIER, "s20")), PUBLIC);
    expect(new Set(pub.map((r) => r.valeur)).size, "le gabarit PUBLIC a divergé").toBe(1);
    expect(new Set(interne.map((r) => r.valeur)).size, "le gabarit INTERNE a divergé").toBe(1);

    // Et le titre de tête est ancré NOMMÉMENT, parce que c'est LE site qui a
    // été corrigé : un correctif doit rougir là où il a été fait, pas
    // seulement dans l'agrégat qui le contient.
    const titre = interne.find((r) => r.nom.includes("titre de tête"))!;
    expect(titre.valeur, "le titre de tête est reparti vers l'espace hérité")
      .toBe(BOTIFY_CASEFILE_REF);
  });
});

// ═══ GARDE — LE GABARIT PUBLIC EST CONFORME, DONC IL EST GELÉ ════════════
//
// ██  Ce qui est conforme SANS GARDE le reste par chance.                  ██
//
// Un constat dit ce qui est ; une garde dit ce qui ne doit plus changer. La
// différence n'est pas rhétorique, elle se voit au MUTANT : un test qui se
// contenterait de relire les quatre valeurs d'aujourd'hui passerait tout
// aussi bien sur un gabarit qui les aurait FIGÉES EN DUR — c'est-à-dire sur
// le défaut exact qu'il prétend interdire.
//
// C'est la distinction posée en AG3 sur la STABILITÉ, transposée d'un cran :
// conformité par COÏNCIDENCE de littéral vs conformité par DÉRIVATION. La
// seconde se démontre, la première se relit.
//
// Et c'est le seul endroit du chantier qui s'acquiert sans attendre un
// arbitrage : geler le conforme ne préjuge de rien sur l'issue, puisque les
// quatre emplacements suivront le `ref` quelle que soit la valeur qu'il
// portera.

describe("S20/g1 — GARDE : les quatre emplacements publics DÉRIVENT du ref", () => {
  /**
   * Deux sondes qui ne partagent aucun fragment avec la valeur réelle, ni
   * entre elles, ni avec aucun espace de nommage du produit.
   *
   * C'est délibéré et c'est tout l'intérêt : un emplacement qui aurait figé
   * une valeur en dur, ou qui la dériverait d'une autre source que le `ref`
   * reçu, ne peut pas suivre CES valeurs-là par hasard. Une sonde qui
   * ressemblerait à une référence réelle laisserait justement passer le
   * défaut qu'on cherche.
   */
  const SONDE_A = "QQ-PROBE-ALPHA-777";
  const SONDE_B = "WW-AUTRE-BETA-042";

  const renduAvec = (ref: string) =>
    buildPublicReportHtml("en", projectForPublication({ ...DOSSIER, ref }, "s20"));

  it("DÉRIVATION — les quatre suivent le ref REÇU, ils n'y coïncident pas", () => {
    for (const sonde of [SONDE_A, SONDE_B]) {
      for (const r of releve(renduAvec(sonde), PUBLIC)) {
        expect(r.valeur, `${r.nom} ne suit pas le ref reçu`).toBe(sonde);
      }
    }
  });

  it("TOTALITÉ — l'emplacement répété porte la même valeur sur TOUTES les pages", () => {
    const html = renduAvec(SONDE_A);
    for (const e of PUBLIC) {
      const toutes = toutesValeursDe(html, e);
      expect(toutes.length, `${e.nom} : aucune occurrence trouvée`).toBeGreaterThan(0);
      expect([...new Set(toutes)], `${e.nom} varie d'une page à l'autre`).toEqual([SONDE_A]);
    }
  });

  // ── LE MUTANT, UN PAR EMPLACEMENT ──────────────────────────────────────
  //
  // Quatre mutants et non un seul : un mutant unique prouverait que la garde
  // attrape UNE régression, pas qu'elle couvre les quatre emplacements. Le
  // jour où l'un d'eux cesse d'être lu — un balisage qui change, un motif qui
  // ne matche plus — son mutant survit, et c'est lui qui le dit.
  it.each(PUBLIC.map((e) => [e.nom, e] as const))(
    "MUTANT — « %s » reparti vers un autre espace TUE la garde",
    (_nom, emplacement) => {
      const mute = muter(renduAvec(SONDE_A), emplacement, "CASE-2024-BOTIFY-001");
      const releves = releve(mute, PUBLIC);

      // (a) la cardinalité le voit
      expect(new Set(releves.map((r) => r.valeur)).size).toBe(2);
      // (b) la dérivation le voit, et NOMME l'emplacement fautif
      const fautif = releves.find((r) => r.nom === emplacement.nom)!;
      expect(fautif.valeur).not.toBe(SONDE_A);
      // (c) les trois autres sont indemnes — le mutant est bien CIBLÉ, sinon
      //     il passerait pour un succès en ayant tout cassé.
      const autres = releves.filter((r) => r.nom !== emplacement.nom);
      expect(autres.every((r) => r.valeur === SONDE_A)).toBe(true);
    },
  );
});

// ═══ (b) RÉSOLUTION ══════════════════════════════════════════════════════

describe("S20/b1 — CRITÈRE (b) : la valeur émise est résoluble par une autorité", () => {
  // ─── CE CRITÈRE NE DÉSIGNE AUCUN RÉSOLVEUR, ET C'EST SA FORME ─────────
  //
  //   RÉSOLVEUR DE RECHERCHE ≠ RÉSOLVEUR DE CITATION.
  //
  // Une première rédaction de ce bloc prenait la surface de recherche du
  // produit pour référence — elle y lisait la règle d'extraction de clé et
  // mesurait le critère contre elle. C'était l'élire par effet de bord :
  // exactement le motif que ce corpus refuse, commis dans le test censé le
  // fermer. Une surface qui trouve des enregistrements par correspondance
  // approchante n'acquiert pas l'autorité de résoudre une identité citée
  // parce qu'elle est la seule qui existe.
  //
  // Le critère décrit donc la CAPACITÉ ATTENDUE par son contrat, et rien
  // d'autre. Il ne nomme aucun module, n'en importe aucun, et ne se
  // satisferait pas d'un module qui viendrait à porter ce nom : ce qu'il
  // exige, c'est une résolution EXACTE et GOUVERNÉE vers LE dossier logique
  // qui a produit l'artefact.

  /**
   * Le contrat, et lui seul. Trois exigences, aucune implémentation :
   *
   *   EXACTE      la valeur émise résout telle qu'elle est reçue. Aucune
   *               troncature, aucune extraction de fragment, aucun repli.
   *   GOUVERNÉE   l'autorité qui répond est celle qui a produit l'artefact,
   *               et elle le déclare.
   *   TOTALE      elle rend LE dossier logique, pas un enregistrement qui
   *               lui ressemble.
   */
  type ResolveurDeCitationGouverne = (valeurEmise: string) => { readonly ref: string } | null;

  /**
   * LE REGISTRE DES CAPACITÉS QUI SATISFONT CE CONTRAT.
   *
   * VIDE PAR MESURE, PAS PAR OMISSION — et c'est le résultat, pas un travail
   * qui resterait à faire ici. Aucune capacité du dépôt ne satisfait les
   * trois exigences à la fois aujourd'hui, et la conclusion à en tirer n'est
   * pas d'en écrire une : c'est un MANQUE DE CAPACITÉ DE CITABILITÉ, enregistré
   * comme tel, en attente de ruling d'architecture.
   *
   * Inventer ici le résolveur manquant serait élire une forme d'identité par
   * la porte de service — la même faute d'un cran plus bas.
   */
  const RESOLVEURS_GOUVERNES: readonly ResolveurDeCitationGouverne[] = [];

  it("CONSTAT — l'aliasing heuristique historique n'est PAS de la résolution d'identité", () => {
    // La règle de repli qui vit dans la surface de recherche efface le
    // millésime d'une référence avant de chercher. Elle est reproduite ici
    // pour être QUALIFIÉE, jamais pour servir de mesure — c'est un ALIASING
    // HEURISTIQUE HÉRITÉ, et le fait qu'il ait été posé délibérément ne lui
    // confère aucune autorité présente.
    const aliasHeuristique = (v: string): string | null =>
      v.match(/^CASE-\d{4}-(.+?)-\d+$/)?.[1] ?? null;

    // Ce qu'il fait réellement : il rend deux millésimes indiscernables. Ce
    // n'est pas un rapprochement de dossiers, c'est une PERTE d'information
    // présentée comme une correspondance. Les deux entrées ci-dessous ne
    // désignent pas le même dossier POUR CE CODE — il ne les compare jamais :
    // il les tronque toutes deux et perd ce qui les distinguait.
    expect(aliasHeuristique("CASE-2024-BOTIFY-001")).toBe("BOTIFY");
    expect(aliasHeuristique("CASE-2026-BOTIFY-001")).toBe("BOTIFY");

    // Et il n'est pas EXACT, ce qui suffit à le disqualifier du contrat sans
    // rien préjuger de sa légitimité comme aide à la recherche.
    expect(aliasHeuristique("CASE-2024-BOTIFY-001")).not.toBe("CASE-2024-BOTIFY-001");

    // Aucun candidat n'est admis au registre de ce fait.
    expect(RESOLVEURS_GOUVERNES).toHaveLength(0);
  });

  // ── it.fails, jamais .skip ──────────────────────────────────────────────
  //
  // `.skip` retirerait la mesure du décompte : le harnais dirait « vert » sur
  // une propriété que personne n'a exercée, ce qui est le motif que ce corpus
  // ferme depuis S10. `it.fails` la GARDE au décompte, avec son verdict à
  // l'envers — et le jour où elle passe, le harnais rougit et exige qu'on
  // retire le marqueur. La bascule est forcée par la mécanique, pas confiée à
  // la mémoire de celui qui armera la capacité.
  //
  // RAISON NOMMÉE DU ROUGE, et ce n'est pas un oubli :
  //
  //   AUCUN RÉSOLVEUR DE CITATION GOUVERNÉ N'EXISTE.
  //
  //   La seule surface du produit qui résolve quoi que ce soit à partir d'une
  //   chaîne est un résolveur de RECHERCHE, et un résolveur de recherche ne
  //   peut pas tenir ce rôle : il répond par correspondance, là où une
  //   citation exige une identité. Aucune modification de cette surface n'est
  //   envisagée ni préparée par ce fichier.
  //
  //   Statut : MANQUE DE CAPACITÉ DE CITABILITÉ RC, ruling d'architecture en
  //   attente. Le marqueur se retire dans le changement même qui arme la
  //   capacité ratifiée — jamais avant, et jamais en désignant l'existant.
  it.fails(
    "⛔ RÉSOLUTION — une capacité de résolution de citation gouvernée est disponible",
    () => {
      expect(RESOLVEURS_GOUVERNES.length).toBeGreaterThan(0);
    },
  );
});
