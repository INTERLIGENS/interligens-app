// ─── BUILD 9 / ÉTAPE 5 — LE RÉGIME DE PUBLICATION, UN SEUL ─────────────────
//
// ██  API, PDF et UI ne décident plus chacun ce qui est publiable.          ██
// ██  Ils reçoivent la MÊME projection, ou ils ne rendent rien.             ██
//
// ─── Ce que ce module ajoute au lecteur canonique ─────────────────────────
//
// `canonicalReader` répond « que dit l'autorité ? ». Ce module répond « que
// peut-on en publier ? ». Ce sont deux questions, et les confondre est
// exactement ce que BUILD 9 démonte : un booléen unique ne peut pas porter à
// la fois le rattachement, la valeur probante et la décision de publication.
//
// ─── Le point de mesure qui rend ce module nécessaire ─────────────────────
//
// Mesuré le 2026-09-07 sur les deux corpus, exactement inverses :
//
//     8 sources BOTIFY migrées      0 sha256, 0 sourceUrl  → jamais admissibles
//     50 captures VINE              50 sha256, 50 sourceUrl, 0 publique
//
// Un claim marqué PUBLIC dont l'unique source ne porte ni empreinte ni origine
// n'est pas un claim publiable : c'est la pathologie des 20 captures. Le
// CHECK en base exige une référence ; il ne peut pas exiger qu'elle RÉSOLVE
// vers une pièce vérifiable. C'est ici que ça se vérifie, au rendu.
//
// ─── Deux défaillances distinctes, deux traitements distincts ─────────────
//
//   (1) Un claim PUBLIC qui ne porte AUCUNE provenance — ni référence citée,
//       ni fil. L'état contredit les données (le CHECK en base interdit un
//       PUBLIC sans référence). On LÈVE — `assertProvenanceSurvives`.
//       Bruyant, parce qu'un silence ici se répéterait.
//
//   (2) Un claim PUBLIC qui ne satisfait pas le CONTRAT CANONIQUE du claim
//       public : nature non classifiée, aucune référence, une référence qui
//       ne résout pas, une pièce sans empreinte, sans origine ou sans
//       horodatage. Les données sont cohérentes ; c'est la publication qui ne
//       l'est pas. On RETIENT, et on le DIT — un avis qui nomme le champ.
//
// Le fail-closed est le même dans les deux cas : rien ne sort sans fondement.
// Ce qui change, c'est qui doit être réveillé — un développeur, ou un relecteur.
//
// ─── SPINE-00 · C — le contrat est CONSOMMÉ, pas réécrit ──────────────────
//
// Le critère d'émission d'un claim est `decidePublicClaimContract`, la
// primitive de `governedWriter.ts` — la même que l'écrivain applique au
// fondement et à la libération. Une seule écriture de la règle : ce module ne
// compare aucun `sha256`, ne compte aucune référence, ne juge aucune nature.
//
// `threadUrl` est LU, RENDU et CITÉ comme provenance complémentaire. Il n'est
// JAMAIS la raison pour laquelle un claim devient projetable : un claim PUBLIC
// portant un fil et zéro référence est RETENU (cas 2, champ `evidenceRefs`),
// pas rendu. Mesuré le 2026-09-13 : 0 claim PUBLIC en base — les 8 claims
// VINE (8 fils, 0 référence) deviendraient non projetables s'ils étaient
// promus, et c'est précisément le comportement voulu.
//
// Conséquence sur la forme rendue : un claim projeté a TOUTES ses références
// résolues vers des pièces publiables. `unresolvedRefs` et `withheldRefs`
// sont donc vides par construction sur un claim rendu ; ils restent dans le
// type parce que les gabarits les lisent, et parce qu'un champ qui disparaît
// se recâble plus discrètement qu'un champ qui reste vide.
//
// Résiduel DÉCLARÉ : le déclencheur (1) n'est pas un critère d'émission et n'a
// pas été touché. Il distingue encore « aucune provenance du tout » (lève) de
// « un fil sans référence » (retient). Le second cas est celui que le CHECK
// laisse exister ; le premier ne devrait pas exister en base.
//
// ─── Ce qu'un retrait a le droit de dire ──────────────────────────────────
//
// Le NOM du champ manquant. Jamais sa valeur, jamais le contenu retenu.
// Republier une assertion pour expliquer son retrait annule le retrait.
//
// Et jamais une conclusion de plus : une pièce sans provenance n'est pas une
// pièce fausse. `INSUFFICIENT_PROVENANCE` dit ce qui manque, pas ce qui est.

