// ─── ADMISSIBILITÉ D'ENTRÉE DU MODÈLE ────────────────────────────────────
//
// ██  UN MODÈLE N'EST PAS UNE FRONTIÈRE D'ADMISSIBILITÉ.                   ██
//
// ─── LA MESURE ──────────────────────────────────────────────────────────
//
// `buildCaseIntelligencePack.ts:313-325` interroge `KolCase` avec un `where`
// qui ne porte QUE sur `kolHandle` — aucun filtre de publication — puis
// l. 528-531 pose `summary: c.evidence` dans `intelVaultRefs`. Et
// `…/assistant/route.ts:27` injecte `JSON.stringify(pack, null, 2)` **entier**
// dans le system prompt.
//
// Ce qui entre par là, mesuré verbatim sur les quatre dossiers servis :
//
//   « GHOST overlap with BK/SAM cluster. Under investigation. »
//   « GHOST overlap — cross-ref @lynk0x ongoing. »
//   « Promotion alongside @bkokoski during BOTIFY active period. »
//   « … Source: mariaqueennft Feb 2026. »
//   « … Master controller qiwu.eth … ZachXBT investigation APR 18 2026. »
//
// Un état d'enquête publié comme fait, des renvois nominatifs croisés, des
// attributions à des tiers nommés. Jusqu'à cinq lignes `KolCase` par affaire.
//
// ─── POURQUOI LE GUARD EST EN ENTRÉE, ET PAS EN SORTIE ──────────────────
//
// Un guard de sortie reste nécessaire — et il NE REMPLACE JAMAIS celui-ci.
// La raison est mesurable : une fois la phrase dans le prompt, plus aucune
// liaison statique ne démontre ce qu'il en advient. La garantie possible en
// aval est ATTESTEE, jamais RESTREINTE. Construire l'un en croyant faire
// l'autre laisserait le contenu entrer et parierait sur la sortie.
//
// ─── LE RÉFÉRENTIEL DÉCIDE, PAS LE NOM DU CHAMP ─────────────────────────
//
// La table ci-dessous ne dit pas « `evidence` est interdit ». Elle dit :
// « pour CE chemin de donnée, voici la décision de publication qui pourrait
// le fonder — ou il n'en existe aucune ». La différence compte : le même mot
// `note` porte ailleurs un STATE de workflow, une ASSERTION nominative, une
// OBSERVATION factuelle et du JSON de seed. Une liste noire de noms se serait
// trompée trois fois sur quatre.

import { constaterDecision, type DecisionDePublication } from "./uniteGouvernee";
import { fondationPossiblePour, type CheminDeDonnee } from "./fondations";

// La table vit dans `fondations.ts` et elle est PARTAGÉE. Un second
// exemplaire ici serait l'Invariant Propagation Failure appliqué à la
// gouvernance elle-même : le modèle et l'Explorer répondraient à deux
// versions de la même question.
export { fondationPossiblePour, type CheminDeDonnee } from "./fondations";

/**
 * CE QUI ENTRE DANS LE PROMPT — et il faut présenter la décision.
 *
 * `valeurDePublication` est ce qu'on a LU dans le magasin pour ce sujet. Quand
 * le chemin n'a aucune fondation possible, l'appelant n'a rien à lire et rien
 * à présenter : la fonction rend `undefined`, et le champ disparaît du pack.
 *
 * Le refus est IDENTIQUE pour tous les sujets — `undefined`, jamais une chaîne
 * de remplacement. Une chaîne « [redacted] » réintroduirait un différentiel :
 * elle dirait qu'il y avait quelque chose.
 */
export function entreeAdmissiblePourModele(
  chemin: CheminDeDonnee,
  sujet: string,
  brut: string | null | undefined,
  valeurDePublication: string | null,
): { valeur: string; fondeePar: DecisionDePublication } | undefined {
  const referentiel = fondationPossiblePour(chemin);
  if (referentiel === null) return undefined;
  if (brut === null || brut === undefined || brut.length === 0) return undefined;
  if (valeurDePublication === null) return undefined;
  const decision = constaterDecision(referentiel, sujet, valeurDePublication, true);
  if (decision === null) return undefined;
  return { valeur: brut, fondeePar: decision };
}
