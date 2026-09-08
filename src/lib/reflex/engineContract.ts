// ─── BUILD 11.1 — CE QUE LE CONTRAT D'ENTRÉE DEMANDE, ET CE QU'IL NE DEMANDE PAS ─
//
// ██  UNKNOWN est réservé aux causes RÉELLEMENT inconnues.                 ██
//
// ─── Le défaut, mesuré ────────────────────────────────────────────────────
//
// Une entrée nue — un mint collé dans REFLEX — sortait `coverage 4/8` et
// `degraded: true`, alors que la cause des quatre absences est parfaitement
// connue, et connue À L'ENDROIT MÊME où elle était écrasée :
//
//   recidivism    garde de type explicite `input.type !== "X_HANDLE"` — la
//                 propriété « récidive » est définie sur un HANDLE, pas sur
//                 un mint. Elle ne s'applique pas.
//   coordination  même garde. Le contrat V1 est profil-centrique : ce chemin
//                 ne demande pas la coordination d'un jeton.
//   offchain      la route ne construit `offChainInput` que pour URL ou
//                 X_HANDLE. Un mint nu n'a pas de substrat hors-chaîne
//                 observable — la propriété ne s'applique pas.
//   narrative     « deferred until a URL/X fetcher exists (post-V1) », et
//                 `narrativeText` n'est posé NULLE PART dans src/. Le contrat
//                 ne le demande sur aucune entrée, jamais.
//
// Aucun de ces quatre n'est cassé. Les rendre `UNKNOWN` puis `degraded`
// transformait une limite de contrat, parfaitement documentée, en ignorance —
// et, pire, rendait le signal de dégradation INUTILE : tant que
// `degraded: true` est le régime normal, il n'alerte plus de rien.
//
// ─── Une seule autorité, et c'est ce fichier ──────────────────────────────
//
// La règle est PURE et se déduit de `(moteur, type d'entrée)`. Elle est donc
// écrite ici une fois, et appelée aux deux endroits qui en ont besoin :
// l'orchestrateur, quand l'analyse est calculée, et la relecture dédupliquée,
// quand elle est rejouée depuis une ligne persistée.
//
// Ce second point n'est pas une précaution théorique : le chemin de relecture
// a déjà réeffondré `confidenceState` en BUILD 11, et c'est la production qui
// l'a montré. Ici, `reason` n'est pas persisté — le manifeste est HACHÉ et y
// toucher déplacerait la déduplication — donc la relecture RECALCULE, à partir
// du `inputType` de la ligne. Même fonction, même résultat.

import type { MeasurementState } from "@/lib/publication/absenceVocabulary";
import type { ReflexInputType, ReflexSignalSource } from "./types";

/** L'inventaire GLOBAL. Huit moteurs existent dans le produit. */
export const REFLEX_ENGINES: readonly ReflexSignalSource[] = [
  "knownBad",
  "intelligenceOverlay",
  "recidivism",
  "casefileMatch",
  "coordination",
  "tigerscore",
  "offchain",
  "narrative",
] as const;

/**
 * Pourquoi ce moteur ne se prononce pas sur ce type d'entrée — ou `null` si
 * le contrat l'ATTEND et que son absence est donc un vrai manque.
 *
 * `null` est le cas important : il signifie « ce moteur aurait dû répondre ».
 * C'est lui, et lui seul, qui doit pouvoir déclencher une dégradation.
 */
export function contractAbsenceReason(
  engine: ReflexSignalSource,
  inputType: ReflexInputType,
): MeasurementState | null {
  switch (engine) {
    // ── La propriété n'existe pas pour ce sujet ──────────────────────────
    //
    // « Ce compte a-t-il déjà récidivé » se pose sur une PERSONNE, désignée
    // par un handle. Sur un mint, la question n'a pas d'objet — ce n'est pas
    // une mesure manquante, c'est une mesure sans sujet.
    case "recidivism":
      return inputType === "X_HANDLE" ? null : "NOT_APPLICABLE";

    // Un mint nu n'a pas de substrat hors-chaîne observable : il n'y a ni
    // page, ni fil, ni compte à lire. Pour une URL ou un handle, en revanche,
    // le contrat l'attend — et son absence serait alors un vrai manque.
    case "offchain":
      return inputType === "URL" || inputType === "X_HANDLE" ? null : "NOT_APPLICABLE";

    // ── Le contrat ne le demande pas ─────────────────────────────────────
    //
    // La coordination pourrait se mesurer sur un jeton ; le contrat V1 est
    // profil-centrique et ne la demande que sur un handle. La différence avec
    // NOT_APPLICABLE compte : ici la propriété EXISTE, c'est le chemin qui ne
    // la sollicite pas. Le câblage mint -> symbole est en backlog, pas ici.
    case "coordination":
      return inputType === "X_HANDLE" ? null : "NOT_REQUESTED_BY_CONTRACT";

    // Le fetcher est différé, et `narrativeText` n'est posé nulle part dans
    // src/ : ce moteur ne s'exécute sur AUCUNE entrée, jamais. Il reste dans
    // l'inventaire global — il existe — mais il n'entre au dénominateur
    // ATTENDU d'aucun chemin, parce qu'aucun chemin ne peut le nourrir.
    case "narrative":
      return "NOT_REQUESTED_BY_CONTRACT";

    // ── Attendus partout ─────────────────────────────────────────────────
    // Leur absence est un vrai manque, et doit dégrader.
    default:
      return null;
  }
}

/** Les moteurs que le contrat ATTEND pour ce type d'entrée. */
export function expectedEnginesFor(
  inputType: ReflexInputType,
): readonly ReflexSignalSource[] {
  return REFLEX_ENGINES.filter((e) => contractAbsenceReason(e, inputType) === null);
}
