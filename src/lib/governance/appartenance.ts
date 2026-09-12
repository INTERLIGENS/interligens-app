// ─── L'AUTORITÉ DE COLLECTION — L'APPARTENANCE EST UNE ASSERTION ─────────
//
// ██  « Collection membership can itself constitute a governed assertion    ██
// ██    independently of the fields displayed for each member. »            ██
//
// Cet invariant COMPLÈTE « la plus petite unité sémantique », il ne la
// remplace pas : l'unité minimale n'est pas toujours un champ. Une RELATION
// STRUCTURELLE — être dans cette liste — peut porter seule une sémantique
// gouvernée, et aucune décision prise sur les champs d'un membre ne la fonde.
//
// ─── LA MESURE QUI FONDE CE MODULE ──────────────────────────────────────
//
// Sur `/en/watchlist`, 107 personnes sont nommées sous un bandeau
// « UNDER ACTIVE SURVEILLANCE » et « They're selling. You're buying. ».
// Onze ont un dossier publié, quatre-vingt-seize n'en ont aucun.
//
// On aurait pu croire qu'il suffisait de contenir les champs. Non : la
// partition 11 / 96 est DÉJÀ reconstructible par six différentiels
// indépendants, dont le moins cher est la simple présence d'une balise
// `<a href="/en/kol/…">` contre un `<span>`. Et même en supprimant les six,
// il resterait l'essentiel — ÊTRE NOMMÉ SUR CETTE PAGE EST L'ASSERTION.
// Aucun containment intra-ligne ne la masque, parce qu'elle n'est pas dans
// la ligne : elle est dans le fait qu'il y ait une ligne.
//
// ─── CE QUE LE TYPE REND IMPOSSIBLE ─────────────────────────────────────
//
// Projeter 107 membres parfaitement gouvernés et appeler ça une collection
// gouvernée. `projeterCollection` REFUSE quels que soient les membres — même
// si les 107 portent chacun une `DecisionDePublication` valide. C'est la
// propriété testée par le mutant « 107 membres irréprochables, refus quand
// même » : sans elle, ce module serait une décoration et la Watchlist
// repartirait au premier refactor.

import {
  refuser,
  type DecisionDePublication,
  type EnregistrementGouverne,
  type Refus,
} from "@/lib/governance/uniteGouvernee";

declare const APPARTENANCE: unique symbol;

/**
 * L'autorité qui porte sur le FAIT D'APPARTENIR, distincte de toute décision
 * prise sur les membres.
 */
export interface AutoriteDAppartenance<C extends string> {
  readonly collection: C;
  /**
   * Le cœur. `true` signifie : figurer dans cette collection affirme quelque
   * chose sur le sujet, indépendamment de ce qu'on affiche de lui.
   *
   * Il n'a pas de valeur par défaut, et c'est délibéré : une collection dont
   * personne n'a répondu à cette question ne peut pas être projetée.
   */
  readonly appartenanceEstUneAssertion: boolean;
  /** La décision qui AUTORISE l'appartenance. `null` = il n'y en a pas. */
  readonly fondeePar: DecisionDePublication | null;
  readonly [APPARTENANCE]: C;
}

export function declarerCollection<C extends string>(
  collection: C,
  appartenanceEstUneAssertion: boolean,
  fondeePar: DecisionDePublication | null,
): AutoriteDAppartenance<C> {
  return {
    collection,
    appartenanceEstUneAssertion,
    fondeePar,
  } as unknown as AutoriteDAppartenance<C>;
}

export interface CollectionGouvernee<C extends string, M extends EnregistrementGouverne> {
  readonly collection: C;
  readonly membres: readonly M[];
  readonly fondeePar: DecisionDePublication;
}

/**
 * PROJETER UNE COLLECTION — et le refus ne regarde PAS les membres.
 *
 * L'ordre des lignes ci-dessous est la propriété : la décision d'appartenance
 * est examinée AVANT que `membres` ne soit seulement lu. Un lecteur pressé
 * pourrait croire qu'un tableau vide ou plein change quelque chose. Il ne
 * change rien, et c'est le sujet.
 */
export function projeterCollection<C extends string, M extends EnregistrementGouverne>(
  autorite: AutoriteDAppartenance<C>,
  membres: readonly M[],
): CollectionGouvernee<C, M> | Refus {
  if (autorite.appartenanceEstUneAssertion && autorite.fondeePar === null) {
    return refuser("APPARTENANCE_NON_AUTORISEE");
  }
  if (autorite.fondeePar === null) {
    // Appartenance non-assertive ET sans décision : il n'y a rien à fonder,
    // mais il n'y a rien non plus à émettre comme collection gouvernée. On
    // ferme plutôt que d'inventer une fondation vide.
    return refuser("AUCUNE_FONDATION_POSSIBLE");
  }
  return { collection: autorite.collection, membres, fondeePar: autorite.fondeePar };
}
