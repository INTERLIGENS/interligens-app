// ─── SURFACE WATCHLIST — LE RETRAIT CAUSAL DE LA PROJECTION NOMINATIVE ───
//
// ██  Les 107 entrées ne sont PAS détruites. La projection s'arrête.       ██
//
// `src/lib/watcher/handles.ts` garde ses 108 entrées, la base garde ses
// lignes, le cron garde sa source de vérité. Ce qui cesse, c'est l'ÉMISSION.
// La Watchlist reste un outil interne d'enquête ; elle n'est plus une surface
// servie.
//
// ─── POURQUOI LE RETRAIT NE PEUT PAS ÊTRE UNE ROUTE QUI NE RÉPOND PLUS ──
//
// Si le retrait était « on a vidé le handler », alors quelqu'un qui rebranche
// la route demain fait repartir le contenu. Le retrait doit être PORTÉ PAR
// L'AUTORITÉ : la collection est déclarée assertive et sans fondation, donc
// `projeterCollection` refuse, et il n'existe aucun chemin de type entre les
// 107 membres et la charge que la frontière accepte.
//
// ─── ET POURQUOI LE REFUS EST AU NIVEAU DE LA COLLECTION ────────────────
//
// Le test d'oracle rend NON sur cette surface. La partition 11 publiés / 96
// non publiés est DÉJÀ reconstructible par six différentiels indépendants et
// mesurés :
//
//   1. le CTA        `<a href="/en/kol/…">` contre `<span>`  — le moins cher
//   2. « Money taken »  cinq valeurs contre un état vide
//   3. la prose des drapeaux  phrases contre `[]`
//   4. « All tokens touched »  pastilles contre « No on-chain history »
//   5. `displayName`  clé présente contre clé absente
//   6. `tier` / `riskFlag` / `rugCount`  non nuls contre nullifiés
//
// Contenir les champs un par un en laisserait toujours un. Et même les six
// fermés, il resterait l'essentiel : ÊTRE NOMMÉ SUR CETTE PAGE EST
// L'ASSERTION. L'unité de containment n'est pas la ligne, c'est la LISTE.
//
// Le refus ci-dessous ne porte donc AUCUN compte, AUCUNE longueur, AUCUNE
// clé par membre, AUCUN ordre. Il est la même suite d'octets pour tout
// appelant, et le type `CorpsDeRefus` est ce qui l'empêche de dériver.

import {
  projeterRefus,
  type Admissible,
  type Admission,
  type Audience,
  type CorpsDeRefus,
} from "../audienceProjection";
import { declarerCollection, projeterCollection } from "../appartenance";
import { fondationPossiblePour } from "../fondations";
import { estRefus, type EnregistrementGouverne } from "../uniteGouvernee";

/**
 * LE CORPS SERVI — constant, gelé, et sans aucun champ où glisser un compte.
 *
 * `Object.freeze` n'est pas décoratif : il transforme une mutation accidentelle
 * en erreur au lieu d'une fuite silencieuse à l'exécution.
 */
export const REFUS_WATCHLIST: CorpsDeRefus = Object.freeze({
  refus: true as const,
  code: "COLLECTION_AUTHORITY_REQUIRED",
  surface: "watchlist",
});

/**
 * L'AUTORITÉ D'APPARTENANCE DE LA WATCHLIST.
 *
 * `appartenanceEstUneAssertion: true` — figurer sous « UNDER ACTIVE
 * SURVEILLANCE » et « They're selling. You're buying. » affirme quelque chose
 * sur la personne, indépendamment de ce qu'on affiche d'elle.
 *
 * `fondeePar` vient de la table des fondations, pas d'un `null` écrit à la
 * main : `handlesV2` est un tableau TypeScript saisi à la main, il n'existe
 * aucun magasin où lire une décision d'appartenance. Le jour où il en
 * existerait un, c'est la table qui changerait — pas cette ligne.
 */
export function autoriteDeLaWatchlist() {
  return declarerCollection("Watchlist", "ASSERTIVE", null);
}

/**
 * Le `null` ci-dessus n'est pas une opinion : il est ADOSSÉ à la table des
 * fondations, et ce prédicat est ce qui le relie.
 *
 * Écrire `fondationPossiblePour(...) === null ? null : null` aurait eu l'air
 * de consulter la table tout en l'ignorant — une consultation décorative,
 * c'est-à-dire la faute que ce module entier existe pour rendre impossible.
 * Le lien est donc une ASSERTION vérifiée à la projection, pas un ternaire
 * qui rend la même chose des deux côtés.
 */
export function appartenanceSansFondation(): boolean {
  return fondationPossiblePour("Watchlist.appartenance") === null;
}

/**
 * PROJETER LA WATCHLIST — et elle refuse, quels que soient les membres.
 *
 * Les membres sont bien passés, et c'est le point : la fonction les reçoit,
 * les ignore, et refuse. Un lecteur qui croirait que « passer zéro membre »
 * change quelque chose se trompe, et le test le prouve en comparant les deux
 * sorties.
 */
export function projeterWatchlist<A extends Audience>(
  admission: Admission<A>,
  membres: readonly EnregistrementGouverne[],
): Admissible<A, { forme: "json"; valeur: CorpsDeRefus }> {
  if (!appartenanceSansFondation()) {
    // La table a changé. Une décision d'appartenance existerait désormais, et
    // il faudrait la LIRE dans un magasin — ce qu'une fonction pure ne peut pas
    // faire. On ferme au lieu de servir sur une fondation devinée.
    throw new Error(
      "watchlist: la table des fondations declare une fondation d'appartenance — la lecture doit etre ecrite explicitement",
    );
  }
  const projection = projeterCollection(autoriteDeLaWatchlist(), membres);
  if (!estRefus(projection)) {
    // Inatteignable tant que l'appartenance n'a pas de fondation — et si elle
    // en acquiert une un jour, ce chemin doit être ÉCRIT, pas deviné. On ferme
    // plutôt que de laisser une branche muette décider à notre place.
    throw new Error(
      "watchlist: l'appartenance a acquis une fondation — la projection servie doit être écrite explicitement",
    );
  }
  return projeterRefus(admission, REFUS_WATCHLIST);
}
