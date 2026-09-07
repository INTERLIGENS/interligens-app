// ─── BUILD 9 — LES TROIS ÉTATS D'UN ARTEFACT DE DOSSIER ────────────────────
//
// ██  ATTACHED · ADMISSIBLE · PUBLIC — trois questions distinctes.          ██
// ██  AUCUN état n'implique le suivant. C'est le point du module.           ██
//
// ─── Pourquoi trois, et pourquoi ils vivent dans le modèle ─────────────────
//
// Le produit confondait ces trois questions en une seule colonne booléenne.
// La mesure du 2026-09-07 montre ce que ça produit — deux corpus, exactement
// inverses l'un de l'autre :
//
//     20 captures relationType='case'   publiques, 0 sha256, 0 sourceUrl
//     50 captures VINE                  0 publique, 50 sha256, 50 sourceUrl
//
// Ce qui est publié n'est pas vérifiable ; ce qui est vérifiable n'est pas
// publié. Un seul booléen ne pouvait pas dire ça, donc personne ne l'a vu.
//
//   ATTACHED    « cet artefact appartient au corpus de CE dossier »
//               Une question d'IDENTITÉ. Ne dit rien de ce qu'il prouve.
//
//   ADMISSIBLE  « cet artefact est qualifié pour soutenir CETTE assertion »
//               Une question de VALEUR PROBANTE, et elle est relative à une
//               assertion précise. Un artefact peut soutenir un claim et pas
//               un autre.
//
//   PUBLIC      « cet artefact est autorisé sur la projection publique »
//               Une question de PUBLICATION. Elle se décide, elle ne se déduit
//               pas — et le retrait est journalisé.
//
// Rattacher n'est pas publier. Publier n'est pas prouver.
//
// ─── Fail-closed ──────────────────────────────────────────────────────────
//
// Chaque promotion exige l'état précédent ET sa propre condition. L'absence
// d'information ne promeut jamais : elle bloque. Un artefact dont on ignore
// s'il porte un hash n'est pas admissible — il est en attente.

/** Les trois états, dans l'ordre où ils se gagnent. Jamais l'un sans l'autre. */
export const ARTIFACT_STATES = ["ATTACHED", "ADMISSIBLE", "PUBLIC"] as const;
export type ArtifactState = (typeof ARTIFACT_STATES)[number];

/**
 * Motifs d'exclusion. Fermés, et volontairement peu nombreux : une raison qu'on
 * ne peut pas rattacher à un critère existant n'est pas une raison, c'est une
 * appréciation.
 */
export const EXCLUSION_REASONS = [
  /** Retiré de la publication par décision, sans jugement sur le fond. */
  "EXCLUDED_FROM_PUBLICATION",
  /** La provenance ne satisfait pas les critères : ni intégrité, ni origine. */
  "INSUFFICIENT_PROVENANCE",
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

/**
 * Une exclusion NOMME LE CHAMP, jamais son contenu.
 *
 * Expliquer un retrait en citant ce qu'on retire annule le retrait. C'est la
 * leçon du containment BOTIFY : on a retiré quatre montants nominatifs, et il
 * aurait été trivial de les republier « pour expliquer ».
 */
export interface ExclusionNotice {
  readonly excluded: true;
  readonly reason: ExclusionReason;
  /** Le NOM du champ ou de l'artefact exclu. Jamais sa valeur. */
  readonly field: string;
}

export class ExclusionLeakError extends Error {
  constructor(where: string) {
    super(
      `[casefile] avis d'exclusion refusé (${where}) : il porte une valeur. ` +
        "Un retrait se signale en nommant le CHAMP, jamais son contenu — " +
        "republier l'assertion pour expliquer son retrait annule le retrait.",
    );
    this.name = "ExclusionLeakError";
  }
}

/** Les clefs qu'un avis d'exclusion ne doit JAMAIS porter. */
const CLEFS_INTERDITES = new Set([
  "value", "amount", "amountUsd", "usd", "content", "text", "assertion",
  "claim", "statement", "figure", "total", "previousValue", "withdrawnValue",
]);

/**
 * Garde de forme. Fail-closed : refuse tout ce qui ressemble à un contenu.
 * Ne nettoie pas — nettoyer en silence laisserait une source amont continuer.
 */
export function assertExclusionNoticeSafe(notice: unknown, where: string): asserts notice is ExclusionNotice {
  if (typeof notice !== "object" || notice === null) throw new ExclusionLeakError(where);
  const n = notice as Record<string, unknown>;
  if (n.excluded !== true) throw new ExclusionLeakError(where);
  if (!(EXCLUSION_REASONS as readonly string[]).includes(String(n.reason))) {
    throw new ExclusionLeakError(where);
  }
  if (typeof n.field !== "string" || n.field.length === 0) throw new ExclusionLeakError(where);
  for (const k of Object.keys(n)) {
    if (CLEFS_INTERDITES.has(k)) throw new ExclusionLeakError(where);
  }
  // Le champ doit être un IDENTIFIANT, pas une valeur déguisée.
  //
  // Une première version comptait les chiffres — et refusait `sha256`, dont le
  // nom en contient trois. Ce n'est pas le nombre de chiffres qui distingue un
  // nom d'un contenu : c'est la FORME. Un identifiant n'a ni espace, ni symbole
  // monétaire, ni ponctuation de phrase. « montant 604489 » est refusé parce
  // qu'il contient une espace, pas parce qu'il contient un nombre.
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n.field)) throw new ExclusionLeakError(where);
}

