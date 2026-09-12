// ─── BUILD 12 · S23 — LA MARQUE PORTANTE, ET SES QUATRE MUTANTS ──────────
//
// ██  On ne peut pas DIRE qu'on projette sans PROJETER.                    ██
//
// La porte ratifiée :
//
//   « A projection declaration counts only if it CAUSALLY PRODUCES the value
//     accepted by the governed response boundary. DECLARATION IS EVIDENCE
//     ONLY WHEN LOAD-BEARING. »
//
// ─── CE FICHIER NE CLASSE AUCUNE ROUTE RÉELLE ───────────────────────────
//
// Tout est démontré sur CORPUS SYNTHÉTIQUE, et ce n'est pas un pis-aller :
// un mécanisme prouvé sur un corpus qu'on contrôle est PROUVÉ ; le même
// mécanisme lâché sur le dépôt MESURE le dépôt, ce qui est une autre question
// et une autre décision. Le tri des surfaces réelles est un jugement normatif
// de produit — il vient après, et il n'appartient pas à ce fichier.
//
// ─── DEUX NIVEAUX, ET LE SECOND EXISTE PARCE QUE LE PREMIER SE CONTOURNE ─
//
//   LE TYPE      `repondre()` n'accepte que ce qui a traversé une projection.
//                Émettre une donnée brute NE COMPILE PAS. C'est ce qui rend la
//                déclaration inévitable au lieu de recommandée.
//
//   LA GARDE     un `as` suffit à faire taire le compilateur. La garde de
//                capacité est le FILET SOUS LE TYPE — jamais son doublon.
//
// C'est exactement la forme retenue pour RC-7 : une marque de type, et une
// garde en dessous pour attraper les casts. Deux mécanismes de la même
// famille se relisent ; en avoir deux formes différentes pour deux problèmes
// identiques aurait été la vraie dette.
//
// ─── LES DEUX AXES SONT ORTHOGONAUX ─────────────────────────────────────
//
//   AXE 1 · QUI est admis ?                     `Admission<A>`
//   AXE 2 · QUE peut recevoir cette audience ?  `Admissible<A, T>`
//
// Aucun ne se substitue à l'autre, et le critère porte DEUX classifications
// par surface, jamais un booléen. Une clé partenaire authentifie ; elle
// n'entitule pas à tout. Faire dériver le second axe du premier rendrait un
// blanc-seing à toute surface authentifiée — c'est-à-dire là où il coûte le
// plus cher.
//
// Aucun chemin gelé touché. Aucune route réelle classée. Aucune modification
// du registre ni de sa garde.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const MECANISME = resolve("src/lib/governance/audienceProjection");
// ─── L'AXE 3 EST ENTRÉ DANS LA SIGNATURE DE `projeter()` ────────────────
//
// Les cas CONFORMES de ce corpus ont été réécrits : ils présentent désormais
// une `DecisionDePublication`. Les MUTANTS n'ont pas bougé — ni leur source,
// ni leur verdict attendu. C'est la règle : un contrat de frontière qui change
// doit casser les surfaces qui s'y appuient, sinon il n'a pas changé ; mais
// retirer un mutant pour faire passer un changement serait l'affaiblissement
// que ce fichier existe pour empêcher.
const UNITE = resolve("src/lib/governance/uniteGouvernee");

// ═══════════════════════════════════════════════════════════════════════════
// NIVEAU 1 — LE TYPE : la non-conformité NE COMPILE PAS
// ═══════════════════════════════════════════════════════════════════════════

