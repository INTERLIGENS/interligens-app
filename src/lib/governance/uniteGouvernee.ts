// ─── BUILD 12 · P0 · AXE 3 — L'UNITÉ GOUVERNÉE ───────────────────────────
//
// ██  Une unité n'est pas émissible parce qu'elle est VRAIE.               ██
// ██  Elle l'est parce qu'une DÉCISION DE PUBLICATION la fonde.            ██
//
// ─── CE QUE CE TYPE SIGNIFIE, ET CE QU'IL NE SIGNIFIE PAS ───────────────
//
// `UniteGouvernee` signifie EXACTEMENT deux choses, et rien de plus :
//
//   1. PROVENANCE GOUVERNÉE — la valeur vient d'un magasin dont on sait lire
//      la décision de publication.
//   2. DÉCISION EXPLICITE POUR CE CONTEXTE — cette décision a été CONSTATÉE,
//      pas supposée, et elle porte sur CE sujet.
//
// Elle ne signifie PAS « vrai ». Une unité parfaitement gouvernée peut être
// fausse : le compte `linkedActorsCount` sous-compte (2 pour 5 liens), le
// verdict `CONFIRMED` sort d'une dérivation tautologique, « UNDER ACTIVE
// SURVEILLANCE » est affirmé pour 107 personnes alors que le cron en scanne
// 50. Ces trois-là sont des défauts de VÉRITÉ. Ils appartiennent à
// ASSERTION CORRECTNESS, jamais à ce fichier.
//
// La confusion des deux axes est la faute que ce module existe pour rendre
// impossible : un moteur de publication qui prétendrait établir la vérité
// serait un moteur de vérité déguisé, et il mentirait sur les deux.
//
// ─── POURQUOI LA CLÉ N'EST PAS LE NOM DU CHAMP ──────────────────────────
//
// Mesuré, et c'est la raison pour laquelle aucune liste noire de noms de
// champs n'a été construite : `KolTokenLink.note` porte tour à tour
//
//   TOESCOIN  → un STATE de workflow  (« Internal review pending »)
//   BOTIFY    → une ASSERTION nominative (« Dad wallet … dumped »)
//   DIONE     → une OBSERVATION factuelle (adresse de contrat, dates)
//   BULLISH   → du JSON de seed brut (`seededFrom: bullish_seed_…`)
//
// UN MÊME NOM, QUATRE NATURES. Une garde indexée sur le nom aurait classé
// les quatre pareil, donc mal trois fois. La clé est le couple
// (assertion sémantique × provenance causale), et il se PRÉSENTE.

declare const GOUVERNEE: unique symbol;
declare const DECIDE: unique symbol;

/**
 * La nature SÉMANTIQUE de ce qui est affirmé. Elle ne se devine pas d'un
 * `typeof` ni d'un nom de champ — elle se déclare, parce qu'elle est un
 * jugement sur ce que la phrase FAIT au sujet.
 */
export type Nature = "STATE" | "OBSERVATION" | "ASSERTION" | "VERDICT";

/**
 * LE RÉFÉRENTIEL EST FERMÉ — cinq entrées, et c'est tout.
 *
 * Ce sont les seules décisions de publication qui existent dans le dépôt,
 * mesurées une par une. Fermer l'union est le point : une surface qui aurait
 * besoin d'une sixième fondation ne peut pas l'inventer sur place, elle doit
 * venir la déclarer ici — donc devant quelqu'un.
 */
export type ReferentielDeDecision =
  | "KolProfile.publishStatus"
  | "KolProfile.proceedsPublication"
  | "KolTokenLink.visibility"
  | "EvidenceSnapshot.isPublic+reviewStatus"
  | "PlatformCaseFile.publishStatus";

/**
 * Une décision CONSTATÉE. Le symbole unique la rend inconstructible hors de
 * ce module : on ne peut pas écrire un objet qui « ressemble » à une décision,
 * exactement comme on ne peut pas écrire un objet qui ressemble à une
 * `Admission`.
 */
export interface DecisionDePublication {
  readonly referentiel: ReferentielDeDecision;
  /** À propos de QUI ou de QUOI la décision porte. Jamais vide. */
  readonly sujet: string;
  /** La valeur RÉELLEMENT lue dans le magasin. Jamais une valeur par défaut. */
  readonly valeurConstatee: string;
  readonly [DECIDE]: true;
}