// ─── Les conditions de chaque état ─────────────────────────────────────────

/** Ce qu'un artefact doit présenter pour qu'on puisse statuer sur lui. */
export interface ArtifactEvidence {
  /** Identité du sujet auquel il est rattaché. `null` = non rattaché. */
  readonly canonicalMint?: string | null;
  /** Intégrité : l'empreinte de l'artefact. */
  readonly sha256?: string | null;
  /** Origine : d'où il vient. */
  readonly sourceUrl?: string | null;
  /** Quand il a été constaté. */
  readonly observedAt?: Date | string | null;
  /** Décision de revue déjà prise. */
  readonly reviewStatus?: string | null;
  /** Décision de publication déjà prise. */
  readonly isPublic?: unknown;
}

const rempli = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== "" && !(typeof v === "number" && Number.isNaN(v));

/**
 * ATTACHED — l'artefact désigne un sujet canonique.
 *
 * Rien d'autre n'est exigé : le rattachement est une question d'identité, et
 * un artefact peut appartenir au corpus d'un dossier sans rien prouver.
 */
export function isAttached(a: ArtifactEvidence): boolean {
  return rempli(a.canonicalMint);
}

/**
 * ADMISSIBLE — l'artefact est rattaché ET vérifiable.
 *
 * Vérifiable = intégrité (`sha256`) ET origine (`sourceUrl`). Les deux, pas
 * l'une des deux : un hash sans origine ne dit pas d'où vient la pièce, une
 * origine sans hash ne dit pas que c'est toujours la même.
 *
 * C'est exactement ce qui manque aux 20 captures publiées : ni l'un, ni l'autre.
 */
export function isAdmissible(a: ArtifactEvidence): boolean {
  if (!isAttached(a)) return false;
  return rempli(a.sha256) && rempli(a.sourceUrl) && rempli(a.observedAt);
}

/**
 * PUBLIC — l'artefact est admissible ET la publication a été DÉCIDÉE.
 *
 * `isPublic === true` strictement : `"true"`, `1` et `undefined` ne publient
 * pas. Une colonne non sélectionnée dans une requête ne doit jamais publier.
 */
export function isPublic(a: ArtifactEvidence): boolean {
  if (!isAdmissible(a)) return false;
  return a.isPublic === true && a.reviewStatus === "approved";
}

/** L'état le plus élevé qu'un artefact atteint. Jamais une supposition. */
export function artifactState(a: ArtifactEvidence): ArtifactState | null {
  if (isPublic(a)) return "PUBLIC";
  if (isAdmissible(a)) return "ADMISSIBLE";
  if (isAttached(a)) return "ATTACHED";
  return null;
}

/**
 * Pourquoi un artefact n'atteint pas l'état visé — en nommant le CHAMP qui
 * manque, jamais son contenu.
 */
export function whyNot(a: ArtifactEvidence, vise: ArtifactState): ExclusionNotice | null {
  const atteint = artifactState(a);
  if (atteint === vise) return null;
  if (!isAttached(a)) {
    return { excluded: true, reason: "EXCLUDED_FROM_PUBLICATION", field: "canonicalMint" };
  }
  if (vise !== "ATTACHED" && !isAdmissible(a)) {
    const manquant = !rempli(a.sha256) ? "sha256"
      : !rempli(a.sourceUrl) ? "sourceUrl"
      : "observedAt";
    return { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: manquant };
  }
  if (vise === "PUBLIC") {
    return { excluded: true, reason: "EXCLUDED_FROM_PUBLICATION", field: "isPublic" };
  }
  return null;
}