import {
  loadCanonicalCaseFile,
  assertProvenanceSurvives,
  type CanonicalCaseFile,
  type PublicClaim,
  type PublicSource,
} from "./canonicalReader";
import {
  type ExclusionReason,
  assertExclusionNoticeSafe,
} from "./publicationState";
import { BOTIFY_MINT, casefileLookupKey } from "@/lib/kol-memory/tokenIdentity";
import { ungovernedScoreField } from "./governedMetrics";
import { decidePublication } from "./publicationAuthority";
import {
  decidePublicClaimContract,
  SOURCE_PROVENANCE_FIELDS,
  type PublicClaimContractCause,
} from "./governedWriter";

// Le prédicat de provenance d'une pièce vit désormais dans `governedWriter`
// (SPINE-00 · C). Ré-exporté ici pour ses consommateurs historiques ; ce
// module ne l'APPELLE plus lui-même — le contrat le fait pour lui.
export { isPubliableSource } from "./governedWriter";

// ─── Identité : quel dossier canonique, pour quelle entrée ────────────────
//
// Routage d'IDENTITÉ uniquement — il ne dit rien du contenu, qui vient
// exclusivement de l'autorité. C'est ce qui le distingue de `MINT_TO_PRESET` :
// celui-là désignait un preset TypeScript, c'est-à-dire une autre autorité.

export const BOTIFY_CASEFILE_REF = "IL-SHILL-BOTIFY-001";
export const VINE_CASEFILE_REF = "IL-SHILL-VINE-001";

/** Le mint canonique VINE — celui qui porte les 50 captures rattachées. */
export const VINE_MINT = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";

const CANONICAL_REF_BY_MINT: Record<string, string> = {
  [BOTIFY_MINT]: BOTIFY_CASEFILE_REF,
  [VINE_MINT]: VINE_CASEFILE_REF,
};

/**
 * Mint → dossier canonique. `null` quand aucun dossier ne documente ce mint.
 *
 * `casefileLookupKey` résout d'abord l'alias BOTIFY synthétique vers le mint
 * canonique : la carte n'est indexée que sur des mints canoniques.
 */
export function canonicalRefForMint(mint: string | null | undefined): string | null {
  const key = casefileLookupKey(mint);
  return key ? (CANONICAL_REF_BY_MINT[key] ?? null) : null;
}

// ─── La projection ────────────────────────────────────────────────────────

/**
 * Un retrait signalé. Il porte le NOM du champ et un décompte, jamais le
 * contenu retenu.
 *
 * Le décompte n'est pas le contenu : il dit qu'il y a quelque chose à revoir
 * sans rien republier de ce qui est retenu.
 */
export interface WithheldNotice {
  readonly excluded: true;
  readonly reason: ExclusionReason;
  /** Le NOM du champ. Jamais sa valeur. */
  readonly field: string;
  readonly count: number;
}

/**
 * La provenance TELLE QU'ELLE EST RENDUE.
 *
 * Trois listes, et elles ne se mélangent jamais — c'est tout l'intérêt :
 *
 *   sources        les pièces vérifiables. Le fondement, et lui seul.
 *   unresolvedRefs les références que le registre ne connaît pas.
 *   withheldRefs   les références qui résolvent vers une pièce non publiable.
 *
 * Fondre les deux dernières dans la première serait exactement l'erreur que
 * l'étape 5 interdit : transformer une absence en fondement. Fondre `withheld`
 * dans `unresolved` serait plus discret, et faux d'une autre manière — la
 * pièce EXISTE, elle n'est simplement pas publiable en l'état.
 */
export interface RenderedProvenance {
  readonly threadUrl: string | null;
  readonly sources: readonly PublicSource[];
  readonly unresolvedRefs: readonly string[];
  readonly withheldRefs: readonly string[];
}

/**
 * `rowNature` et `evidenceRefs` sont des ENTRÉES du contrat, pas des champs
 * rendus : la projection ne change pas de forme servie dans cette passe. Les
 * pièces citées sortent par `provenance.sources`.
 */
export interface RenderedClaim extends Omit<PublicClaim, "provenance" | "rowNature" | "evidenceRefs"> {
  readonly provenance: RenderedProvenance;
}

export interface PublicProjection {
  readonly ref: string;
  readonly codename: string;
  readonly ticker: string;
  readonly title: string;
  /** `null` = score non établi. Aucun rendu ne doit lui accoler « /100 ». */
  readonly tigerScore: number | null;
  readonly verdict: string;
  /** Les claims effectivement publiables. Peut être vide — et c'est une réponse. */
  readonly claims: readonly RenderedClaim[];
  /** Les pièces vérifiables citées par ces claims. Jamais le registre entier. */
  readonly sources: readonly PublicSource[];
  /** Ce qui est retenu, nommé par champ. Vide = rien n'a été retiré. */
  readonly withheld: readonly WithheldNotice[];
}

