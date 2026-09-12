// ─── LE RETRAIT DES HUIT — ET CE QU'IL AGGRAVE SI ON LE FAIT NAÏVEMENT ───
//
// Le terminal de collection exige que chaque champ présente sa décision. Huit
// champs du dossier Explorer n'ont aucune fondation possible et cessent donc
// d'être produits. Ce fichier prouve trois propriétés, dans cet ordre
// d'importance :
//
//   ① le retrait est UNIFORME — il ferme huit différentiels au lieu d'en créer
//   ② le retrait NAÏF en crée deux nouveaux, et ils sont FAUX
//   ③ le retrait correct ne rend aucun badge plutôt qu'un badge par défaut
//
// La ② est le geste qu'on a appris sur `sourceOfTruth` : une correction qui
// empire ce qu'elle corrige est le pire mode de défaillance, et il est
// invisible depuis le test de la correction.

import { describe, it, expect } from "vitest";
import { CHAMPS_DU_DOSSIER, fondationPossiblePour } from "@/lib/governance/fondations";

/** Les huit, dans l'ordre de la table — l'unique autorité. */
const HUIT = CHAMPS_DU_DOSSIER.filter((c) => fondationPossiblePour(c) === null);

/**
 * Les quatorze dossiers RÉELLEMENT servis, réduits aux huit champs, mesurés
 * le 2026-09-12 sur ep-square-band. Corpus contrôlé : le dépôt peut bouger,
 * la propriété démontrée ici ne le doit pas.
 */