const CORPUS_TYPE: ReadonlyArray<{ nom: string; compile: boolean; source: string }> = [
  {
    nom: "conforme",
    compile: true,
    source: `import { admettreAnonyme, projeter, repondre } from "${MECANISME}";
import { constaterDecision, gouverner } from "${UNITE}";
const dossier = { ref: "R", interne: "ne sort pas" };
export async function GET() {
  const a = admettreAnonyme("index public des dossiers");
  const d = constaterDecision("PlatformCaseFile.publishStatus", "R", "published", true)!;
  return repondre(projeter(a, dossier, (e) => ({ ref: gouverner("OBSERVATION", e.ref, d) })));
}`,
  },

  // ─── L'AXE 3 — LE MUTANT DE BYPASS BRUT ────────────────────────────────
  //
  // ██ C'EST LE MUTANT QUI COMPTE. ██
  //
  // Avant ce lot, `(e) => ({ ref: e.ref })` compilait : la projection était
  // portante quant à l'AUDIENCE, et muette quant à l'AUTORITÉ. Une surface
  // pouvait déclarer son audience, traverser la frontière, et émettre un champ
  // qu'aucune décision de publication ne fondait. C'est exactement la forme des
  // 22 unités non fondées du tableau.
  //
  // Interpoler le contenu brut en contournant la décision doit être une ERREUR
  // DE COMPILATION, pas une règle de relecture.
  {
    nom: "champ-nu-dans-la-projection",
    compile: false,
    source: `import { admettreAnonyme, projeter, repondre } from "${MECANISME}";
const dossier = { ref: "R", interne: "ne sort pas" };
export async function GET() {
  const a = admettreAnonyme("index public des dossiers");
  return repondre(projeter(a, dossier, (e) => ({ ref: e.ref })));
}`,
  },
  {
    // Et la variante qui ment sur la nature sans présenter de décision : la
    // marque ne s'obtient pas en écrivant un objet qui lui ressemble.
    nom: "unite-contrefaite",
    compile: false,
    source: `import { admettreAnonyme, projeter, repondre } from "${MECANISME}";
const dossier = { ref: "R" };
export async function GET() {
  const a = admettreAnonyme("m");
  return repondre(projeter(a, dossier, (e) => ({
    ref: { nature: "OBSERVATION" as const, valeur: e.ref, fondeePar: { referentiel: "KolProfile.publishStatus" } },
  })));
}`,
  },
  {
    // `gouverner` EXIGE une décision. `constaterDecision(..., false)` rend
    // `null`, et `null` n'est pas une décision. Le fail-closed est dans le type.
    nom: "decision-nulle-presentee",
    compile: false,
    source: `import { constaterDecision, gouverner } from "${UNITE}";
const d = constaterDecision("KolProfile.publishStatus", "s", "draft", false);
export const u = gouverner("ASSERTION", "x", d);`,
  },
  {
    nom: "emission-brute",
    compile: false,
    source: `import { repondre } from "${MECANISME}";
const dossier = { ref: "R", interne: "ne sort pas" };
export async function GET() { return repondre(dossier); }`,
  },
  {
    nom: "integrale-operateur",
    compile: true,
    source: `import { admettreOperateur, projeterIntegralement, repondre } from "${MECANISME}";
const dossier = { ref: "R", interne: "sort, l'audience y a droit" };
export async function GET() {
  return repondre(projeterIntegralement(admettreOperateur("requireAdminApi"), dossier));
}`,
  },
  {
    nom: "integrale-anonyme",
    compile: false,
    source: `import { admettreAnonyme, projeterIntegralement, repondre } from "${MECANISME}";
const dossier = { ref: "R", interne: "ne sort pas" };
export async function GET() {
  return repondre(projeterIntegralement(admettreAnonyme("motif"), dossier));
}`,
  },

  // ─── L'ÉLARGISSEMENT AUX CORPS NON-JSON ────────────────────────────────
  //
  // Mesuré sur le dépôt : SEPT routes sur dix-neuf rendent un corps que
  // `JSON.stringify` ne sait pas produire. Une frontière incapable d'exprimer
  // ce que la route doit émettre est contournée — et ici le contournement
  // serait le cas MAJORITAIRE des artefacts portables, ceux dont la
  // gouvernance compte le plus.
  //
  // Le risque de l'élargissement était précis : ouvrir une porte par laquelle
  // le binaire échapperait à la frontière. Les deux cas suivants sont la
  // mesure de ce risque, et c'est `octets-nus` qui décide.
  {
    nom: "document-projete",
    compile: true,
    source: `import { admettreAnonyme, projeterDocument, repondre } from "${MECANISME}";
export async function GET() {
  const a = admettreAnonyme("dossier public");
  return repondre(
    projeterDocument(a, { ref: "R" }, () => new Uint8Array([1]), "application/pdf"),
    { status: 200, headers: { "content-disposition": "inline" } },
  );
}`,
  },
  {
    nom: "octets-nus",
    compile: false,
    source: `import { repondre } from "${MECANISME}";
export async function GET() {
  return repondre({ forme: "octets", typeMime: "application/pdf", octets: new Uint8Array([1]) });
}`,
  },
  {
    nom: "reponse-comme-charge",
    compile: false,
    source: `import type { Charge } from "${MECANISME}";
export const c: Charge = { forme: "reponse", reponse: new Response("x") };`,
  },
  {
    nom: "projection-json-rend-response",
    compile: false,
    source: `import { admettreAnonyme, projeter, repondre } from "${MECANISME}";
const a = admettreAnonyme("m");
export async function GET() { return repondre(projeter(a, { ref: "R" }, () => new Response("x"))); }`,
  },
  {
    nom: "attestee-la-ou-restreinte-exigee",
    compile: false,
    source: `import { admettreAnonyme, projeterDocument, exigerRestreinte } from "${MECANISME}";
const a = admettreAnonyme("m");
export const x = exigerRestreinte(
  projeterDocument(a, { ref: "R" }, () => new Uint8Array([1]), "application/pdf"),
);`,
  },
  {
    nom: "restreinte-exigee-et-fournie",
    compile: true,
    source: `import { admettreAnonyme, projeter, exigerRestreinte } from "${MECANISME}";
import { constaterDecision, gouverner } from "${UNITE}";
const a = admettreAnonyme("m");
const d = constaterDecision("PlatformCaseFile.publishStatus", "R", "published", true)!;
export const x = exigerRestreinte(
  projeter(a, { ref: "R", i: 1 }, (e) => ({ ref: gouverner("OBSERVATION", e.ref, d) })),
);`,
  },
];