/**
 * L'autorité canonique ne connaît pas ce dossier.
 *
 * Elle est levée plutôt que rendue en `null` silencieux : une surface qui
 * attend un dossier canonique et n'en trouve pas ne doit surtout pas se
 * rabattre sur `CASE_DB`, un preset ou un JSON. C'est le gate 2, et il n'a de
 * valeur que s'il est impossible à ignorer par distraction.
 */
export class CanonicalCaseFileMissingError extends Error {
  constructor(ref: string, where: string) {
    super(
      `[casefile] dossier canonique introuvable (${where}) : ${ref}. ` +
        "Aucun repli vers CASE_DB, le preset TypeScript ou le JSON legacy — " +
        "une deuxième autorité qui prend le relais en silence est exactement " +
        "ce que BUILD 9 supprime.",
    );
    this.name = "CanonicalCaseFileMissingError";
  }
}

/**
 * Le NOM du champ qu'un refus du contrat désigne. Aucune valeur, aucun
 * identifiant de pièce : un refus sur `SRC-001.sha256` nomme `sha256`, et
 * une référence non résolue nomme `evidenceRefs` — la clef citée n'en sort
 * pas, ce serait rendre ce qu'on retient.
 *
 * Le vocabulaire de sortie est le même qu'avant cette passe (`state`,
 * `evidenceRefs`, `sha256`, `sourceUrl`, `capturedAt`), plus `rowNature`.
 * Aucun motif nouveau : « non fondé » reste INSUFFICIENT_PROVENANCE.
 */
function champRetenu(cause: PublicClaimContractCause, at: string): string {
  switch (cause) {
    case "CLAIM_UNCLASSIFIED":
      return "rowNature";
    case "EVIDENCE_REFS_EMPTY":
    case "EVIDENCE_REF_UNRESOLVED":
      return "evidenceRefs";
    case "SOURCE_PROVENANCE_INCOMPLETE":
      return SOURCE_PROVENANCE_FIELDS.find((f) => at.endsWith(`.${f}`)) ?? "evidenceRefs";
  }
}

function ajouter(
  acc: Map<string, WithheldNotice>,
  reason: ExclusionReason,
  field: string,
): void {
  const clef = `${reason}:${field}`;
  const dejaLa = acc.get(clef);
  acc.set(clef, {
    excluded: true,
    reason,
    field,
    count: (dejaLa?.count ?? 0) + 1,
  });
}

/**
 * Projette un dossier canonique sur sa surface publique.
 *
 * Ne lit RIEN d'autre que l'autorité. Ne complète RIEN. Un dossier dont aucun
 * claim n'est publiable rend une projection vide assortie de ses avis de
 * retrait — ce qui est une réponse, pas une panne.
 */