/**
 * L'unité émissible. Sa `valeur` n'existe dans ce type que parce qu'une
 * décision a été présentée — c'est en cela que la marque est PORTANTE et non
 * décorative.
 */
export interface UniteGouvernee<N extends Nature, T> {
  readonly nature: N;
  readonly valeur: T;
  readonly fondeePar: DecisionDePublication;
  readonly [GOUVERNEE]: N;
}

/**
 * CONSTATER une décision — l'unique constructeur, et il peut RENDRE NULL.
 *
 * `admissible` n'est pas un drapeau de confort : c'est le résultat de la
 * lecture du magasin, passé par l'appelant qui l'a lu. Quand il est faux, il
 * n'existe aucun chemin vers une `UniteGouvernee`. C'est le fail-closed : pas
 * de valeur par défaut, pas de repli, pas de « on verra ».
 */
export function constaterDecision(
  referentiel: ReferentielDeDecision,
  sujet: string,
  valeurConstatee: string,
  admissible: boolean,
): DecisionDePublication | null {
  if (!admissible) return null;
  if (sujet.length === 0) return null;
  if (valeurConstatee.length === 0) return null;
  return { referentiel, sujet, valeurConstatee } as unknown as DecisionDePublication;
}

/**
 * GOUVERNER une valeur — il faut PRÉSENTER la décision.
 *
 * La signature exige une `DecisionDePublication`, donc un `constaterDecision`
 * qui n'a pas rendu `null`. Il n'existe aucune surcharge « sans décision » :
 * c'est la propriété que GPT a posée comme condition de validation.
 */
export function gouverner<N extends Nature, T>(
  nature: N,
  valeur: T,
  fondeePar: DecisionDePublication,
): UniteGouvernee<N, T> {
  return { nature, valeur, fondeePar } as unknown as UniteGouvernee<N, T>;
}

/**
 * LE REFUS — identique, jamais équivalent.
 *
 * Mesuré sur la Watchlist : la partition 11 / 96 est déjà reconstructible par
 * six différentiels indépendants, dont le moins cher est la simple présence
 * d'une balise `<a>`. Un refus qui varierait de forme, de longueur ou de
 * position ajouterait un septième différentiel. Il doit donc être LA MÊME
 * SUITE D'OCTETS pour tous les sujets refusés, quelle qu'en soit la raison —
 * absent, non publié, conflit d'identité.
 *
 * `raison` est retournée pour le JOURNAL, et elle ne doit jamais atteindre la
 * charge émise. C'est pour ça qu'elle vit à côté de la valeur, pas dedans.
 */
export type RaisonDeRefus =
  | "SUJET_ABSENT"
  | "SUJET_NON_PUBLIE"
  | "CONFLIT_IDENTITE"
  | "AUCUNE_FONDATION_POSSIBLE"
  | "APPARTENANCE_NON_AUTORISEE";

export interface Refus {
  readonly refuse: true;
  readonly raison: RaisonDeRefus;
}

export const refuser = (raison: RaisonDeRefus): Refus => ({ refuse: true, raison });

export const estRefus = (v: unknown): v is Refus =>
  typeof v === "object" && v !== null && (v as { refuse?: unknown }).refuse === true;

/** Dévoile la valeur portée. Réservé aux terminaux de la frontière. */
export function devoiler<N extends Nature, T>(u: UniteGouvernee<N, T>): T {
  return u.valeur;
}

/**
 * La forme qu'une projection doit rendre : un enregistrement dont CHAQUE
 * valeur est gouvernée. C'est ce qui empêche `(e) => ({ ref: e.ref })` de
 * compiler — il n'y a pas de chemin de type entre un champ nu et cette forme.
 */
export type EnregistrementGouverne = Record<string, UniteGouvernee<Nature, unknown>>;

/** Le type de la charge une fois dévoilée, champ par champ. */
export type DevoileDe<O extends EnregistrementGouverne> = {
  -readonly [K in keyof O]: O[K] extends UniteGouvernee<Nature, infer V> ? V : never;
};

/** Dévoile un enregistrement entier. Appelé par la frontière, pas par les surfaces. */
export function devoilerEnregistrement<O extends EnregistrementGouverne>(o: O): DevoileDe<O> {
  const sortie: Record<string, unknown> = {};
  for (const cle of Object.keys(o)) sortie[cle] = o[cle].valeur;
  return sortie as DevoileDe<O>;
}
