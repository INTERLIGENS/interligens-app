// ─── SURFACE EXPLORER — LE RÉSUMÉ NON GOUVERNÉ, REMPLACÉ À L'IDENTIQUE ───
//
// ██  IDENTIQUE, PAS ÉQUIVALENT — comparé sur le JSON sérialisé.           ██
//
// ─── POURQUOI ICI ON REMPLACE, ALORS QUE POUR LE MODÈLE ON SUPPRIME ─────
//
// Ce n'est pas une incohérence, c'est la même règle appliquée à deux formes.
//
//   Le pack du modèle n'a pas d'ensemble de comparaison : un `summary` absent
//   ne se compare à rien, donc le faire DISPARAÎTRE est la sortie la plus
//   pauvre. Une chaîne « [redacted] » y aurait dit qu'il y avait quelque chose.
//
//   L'Explorer sert QUATORZE dossiers côte à côte, et les quatorze portent
//   aujourd'hui un `summary` non nul. Supprimer la clé pour treize et la garder
//   pour un seul créerait un différentiel de PRÉSENCE que rien n'avait avant.
//   Remplacer par une chaîne identique n'en crée aucun : même clé, même
//   position, et les treize deviennent indistinguables entre eux.
//
// La forme du refus suit donc la forme de la surface. C'est le test d'oracle
// qui tranche, pas une préférence.
//
// ─── CE QUI EST CONTENU, MESURÉ ─────────────────────────────────────────
//
// Les neuf `summary` de type « launch » viennent de `KolTokenLink.note`, lu à
// UN SEUL endroit du dépôt (`explorerItems.ts:150`) — donc la note ne quitte
// jamais ce chemin, et le fermer ici le ferme partout. Les neuf portent du
// contenu interne, zéro propre :
//
//   TOESCOIN  « Auto-draft from Watcher V2 bridge. Internal review pending —
//               not public, not legal-reviewed. »   ← la ligne dit d'elle-même
//                                                      qu'elle n'est pas publique
//   BOTIFY    « Dad wallet received full supply allocation and dumped. »
//               ← identification relationnelle d'un parent, plus conduite
//   SERIAL    « … aucune CA attestée en base, reste non résolu (ne pas
//               deviner). »                         ← instruction au développeur
//   OVPP      « CEO = Parth Kapadia … conflict-of-interest flag »
//   BULLISH   `{"firstPromotionAt":"…","seededFrom":"bullish_seed_2026-05-14"}`
//               ← JSON de seed rendu comme prose de dossier
//
// ⚠ « Dad wallet » est servi par `KolTokenLink.note`, PAS par
// `KolCase.evidence`. Le grep menait à la seconde ; en reconstituant
// `slice(0,2)` sur l'ordre réel de la base, cette ligne est le 5ᵉ snippet du
// dossier case et n'est pas servie par là. Autre champ, autre table, autre
// chemin. Se tromper de champ, c'était corriger le mauvais et laisser le vrai.

import { fondationPossiblePour, type CheminDeDonnee } from "../fondations";

/**
 * LA CHAÎNE UNIQUE — la même pour les treize, octet pour octet.
 *
 * Elle ne dit RIEN du dossier : ni sa nature, ni sa taille, ni pourquoi. Un
 * message qui varierait selon la raison du refus serait un oracle livré avec
 * la garde.
 */
export const RESUME_NON_GOUVERNE =
  "Summary withheld — no publication decision covers this content.";

/**
 * LE RÉSUMÉ SERVI — il présente sa décision, ou il est remplacé.
 *
 * `valeurDePublication` est ce qu'on a LU dans le magasin pour ce dossier.
 * `null` signifie qu'il n'y avait rien à lire, et une décision qu'on n'a pas
 * lue n'est pas une décision.
 */
export function resumeGouverne(
  chemin: CheminDeDonnee,
  brut: string | null | undefined,
  valeurDePublication: string | null,
): string {
  const referentiel = fondationPossiblePour(chemin);
  if (referentiel === null) return RESUME_NON_GOUVERNE;
  if (valeurDePublication === null) return RESUME_NON_GOUVERNE;
  if (brut === null || brut === undefined || brut.length === 0) return RESUME_NON_GOUVERNE;
  return brut;
}