export function projectForPublication(
  dossier: CanonicalCaseFile,
  where: string,
): PublicProjection {
  // Le gate d'abord, sur les claims TELS QUE L'AUTORITÉ LES DONNE : un claim
  // PUBLIC dont rien ne résout est une contradiction de données, et elle doit
  // lever avant qu'on entreprenne quoi que ce soit d'autre avec ce dossier.
  assertProvenanceSurvives(dossier.claims, where);

  const avis = new Map<string, WithheldNotice>();
  const publies: RenderedClaim[] = [];
  const citees = new Map<string, PublicSource>();
  // Le registre du dossier, TEL QUE L'AUTORITÉ LE DONNE. C'est contre lui que
  // le contrat résout — les mêmes entrées que l'écrivain.
  const registre = new Map<string, PublicSource>(dossier.sources.map((s) => [s.sourceId, s]));

  for (const c of dossier.claims) {
    if (c.state !== "PUBLIC") {
      // Rattaché ou admissible, mais pas publié. Le champ qui le dit est
      // `state` — pas une insuffisance de preuve, et surtout pas un jugement.
      ajouter(avis, "EXCLUDED_FROM_PUBLICATION", "state");
      continue;
    }

    // ── « X / 100 » est réservé aux métriques GOUVERNÉES ─────────────────
    //
    // Un score éditorial dans un texte de claim porte la même notation que le
    // TigerScore. Un lecteur ne les distingue pas — et sur un dossier dont le
    // TigerScore est NULL, il ne retiendrait que le chiffre éditorial.
    //
    // On ne corrige pas le texte, on ne retire pas le chiffre, on ne
    // réinterprète rien : on refuse la publication, et on le DIT. La voie de
    // retour est la reformulation, qui crée une nouvelle version du claim.
    const champScore = ungovernedScoreField(c as unknown as Record<string, unknown>);
    if (champScore) {
      ajouter(avis, "EXCLUDED_FROM_PUBLICATION", champScore);
      continue;
    }

    // ── Le critère d'émission : LE contrat canonique, consommé ──────────
    //
    // `threadUrl` n'y entre pas. Un claim n'est rendu que si sa nature est
    // classifiée, s'il cite au moins une référence, et si CHAQUE référence
    // résout vers une pièce publiable. Sinon, cas (2) : retenu, champ nommé.
    const contrat = decidePublicClaimContract(
      { rowNature: c.rowNature, evidenceRefs: c.evidenceRefs },
      registre,
    );
    if (contrat.verdict === "UNMET") {
      ajouter(avis, "INSUFFICIENT_PROVENANCE", champRetenu(contrat.refusal.cause, contrat.refusal.at));
      continue;
    }

    for (const s of contrat.cited) citees.set(s.sourceId, s);

    publies.push({
      claimId: c.claimId,
      title: c.title,
      titleFr: c.titleFr,
      description: c.description,
      descriptionFr: c.descriptionFr,
      category: c.category,
      severity: c.severity,
      status: c.status,
      claimDate: c.claimDate,
      state: c.state,
      provenance: {
        // Provenance COMPLÉMENTAIRE : rendue et citée, jamais critère.
        threadUrl: c.provenance?.threadUrl ?? null,
        sources: contrat.cited,
        // Vides par construction : le contrat MET signifie que toutes les
        // références résolvent vers des pièces publiables.
        unresolvedRefs: [],
        withheldRefs: [],
      },
    });
  }

  const withheld = [...avis.values()];
  // Chaque avis repasse la garde de forme : un retrait qui porterait une
  // valeur serait refusé ici plutôt que rendu.
  for (const n of withheld) {
    assertExclusionNoticeSafe(
      { excluded: n.excluded, reason: n.reason, field: n.field },
      `${where}.withheld`,
    );
  }

  return {
    ref: dossier.ref,
    codename: dossier.codename,
    ticker: dossier.ticker,
    title: dossier.title,
    tigerScore: dossier.tigerScore,
    verdict: dossier.verdict,
    claims: publies,
    sources: [...citees.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    withheld,
  };
}

/**
 * Charge un dossier depuis l'autorité et le projette. LÈVE si le dossier
 * n'existe pas — voir `CanonicalCaseFileMissingError`.
 */
export async function loadPublicProjection(
  ref: string,
  where: string,
): Promise<PublicProjection> {
  const dossier = await loadCanonicalCaseFile(ref);
  if (!dossier) throw new CanonicalCaseFileMissingError(ref, where);
  return projectForPublication(dossier, where);
}

// ─── S1 · PHASE A — LA FRONTIÈRE PUBLIQUE CONSOMME L'AUTORITÉ ─────────────
//
// `loadPublicProjection` répond « que peut-on publier de ce dossier ? » et
// reste l'entrée des surfaces ADMIN, qui prévisualisent des dossiers `draft`.
// Une surface PUBLIQUE ne pose pas cette question avant d'avoir posé l'autre :
// « ce dossier est-il publié ? ». C'est `publicationAuthority.decidePublication`
// qui y répond, sur la ligne lue par le lecteur canonique — pas ici, pas
// dans la page, pas dans la route.
//
// Le refus ne porte AUCUNE cause : un dossier inconnu et un dossier `draft`
// rendent la même décision. Distinguer les deux serait un oracle d'existence,
// et c'est précisément ce que la route publique ne doit pas servir.

export type PublicProjectionResult =
  | { readonly decision: "PUBLISHABLE"; readonly projection: PublicProjection }
  | { readonly decision: "REFUSED" };

/**
 * Charge un dossier, consulte l'autorité de publication, projette. Pour les
 * surfaces PUBLIQUES uniquement.
 *
 * Un dossier introuvable n'est pas distingué d'un dossier non publié : les
 * deux rendent `REFUSED`. L'absence est journalisée côté serveur — elle reste
 * bruyante pour l'opérateur, muette pour le lecteur.
 */
export async function loadPublicProjectionIfPublished(
  ref: string,
  where: string,
): Promise<PublicProjectionResult> {
  const dossier = await loadCanonicalCaseFile(ref);
  if (!dossier) {
    console.error(new CanonicalCaseFileMissingError(ref, where).message);
    return { decision: "REFUSED" };
  }
  const decision = decidePublication(dossier);
  if (decision.decision !== "PUBLISHABLE") return { decision: "REFUSED" };
  return { decision: "PUBLISHABLE", projection: projectForPublication(decision.dossier, where) };
}

/**
 * Le score tel qu'il doit être RENDU.
 *
 * `null` rend `null` — à charge du renderer d'écrire « — ». Aucun appelant ne
 * doit avoir à se souvenir que 0 n'est pas l'absence : la fonction ne rend
 * jamais 0 pour un score non établi, et ne fabrique jamais de dénominateur.
 */
export function renderedScore(tigerScore: number | null): { value: number; outOf: 100 } | null {
  return tigerScore == null ? null : { value: tigerScore, outOf: 100 };
}
