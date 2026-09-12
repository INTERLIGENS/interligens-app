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
 * ─── L'INVARIANT QUE CE MODULE PORTE ────────────────────────────────────
 *
 * « Collection admissibility has two layers: membership semantics and
 *   member-content semantics. Non-assertive membership may require no
 *   publication decision, but that exemption must itself be explicit and
 *   cannot waive governance of contained semantic units. »
 *
 * DEUX COUCHES, et aucune ne rachète l'autre :
 *
 *   COUCHE 1 · l'APPARTENANCE   figurer dans cette collection affirme-t-il
 *              quelque chose sur le sujet, indépendamment de ce qu'on affiche
 *              de lui ?
 *   COUCHE 2 · le CONTENU       chaque unité contenue reste soumise à SON
 *              autorité de publication, quoi qu'il arrive à la couche 1.
 *
 * La couche 2 est tenue par le TYPE : `M extends EnregistrementGouverne`. Une
 * collection dispensée de décision d'appartenance ne peut pas pour autant
 * transporter un champ nu — il n'existe aucun chemin de type vers ce paramètre.
 */
export type SemantiqueDAppartenance = "ASSERTIVE" | "NON_ASSERTIVE";

/**
 * L'autorité qui porte sur le FAIT D'APPARTENIR, distincte de toute décision
 * prise sur les membres.
 */
export interface AutoriteDAppartenance<C extends string> {
  readonly collection: C;
  /**
   * ⚠ POSITIVEMENT DÉCLARÉ, JAMAIS DÉDUIT DE L'ABSENCE D'UNE DÉCISION.
   *
   * C'est la ligne qui empêche `NON_ASSERTIVE` de devenir une échappatoire
   * générique. Si la non-assertivité se déduisait d'un `fondeePar === null`,
   * alors toute collection qu'on aurait oublié de fonder deviendrait
   * automatiquement dispensée — et l'oubli vaudrait décision.
   *
   * AUCUNE collection silencieuse ou indéterminée ne tombe dans
   * `NON_ASSERTIVE`. LE SILENCE RESTE UN REFUS, et `projeterCollection` le
   * tient à l'exécution, sous le type.
   */
  readonly semantique: SemantiqueDAppartenance;
  /** La décision qui AUTORISE l'appartenance. `null` = il n'y en a pas. */
  readonly fondeePar: DecisionDePublication | null;
  readonly [APPARTENANCE]: C;
}

export function declarerCollection<C extends string>(
  collection: C,
  semantique: SemantiqueDAppartenance,
  fondeePar: DecisionDePublication | null,
): AutoriteDAppartenance<C> {
  return { collection, semantique, fondeePar } as unknown as AutoriteDAppartenance<C>;
}

export interface CollectionGouvernee<C extends string, M extends EnregistrementGouverne> {
  readonly collection: C;
  readonly membres: readonly M[];
  /**
   * `null` sur une collection NON_ASSERTIVE, et ce n'est pas une lacune : il
   * n'y a rien à fonder quand l'appartenance n'affirme rien. La dispense est
   * portée par `semantique`, jamais par ce champ.
   */
  readonly fondeePar: DecisionDePublication | null;
}

/**
 * PROJETER UNE COLLECTION — et le refus ne regarde PAS les membres.
 *
 * L'ordre des clauses ci-dessous est la propriété : la sémantique
 * d'appartenance est examinée AVANT que `membres` ne soit seulement lu. Un
 * lecteur pressé pourrait croire qu'un tableau vide ou plein change quelque
 * chose. Il ne change rien, et c'est le sujet.
 */
export function projeterCollection<C extends string, M extends EnregistrementGouverne>(
  autorite: AutoriteDAppartenance<C>,
  membres: readonly M[],
): CollectionGouvernee<C, M> | Refus {
  // ─── LE SILENCE EST UN REFUS, ET LE TYPE NE SUFFIT PAS À LE TENIR ──────
  //
  // `semantique` est obligatoire dans le type, donc on ne peut pas l'omettre
  // en écrivant du code honnête. Mais un `as` suffit à faire taire le
  // compilateur — c'est la leçon du huitième mutant de S21, et la garde de
  // capacité est le FILET SOUS LE TYPE, pas son doublon.
  //
  // Une collection qui ne déclare RIEN est REFUSÉE. Elle n'est PAS traitée
  // comme non-assertive : sans ce refus, l'échappatoire serait ouverte par
  // OMISSION, ce qui est la seule façon dont ce genre de porte s'ouvre.
  if (autorite.semantique !== "ASSERTIVE" && autorite.semantique !== "NON_ASSERTIVE") {
    return refuser("APPARTENANCE_NON_DECLAREE");
  }

  // ─── COUCHE 1 · L'APPARTENANCE ────────────────────────────────────────
  if (autorite.semantique === "ASSERTIVE" && autorite.fondeePar === null) {
    return refuser("APPARTENANCE_NON_AUTORISEE");
  }

  // ─── COUCHE 2 · LE CONTENU ────────────────────────────────────────────
  //
  // Elle est tenue par la signature : `M extends EnregistrementGouverne`. Une
  // appartenance non-assertive dispense de décider du MEMBERSHIP ; elle ne
  // dispense de rien d'autre. Les unités contenues restent individuellement
  // soumises à leur autorité, et il n'existe aucun chemin de type entre un
  // champ nu et ce paramètre.
  return { collection: autorite.collection, membres, fondeePar: autorite.fondeePar };
}