const SERVIS = [
  { titre: "TOESCOIN (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "partial", flags: 2, coord: true, shared: false, multi: false, actors: 1 },
  { titre: "TOES (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "partial", flags: 2, coord: true, shared: true, multi: true, actors: 2 },
  { titre: "CBEX", kind: "platform", evidenceDepth: "comprehensive", documentationStatus: "documented", flags: 0, coord: false, shared: false, multi: false, actors: 0 },
  { titre: "SWIF (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "partial", flags: 2, coord: true, shared: true, multi: true, actors: 2 },
  { titre: "BULLISH (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "partial", flags: 2, coord: true, shared: true, multi: true, actors: 2 },
  { titre: "RAVE-DUMP-APR2026", kind: "case", evidenceDepth: "indecidable", documentationStatus: "indecidable", flags: 0, coord: false, shared: false, multi: false, actors: 1 },
  { titre: "OVPP (ethereum)", kind: "launch", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: true, multi: true, actors: 2 },
  { titre: "DIONE (ethereum)", kind: "launch", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: true, multi: true, actors: 2 },
  { titre: "SERIAL-12RUGS (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: false, multi: false, actors: 1 },
  { titre: "GHOST (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: true, multi: true, actors: 4 },
  { titre: "BOTIFY (solana)", kind: "launch", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: true, multi: true, actors: 5 },
  { titre: "SERIAL-12RUGS", kind: "case", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: false, multi: false, actors: 1 },
  { titre: "GHOST", kind: "case", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: true, multi: true, actors: 4 },
  { titre: "BOTIFY", kind: "case", evidenceDepth: "strong", documentationStatus: "documented", flags: 2, coord: true, shared: true, multi: true, actors: 5 },
] as const;

describe("① LE RETRAIT EST UNIFORME — il FERME des différentiels, il n'en crée pas", () => {
  it("les huit sont bien les huit, et ils viennent de la table", () => {
    expect(HUIT).toHaveLength(8);
    expect(HUIT.every((c) => fondationPossiblePour(c) === null)).toBe(true);
  });

  it("██ TÉMOIN — chacun des huit PARTITIONNE les quatorze AUJOURD'HUI", () => {
    // C'est le préalable : si l'un d'eux était constant, le retirer ne
    // fermerait rien et l'assertion suivante ne mesurerait rien.
    const axes: Array<[string, ReadonlyArray<unknown>]> = [
      ["kind", SERVIS.map((d) => d.kind)],
      ["evidenceDepth", SERVIS.map((d) => d.evidenceDepth)],
      ["documentationStatus", SERVIS.map((d) => d.documentationStatus)],
      ["strongestFlags", SERVIS.map((d) => d.flags)],
      ["topCoordinationSignal", SERVIS.map((d) => d.coord)],
      ["sharedActorGroup", SERVIS.map((d) => d.shared)],
      ["multiLaunchRecurrence", SERVIS.map((d) => d.multi)],
      ["linkedActorsCount", SERVIS.map((d) => d.actors)],
    ];
    for (const [nom, valeurs] of axes) {
      expect(new Set(valeurs).size, `${nom} ne partitionne rien`).toBeGreaterThan(1);
    }
  });

  it("retirés UNIFORMÉMENT, les quatorze deviennent indistinguables sur ces huit axes", () => {
    const apres = SERVIS.map(() => ({}));
    expect(new Set(apres.map((d) => JSON.stringify(d))).size).toBe(1);
  });

  it("le marqueur `indecidable` était LUI-MÊME un différentiel 1/13", () => {
    // Mon propre invariant de domaine l'a introduit sur RAVE-DUMP. Tant que le
    // champ est servi, le fail-closed est visible et isole ce dossier. Le
    // retrait le ferme aussi — et c'est une conséquence que je n'avais pas
    // prévue en écrivant l'invariant.
    const indecidables = SERVIS.filter((d) => d.evidenceDepth === "indecidable");
    expect(indecidables).toHaveLength(1);
    expect(indecidables[0].titre).toBe("RAVE-DUMP-APR2026");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ② CE QUE LE RETRAIT NAÏF AGGRAVE — et c'est la raison d'être des pages
// ═══════════════════════════════════════════════════════════════════════════

/** Le rendu du badge de TYPE, tel que la page l'écrit aujourd'hui. */
const KIND_BADGE: Record<string, string> = {
  case: "CASE CLUSTER",
  launch: "TOKEN LAUNCH",
  platform: "PLATFORM FRAUD",
};
const badgeDeType = (kind: string | undefined): string =>
  KIND_BADGE[kind as string] ?? KIND_BADGE.case; // ← le `??` de page.tsx:170

/** Le rendu du badge de DOCUMENTATION, tel que la page l'écrit aujourd'hui. */
const DOC_BADGE: Record<string, string> = { documented: "DOCUMENTED", partial: "PARTIAL" };
const badgeDeDocumentation = (st: string | undefined): string =>
  DOC_BADGE[st as string] ?? DOC_BADGE.partial; // ← le `??` de page.tsx:171

describe("② LE RETRAIT NAÏF CRÉE DEUX ASSERTIONS FAUSSES", () => {
  it("██ retirer `kind` sans toucher la page fait lire « CASE CLUSTER » aux QUATORZE", () => {
    // Neuf lancements de token et une fraude de plateforme deviendraient des
    // « clusters de dossier ». Le champ disparaît, l'affirmation reste — et
    // elle devient fausse pour dix dossiers sur quatorze.
    const avant = SERVIS.map((d) => badgeDeType(d.kind));
    expect(new Set(avant)).toEqual(new Set(["TOKEN LAUNCH", "PLATFORM FRAUD", "CASE CLUSTER"]));

    const apres = SERVIS.map(() => badgeDeType(undefined));
    expect(new Set(apres)).toEqual(new Set(["CASE CLUSTER"]));
    const fausses = SERVIS.filter((d) => d.kind !== "case").length;
    expect(fausses, "dix dossiers liraient un type qu'ils n'ont pas").toBe(10);
  });

  it("██ retirer `documentationStatus` sans toucher la page fait lire « PARTIAL » aux QUATORZE", () => {
    const apres = SERVIS.map(() => badgeDeDocumentation(undefined));
    expect(new Set(apres)).toEqual(new Set(["PARTIAL"]));
    // Neuf étaient DOCUMENTED. Ils affirmeraient désormais un niveau de
    // documentation PLUS BAS que celui qu'on leur connaissait — une assertion
    // qu'aucune décision ne fonde, dans l'autre sens.
    const degrades = SERVIS.filter((d) => d.documentationStatus === "documented").length;
    expect(degrades).toBe(9);
  });

  it("MÊME FAMILLE que le `?? 0` qui faisait lire SIGNAL à RAVE-DUMP", () => {
    // Un repli silencieux transforme une absence en affirmation. Ici deux fois,
    // et dans deux directions opposées : un type inventé, un niveau rabaissé.
    expect(badgeDeType(undefined)).toBe("CASE CLUSTER");
    expect(badgeDeDocumentation(undefined)).toBe("PARTIAL");
  });

  it("③ LE RETRAIT CORRECT — pas de badge du tout, et le contre-témoin", () => {
    // Les pages ne sont PAS gelées : le patch les corrige avec le producteur.
    const badgeCorrect = (v: string | undefined, table: Record<string, string>) =>
      v === undefined ? null : (table[v] ?? null);
    for (const d of SERVIS) {
      expect(badgeCorrect(undefined, KIND_BADGE)).toBeNull();
      expect(badgeCorrect(undefined, DOC_BADGE)).toBeNull();
      // CONTRE-TÉMOIN : la même fonction rend bien un badge quand la valeur est là.
      expect(badgeCorrect(d.kind, KIND_BADGE)).not.toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CE QUI RESTE SERVI — et la charge que ça lui fait porter
// ═══════════════════════════════════════════════════════════════════════════

describe("CE QUI SURVIT, et ce que ça déplace", () => {
  it("`snapshotCount` ne peut PAS absorber la charge des badges retirés", () => {
    // Mesuré : il vaut 0 sur les quatorze. Le risque que j'avais envisagé —
    // le lecteur lit un niveau de documentation dans un compte de preuves —
    // ne se matérialise pas, parce que le compte ne dit rien et ne
    // partitionne rien.
    const snapshots = SERVIS.map(() => 0);
    expect(new Set(snapshots).size).toBe(1);
  });

  it("`linkedActors` devient l'assertion dominante — et sa fondation porte sur la PERSONNE", () => {
    // Les acteurs sont filtrés par PUBLIC_KOL_FILTER, donc chaque personne
    // nommée est publiée. Mais le LIEN entre cette personne et CE dossier vient
    // de `KolCase` / `KolTokenLink`, et `KolCase.evidence` n'a aucune fondation
    // possible — la table le dit. La décision fonde le SUJET, pas le LIEN.
    //
    // C'est la même famille que le label du graphe : sxyz500 est publié, et
    // « Sam O'Leary (SAMBO) » ne l'est pas. DÉCLARÉ, non instruit : E5 est
    // classé « fondé » dans le tableau arbitré, et ce lot ne le rouvre pas.
    expect(fondationPossiblePour("DossierItem.linkedActors")).toBe("KolProfile.publishStatus");
    expect(fondationPossiblePour("KolCase.evidence")).toBeNull();
    const varie = new Set(SERVIS.map((d) => d.actors));
    expect(varie.size, "le nombre d'acteurs partitionne encore").toBeGreaterThan(1);
  });
});