const erreursParFichier = new Map<string, string>();

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "s23-"));
  try {
    const chemins = CORPUS_TYPE.map((c) => {
      const p = join(dir, `${c.nom}.ts`);
      writeFileSync(p, c.source, "utf8");
      return p;
    });
    let sortie = "";
    try {
      execFileSync(
        "npx",
        ["tsc", "--noEmit", "--strict", "--target", "es2022", "--module", "esnext",
         "--moduleResolution", "bundler", "--lib", "es2022,dom", ...chemins],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) {
      sortie = String((e as { stdout?: string }).stdout ?? "");
    }
    for (const ligne of sortie.split("\n")) {
      const m = ligne.match(/([^/\\]+)\.ts\(\d+,\d+\): (error TS\d+: .*)/);
      if (m && !erreursParFichier.has(m[1])) erreursParFichier.set(m[1], m[2]);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);

describe("S23/t — LA FORME : la frontière refuse ce qui n'a pas traversé", () => {
  // La garde de la garde : si `tsc` n'a rien tourné, tout paraîtrait conforme.
  // Un « rien à signaler » et un « je n'ai pas regardé » rendent le même vert.
  it("PRÉALABLE — le compilateur a effectivement tourné et rendu des erreurs", () => {
    expect(erreursParFichier.size, "aucune erreur : tsc n'a pas tourné").toBeGreaterThan(0);
  });

  it.each(CORPUS_TYPE.map((c) => [c.nom, c.compile] as const))(
    "%s — compile = %s",
    (nom, compile) => {
      const err = erreursParFichier.get(nom);
      if (compile) {
        expect(err, `${nom} devait compiler, et le compilateur refuse : ${err}`).toBeUndefined();
      } else {
        expect(err, `${nom} devait être REFUSÉ par le type, et il passe`).toBeDefined();
        // Refusé pour la BONNE raison : un argument inassignable à la
        // frontière, pas un import cassé ou une faute de frappe.
        //
        // TS2739 a rejoint la liste avec l'axe 3, et il porte une information
        // que les deux autres n'ont pas : « missing the following properties …
        // sujet, valeurConstatee, [DECIDE] ». C'est le symbole unique qui parle.
        // Une unité contrefaite n'échoue pas parce qu'elle a la mauvaise forme —
        // elle échoue parce qu'il MANQUE ce qu'on ne peut pas écrire soi-même.
        // La liste reste fermée : elle n'accepte que des refus d'assignabilité,
        // jamais un import cassé (TS2307) ni une faute de frappe (TS2304).
        expect(err).toMatch(/TS2345|TS2322|TS2739/);
      }
    },
  );

  it("« émission brute » est refusée SUR LA VALEUR, pas sur autre chose", () => {
    // C'est la démonstration de « on ne peut pas dire qu'on projette sans
    // projeter » : il n'existe aucun chemin de type entre un objet nu et le
    // paramètre que la frontière accepte.
    expect(erreursParFichier.get("emission-brute")).toContain("not assignable");
  });

  // ─── (c) LA QUESTION QUE L'ÉLARGISSEMENT POSE, NOMMÉE ET NON TRANCHÉE ──
  //
  // Que veut dire « projeter » un PDF ?
  //
  //   Sur du JSON, la projection LIT la donnée et en retire. Ce qui sort est
  //   ce qui a été retenu, et l'écart entre l'entrée et la sortie est
  //   DÉMONTRABLE.
  //
  //   Sur un flux d'octets, elle ne peut RIEN retirer. Elle ne peut
  //   qu'ATTESTER que le document a été produit sous une décision d'audience.
  //
  // Ce sont deux propriétés, et la seconde est PLUS FAIBLE. Faut-il qu'elles
  // portent le même nom ? Ce fichier ne le tranche pas — ce n'est pas une
  // question de mécanisme, c'est une question de ce qu'on a le droit
  // d'affirmer, et elle appartient au même arbitrage que la classification
  // d'audience.
  //
  // Ce que le mécanisme fait en attendant : il les REND DISTINCTES plutôt que
  // de laisser croire à une garantie uniforme. Un consommateur qui exige une
  // restriction démontrée le dit par le type, et une charge attestée n'y est
  // pas assignable. C'est la règle déjà appliquée au générateur : un invariant
  // qui laisserait croire qu'il couvre tout serait pire que son absence.
  it("(c) LES DEUX GARANTIES SONT MÉCANIQUEMENT DISTINCTES, et la question reste ouverte", () => {
    // Attestée là où restreinte est exigée → REFUSÉ par le compilateur.
    expect(erreursParFichier.get("attestee-la-ou-restreinte-exigee")).toBeDefined();
    // Restreinte exigée et fournie → accepté.
    expect(erreursParFichier.get("restreinte-exigee-et-fournie")).toBeUndefined();
  });

  it("« intégrale anonyme » est refusée SUR L'AUDIENCE — le second axe mord", () => {
    // L'émission intégrale existe pour ne pas taxer la doctrine d'accès ; elle
    // reste réservée à l'audience à droits maximaux, et c'est le TYPE qui le
    // tient, pas une convention.
    expect(erreursParFichier.get("integrale-anonyme")).toContain("Admission");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NIVEAU 2 — LA GARDE DE CAPACITÉ : le filet sous le type
// ═══════════════════════════════════════════════════════════════════════════

type Axe1 = "ANONYMOUS" | "PARTNER" | "OPERATOR" | null;
type Axe2 = "portante" | "integrale" | "absente" | "contournee";

interface Classement {
  readonly audience: Axe1;
  readonly projection: Axe2;
  /** Une déclaration présente dans le fichier mais que la réponse n'utilise pas. */
  readonly decorative: boolean;
  readonly verdict: "CLASSEE" | "ROUGE";
  readonly motif: string;
}

const codeSeul = (s: string): string =>
  s.split("\n").filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  }).join("\n");

/**
 * LE CLASSEUR — deux axes, jamais un booléen.
 *
 * Il lit ce que le code FAIT sur son chemin de réponse, jamais ce qu'il
 * annonce ailleurs. C'est toute la différence entre une déclaration portante
 * et une déclaration décorative, et c'est ce qui rend M4 possible.
 */
function classer(source: string): Classement {
  const c = codeSeul(source);

  const audience: Axe1 =
    /admettreOperateur\s*\(/.test(c) ? "OPERATOR"
    : /admettrePartenaire\s*\(/.test(c) ? "PARTNER"
    : /admettreAnonyme\s*\(/.test(c) ? "ANONYMOUS"
    : null;

  // Ce qui arrive RÉELLEMENT à la frontière. On lit l'argument de `repondre(`,
  // pas le fichier : une projection écrite plus haut et jamais branchée ne
  // compte pas — c'est précisément la définition de « décoratif ».
  const appels = [...c.matchAll(/repondre\s*\(\s*([\s\S]{0,160}?)[,)]/g)].map((m) => m[1]);

  // ── SUIVRE L'AFFECTATION, SINON LA GARDE TAXE UN STYLE ────────────────
  //
  // `const vue = projeter(…); return repondre(vue)` est la même chose que
  // `return repondre(projeter(…))`, et une garde qui ne reconnaîtrait que la
  // seconde écriture rougirait sur du code irréprochable. Elle serait alors
  // désarmée, et il ne resterait ni l'une ni l'autre.
  //
  // Trouvé en écrivant M1 : j'avais posé le commentaire d'alerte SANS
  // l'assertion qui va avec, ce qui aurait laissé le faux positif dans une
  // garde verte. Une assertion plus lâche que son nom, pour la quatrième fois.
  const resoudre = (arg: string): string => {
    const id = arg.trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(id)) return arg;
    const m = c.match(new RegExp(String.raw`\b(?:const|let|var)\s+${id}\s*(?::[^=]+)?=\s*([\s\S]{0,200}?);`));
    return m ? m[1] : arg;
  };
  const effectifs = appels.map(resoudre);

  const contournee = effectifs.some((a) => /\bas\s+(?:unknown\s+as\s+)?(?:any|Admissible)/.test(a));
  // ── LES FORMES DE PRODUCTION SONT TOUTES PORTANTES ────────────────────
  //
  // `projeterDocument`, `projeterTexte`, `projeterFlux` exigent une fonction de
  // production au même titre que la projection JSON exige une restriction. Ne
  // reconnaître que la forme JSON classerait toute route à artefact comme
  // « sortie non projetée » — un faux rouge sur les sept routes non-JSON du
  // dépôt, c'est-à-dire un impôt sur la seule famille de surfaces dont la
  // gouvernance compte le plus. C'est M2 sous une autre écriture.
  const portante = effectifs.some((a) => /^\s*projeter(?:Document|Texte|Flux)?\s*\(/.test(a));
  const integrale = effectifs.some((a) => /^\s*projeterIntegralement\s*\(/.test(a));

  const projection: Axe2 =
    contournee ? "contournee" : portante ? "portante" : integrale ? "integrale" : "absente";

  // DÉCORATIF : la déclaration existe dans le fichier et la réponse ne la
  // consomme pas. C'est la troisième clause rouge, et elle est la seule qui
  // attrape le cas où quelqu'un a fait le geste sans le brancher.
  const declareAilleurs = /projeter(?:Integralement)?\s*\(/.test(c);
  const decorative = declareAilleurs && projection === "absente";

  let verdict: Classement["verdict"] = "CLASSEE";
  let motif = "audience déclarée, sortie portée";
  if (audience === null) { verdict = "ROUGE"; motif = "AUDIENCE NON DÉCLARÉE — l'absence de porte ne prouve pas une publication intentionnelle"; }
  else if (projection === "contournee") { verdict = "ROUGE"; motif = "CONTOURNEMENT — un cast fait taire le type, la valeur n'a rien traversé"; }
  else if (decorative) { verdict = "ROUGE"; motif = "DÉCLARATION DÉCORATIVE — présente dans le fichier, non consommée par le chemin de réponse"; }
  else if (projection === "absente") { verdict = "ROUGE"; motif = "SORTIE NON PROJETÉE — une audience déclarée n'entitule pas à tout"; }
  else if (projection === "integrale" && audience !== "OPERATOR") { verdict = "ROUGE"; motif = "ÉMISSION INTÉGRALE hors audience à droits maximaux"; }

  return { audience, projection, decorative, verdict, motif };
}

// ─── La clause textuelle identique — le sujet de M4 ──────────────────────
//
// Reproduite ici parce qu'elle est le fait qui rend tout ce module nécessaire :
// écrite comme décision d'accès ou comme filtre d'affichage, elle est LA MÊME
// SUITE DE CARACTÈRES. Rien dans le texte ne les sépare, et c'est pourquoi
// aucune relecture ne le pouvait.
const CLAUSE = `const lignes = await db.dossiers.findMany({ where: { isPublic: true } });`;

describe("S23/m — LES QUATRE MUTANTS", () => {
  it("M1 — LA MARQUE EST PORTANTE : retirer la projection rend ROUGE", () => {
    // Sans ce mutant, la marque est décorative et personne ne le sait. C'est
    // la troisième clause rouge ratifiée : « decorative declaration not
    // consumed by response path → RED ».
    const portee = classer(`
      const a = admettreAnonyme("index public");
      const vue = projeter(a, dossier, (e) => ({ ref: e.ref }));
      return repondre(vue);`);
    // ⚠ La forme portée passe par une VARIABLE, et c'est le témoin de
    // non-régression du suivi d'affectation : sans lui, la garde n'attraperait
    // que le style d'écriture le plus direct et rougirait sur l'autre.
    expect(portee.audience).toBe("ANONYMOUS");
    expect(portee.verdict, "la garde taxe une écriture au lieu d'une propriété").toBe("CLASSEE");
    expect(portee.projection).toBe("portante");
    expect(portee.decorative).toBe(false);

    const decorative = classer(`
      const a = admettreAnonyme("index public");
      const vue = projeter(a, dossier, (e) => ({ ref: e.ref }));
      return repondre(dossier as Admissible<"ANONYMOUS", typeof dossier>);`);
    expect(decorative.verdict).toBe("ROUGE");
    expect(decorative.projection).toBe("contournee");

    const brute = classer(`
      const a = admettreAnonyme("index public");
      return repondre(dossier);`);
    expect(brute.verdict).toBe("ROUGE");
    expect(brute.projection).toBe("absente");
    expect(brute.motif).toContain("n'entitule pas à tout");
  });

  it("M2 — LA DOCTRINE D'ACCÈS N'EST PAS TAXÉE : opérateur sans projection reste VERT", () => {
    // Ce qui empêche la garde de devenir un impôt qu'on désarme. Une surface
    // d'opérateur n'a pas à rédiger une projection restrictive pour satisfaire
    // un formalisme — mais elle doit DIRE son audience, et l'émission
    // intégrale reste une affirmation explicite plutôt qu'un silence.
    const operateur = classer(`
      const a = admettreOperateur("requireAdminApi");
      return repondre(projeterIntegralement(a, dossier));`);
    expect(operateur.verdict).toBe("CLASSEE");
    expect(operateur.audience).toBe("OPERATOR");
    expect(operateur.projection).toBe("integrale");

    // Et la même écriture pour une audience non maximale reste rouge : le
    // dégrèvement est attaché à l'audience, pas à la commodité.
    const partenaire = classer(`
      const a = admettrePartenaire("clé partenaire");
      return repondre(projeterIntegralement(a, dossier));`);
    expect(partenaire.verdict).toBe("ROUGE");
    expect(partenaire.motif).toContain("hors audience à droits maximaux");
  });

  it("M3 — LE CAST NE PASSE PAS : le type se tait, la garde parle", () => {
    // Leçon du huitième mutant de S21, transposée sans rien changer. Le
    // compilateur accepte les trois écritures ci-dessous ; c'est ici qu'elles
    // meurent, et c'est pour cela que la garde est le filet SOUS le type et
    // non son doublon.
    for (const cast of [
      `repondre(dossier as Admissible<"ANONYMOUS", typeof dossier>)`,
      `repondre(dossier as any)`,
      `repondre(dossier as unknown as Admissible<"PARTNER", typeof dossier>)`,
    ]) {
      const r = classer(`const a = admettreAnonyme("m");\nreturn ${cast};`);
      expect(r.verdict, cast).toBe("ROUGE");
      expect(r.projection, cast).toBe("contournee");
    }
  });

  // ── M4 · CELUI QUI FONDE TOUT LE MÉCANISME ────────────────────────────
  //
  // T1 a mesuré une IMPOSSIBILITÉ : `where: { isPublic: true }` écrit comme
  // décision d'accès est textuellement identique à la même ligne écrite comme
  // filtre d'affichage. Aucune relecture ne peut les distinguer, parce qu'il
  // n'y a rien à distinguer dans le texte.
  //
  // M4 est l'EXACTE NÉGATION de cette impossibilité : deux surfaces portant la
  // MÊME clause, mot pour mot, l'une marquée et l'autre non. Si la marque ne
  // les séparait pas, tout ce module serait une décoration coûteuse.
  it("M4 — MÊME CLAUSE TEXTUELLE, deux verdicts : la marque distingue ce que le texte ne peut pas", () => {
    const marquee = classer(`
      const a = admettreAnonyme("index public des dossiers publiés");
      ${CLAUSE}
      return repondre(projeter(a, lignes, (l) => l.map((x) => ({ ref: x.ref }))));`);

    const nue = classer(`
      ${CLAUSE}
      return repondre(lignes);`);

    // La clause est bien IDENTIQUE dans les deux — c'est la prémisse, et elle
    // est vérifiée plutôt que supposée.
    expect(marquee).not.toEqual(nue);
    expect(CLAUSE).toBe(CLAUSE.trim());

    expect(marquee.verdict).toBe("CLASSEE");
    expect(marquee.audience).toBe("ANONYMOUS");
    expect(marquee.projection).toBe("portante");

    expect(nue.verdict).toBe("ROUGE");
    expect(nue.audience).toBeNull();
    expect(nue.motif).toContain("AUDIENCE NON DÉCLARÉE");

    // ██ Et la phrase que ce mutant rend exécutable ██
    //
    // « L'absence de garde ne prouve jamais une publication intentionnelle. »
    //
    // La surface nue n'est pas déclarée COUPABLE — elle est déclarée NON
    // CLASSÉE. La distinction est tout le sujet : le défaut n'a jamais été
    // qu'une route non gardée soit dangereuse, c'est que le système ne puisse
    // pas DIRE si elle est projetée à dessein ou oubliée par accident.
    expect(nue.verdict).toBe("ROUGE");
    expect(nue.motif).not.toContain("dangereu");
  });

  it("LES DEUX AXES SONT INDÉPENDANTS — quatre combinaisons, quatre verdicts distincts", () => {
    // La conséquence mécanique du refus de collapser les doctrines : le
    // classement porte DEUX valeurs, et aucune ne se déduit de l'autre.
    const cas = [
      { nom: "anonyme + projetée", src: `const a = admettreAnonyme("m"); return repondre(projeter(a, d, f));`, attendu: "CLASSEE" },
      { nom: "anonyme + nue", src: `const a = admettreAnonyme("m"); return repondre(d);`, attendu: "ROUGE" },
      { nom: "opérateur + intégrale", src: `const a = admettreOperateur("g"); return repondre(projeterIntegralement(a, d));`, attendu: "CLASSEE" },
      { nom: "partenaire + intégrale", src: `const a = admettrePartenaire("k"); return repondre(projeterIntegralement(a, d));`, attendu: "ROUGE" },
    ] as const;
    for (const c of cas) expect(classer(c.src).verdict, c.nom).toBe(c.attendu);

    // Authentifié n'implique PAS sortie libre : c'est la ligne qui décline la
    // simplification à un seul axe, et elle est ici exécutable.
    const partenaireNu = classer(`const a = admettrePartenaire("k"); return repondre(d);`);
    expect(partenaireNu.audience).toBe("PARTNER");
    expect(partenaireNu.verdict).toBe("ROUGE");
  });

  it("NON-MUTANT — une route à ARTEFACT n'est pas taxée par la garde", () => {
    // Le faux rouge que cette assertion existe pour empêcher : la garde ne
    // reconnaissait d'abord que la projection JSON, et aurait classé « sortie
    // non projetée » les sept routes non-JSON du dépôt — un impôt sur la seule
    // famille de surfaces dont la gouvernance compte le plus.
    for (const forme of ["projeterDocument", "projeterTexte", "projeterFlux"]) {
      const r = classer(`
        const a = admettreAnonyme("dossier public");
        return repondre(${forme}(a, dossier, produire, "application/pdf"), { status: 200 });`);
      expect(r.verdict, forme).toBe("CLASSEE");
      expect(r.projection, forme).toBe("portante");
    }
    // Et l'émission intégrale reste distincte de la production : les deux sont
    // portantes, elles ne disent pas la même chose.
    const integrale = classer(`const a = admettreOperateur("g"); return repondre(projeterIntegralement(a, d));`);
    expect(integrale.projection).toBe("integrale");
  });

  it("NON-MUTANT — une surface conforme n'est pas signalée", () => {
    // Une garde qui rougit sur du code irréprochable est désarmée, et il ne
    // reste ni l'une ni l'autre.
    const r = classer(`
      const a = admettreAnonyme("index public des dossiers publiés");
      return repondre(projeter(a, lignes, (l) => ({ ref: l.ref })));`);
    expect(r.verdict).toBe("CLASSEE");
    expect(r.decorative).toBe(false);
  });
});
