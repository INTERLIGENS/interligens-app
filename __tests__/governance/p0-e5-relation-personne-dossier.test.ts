// ─── E5 · LA RELATION EXIGE SA PROPRE FONDATION ──────────────────────────
//
// ██  « Publication authority of both endpoints does not establish            ██
// ██    publication authority of the relation between them. A governed        ██
// ██    relation requires its own foundation/admissibility. »                 ██
//
// `KolProfile.publishStatus` fonde « cette personne peut être publiée ». Il ne
// fonde PAS « cette personne est liée à ce dossier ».
//
// ─── ET LA RÉPONSE EST SCINDÉE, CE QU'AUCUNE DES DEUX BRANCHES N'AVAIT PRÉVU
//
// La question posée était binaire : la fondation existe-t-elle, oui ou non ?
// Mesurée sur les deux porteurs de relation du dépôt, elle est OUI d'un côté
// et NON de l'autre — et le traitement suit la relation, pas le champ.
//
//   LAUNCH  `KolTokenLink` porte `visibility`, LA LIGNE EST LA RELATION, et
//           `visibility='public'` est l'une des cinq décisions du référentiel.
//           La requête la filtre déjà. → FONDÉE, les acteurs restent.
//   CASE    `KolCase` ne porte AUCUNE colonne de décision — ni publishStatus,
//           ni visibility, ni isPublic, ni reviewStatus. Seulement
//           `lastReviewedAt`, un horodatage. Et la requête n'applique aucun
//           filtre. → SANS FONDATION POSSIBLE, les acteurs ne sont plus émis.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeSeul = (t: string) =>
  t.split("\n").filter((l) => {
    const x = l.trimStart();
    return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
  }).join("\n");

const SCHEMA = readFileSync("prisma/schema.prod.prisma", "utf8");
const PRODUCTEUR = codeSeul(readFileSync("src/lib/explorer/explorerItems.ts", "utf8"));

const modele = (nom: string): string => {
  const i = SCHEMA.indexOf(`model ${nom} {`);
  return SCHEMA.slice(i, SCHEMA.indexOf("\n}", i));
};

const DECISIONS = ["publishStatus", "visibility", "isPublic", "reviewStatus", "proceedsPublication"];

describe("LA VÉRIFICATION ÉTROITE — une décision fonde-t-elle LE LIEN ?", () => {
  it("██ CASE — `KolCase` ne porte AUCUNE colonne de décision", () => {
    const m = modele("KolCase");
    expect(m.length, "le modèle KolCase est introuvable").toBeGreaterThan(50);
    for (const col of DECISIONS) {
      expect(m, `KolCase porte ${col}`).not.toContain(col);
    }
    // Ce qu'elle porte, et qui n'est PAS une décision : un horodatage.
    expect(m).toContain("lastReviewedAt");
  });

  it("██ LAUNCH — `KolTokenLink` porte `visibility`, ET LA LIGNE EST LA RELATION", () => {
    const m = modele("KolTokenLink");
    expect(m).toContain("visibility");
    expect(m).toContain("reviewStatus");
    // La ligne porte les deux extrémités : c'est ce qui en fait la relation
    // elle-même, et non une propriété d'un des bouts.
    expect(m).toContain("kolHandle");
    expect(m).toContain("tokenSymbol");
  });

  it("LE CHEMIN CAUSAL — la décision est CONSOMMÉE, pas seulement présente", () => {
    // Une colonne qui existe et que personne ne lit ne fonde rien. Celle-ci est
    // lue : la requête des dossiers « launch » filtre dessus.
    expect(PRODUCTEUR).toContain("where: { visibility: 'public' }");
    // Et le contre-témoin : la requête `KolCase` n'a pas de `where` du tout.
    const req = PRODUCTEUR.slice(
      PRODUCTEUR.indexOf("const cases = await prisma.kolCase.findMany("),
      PRODUCTEUR.indexOf("const grouped"),
    );
    expect(req.length).toBeGreaterThan(20);
    expect(req, "la requête KolCase filtre quelque chose").not.toContain("where");
  });
});

describe("LE TRAITEMENT — il suit la RELATION, pas le champ", () => {
  it("les dossiers « case » n'émettent plus d'acteurs, et sans substitut", () => {
    // ⚠ ANCRE DE CODE, PAS DE COMMENTAIRE : `codeSeul` retire les commentaires,
    // donc un `indexOf` sur une ligne commentée rend -1 et la tranche est vide.
    // Une tranche vide « ne contient pas » tout ce qu'on lui demande — elle
    // aurait fait passer les assertions de substitut sans rien lire.
    const debutCase = PRODUCTEUR.indexOf("const cases = await prisma.kolCase.findMany(");
    const finCase = PRODUCTEUR.indexOf("export async function getLaunchDossiers");
    expect(debutCase, "ancre de début introuvable").toBeGreaterThan(-1);
    expect(finCase, "ancre de fin introuvable").toBeGreaterThan(debutCase);
    const bloc = PRODUCTEUR.slice(debutCase, finCase);
    expect(bloc.length, "la tranche est vide — elle ne mesurerait rien").toBeGreaterThan(500);
    expect(bloc).toContain("linkedActors: [],");
    expect(bloc).not.toContain("linkedActors: actors,");
    // AUCUN SUBSTITUT : pas de compteur, pas de mention, pas de pastille vide.
    for (const substitut of ["under review", "Under review", "retenus", "withheld actors", "actorsWithheld"]) {
      expect(bloc, substitut).not.toContain(substitut);
    }
  });

  it("les dossiers « launch » gardent les leurs — la garde n'est pas un mur", () => {
    const bloc = PRODUCTEUR.slice(PRODUCTEUR.indexOf("export async function getLaunchDossiers"));
    expect(bloc).toContain("linkedActors: actors,");
  });

  it("LA CONDITION DE SAUT EST CONSERVÉE — c'est du containment, pas de l'émission", () => {
    // « Aucun acteur publié → le dossier n'est pas servi » écarte 105 groupes de
    // tokens sur 114. La retirer aurait fait disparaître les QUATRE dossiers
    // « case » en entier, ce que le ruling ne demande pas : il porte sur la
    // RELATION, pas sur l'existence du dossier.
    expect(PRODUCTEUR).toContain("if (actors.length === 0) continue");
    expect((PRODUCTEUR.match(/if \(actors\.length === 0\) continue/g) ?? [])).toHaveLength(2);
  });
});
