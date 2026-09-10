// ─── BUILD 12 · LA MARQUE PORTANTE — PROJECTION D'AUDIENCE ────────────────
//
// ██  On ne peut pas DIRE qu'on projette sans PROJETER.                    ██
//
// La porte ratifiée :
//
//   « A projection declaration counts only if it CAUSALLY PRODUCES the value
//     accepted by the governed response boundary. A comment/flag/registry
//     entry beside a raw response is insufficient.
//     DECLARATION IS EVIDENCE ONLY WHEN LOAD-BEARING. »
//
// ─── POURQUOI UNE MARQUE DÉCLARATIVE NE POUVAIT PAS MARCHER ─────────────
//
// La mesure qui fonde ce module n'est pas une préférence d'architecture,
// c'est une impossibilité constatée : `where: { isPublic: true }` écrit comme
// DÉCISION D'ACCÈS est TEXTUELLEMENT IDENTIQUE à la même ligne écrite comme
// FILTRE D'AFFICHAGE. Aucune relecture, aucun balayage, aucun registre ne peut
// les distinguer — parce qu'il n'y a rien à distinguer dans le texte.
//
// Un drapeau, un commentaire, une entrée de registre : tous peuvent être
// présents pendant que la route émet n'importe quoi. Une marque déclarative
// reproduit donc le défaut avec un mot de plus.
//
// La marque doit être PORTANTE : elle doit être la chose qui PRODUIT la charge
// émise, pas une chose posée à côté d'elle.
//
// ─── DEUX AXES, ORTHOGONAUX, ET AUCUN NE REMPLACE L'AUTRE ───────────────
//
//   AXE 1 · QUI est admis ?          `Admission<A>`
//   AXE 2 · QUE peut recevoir cette audience ?   `Admissible<A, T>`
//
// Ils sont indépendants, et c'est le point. Une clé partenaire authentifie ;
// elle n'entitule pas à tout. Faire dériver le second axe du premier rendrait
// un blanc-seing à toute surface authentifiée — c'est-à-dire précisément là
// où le blanc-seing coûte le plus cher.
//
// Une surface peut légitimement être les DEUX : authentifiée ET projetée.
//
// ─── COMMENT LA FRONTIÈRE REND LA DÉCLARATION INÉVITABLE ────────────────
//
// `repondre()` n'accepte QUE des valeurs `Admissible`. `projeter()` en est le
// SEUL constructeur, et il exige une `Admission` — laquelle ne s'obtient que
// par une admission nommée. Émettre une donnée brute ne compile pas : il n'y a
// pas de chemin depuis un objet nu jusqu'au type que la frontière accepte.
//
// La déclaration d'audience n'est donc pas à côté de la réponse ; elle est
// DANS la valeur que la réponse transporte, et elle y est parce qu'elle a été
// traversée.
//
// ─── CE QUE CE TYPE NE PROUVE PAS, ET IL FAUT LE DIRE ───────────────────
//
// Il prouve le PASSAGE CAUSAL : la valeur émise est bien sortie d'une
// projection déclarée pour cette audience. Il ne prouve PAS que la projection
// RETIRE quelque chose — `projeter(adm, x, (v) => v)` est une projection
// identité, et le type l'accepte.
//
// Ce n'est pas un trou : c'est la frontière exacte entre ce qu'un mécanisme
// peut établir et ce qui relève du jugement. L'adéquation d'une projection à
// son audience est une décision normative de produit ; elle appartient à la
// passe humaine de classification, et la simuler ici la rendrait invisible.
// Le mécanisme garantit qu'il y a EU une décision et qu'elle porte ; il ne
// peut pas garantir qu'elle est BONNE.
//
// ─── ET LE TYPE SE CONTOURNE PAR UN CAST ────────────────────────────────
//
// Leçon du huitième mutant de S21, transposée sans rien changer : un
// `as Admissible<…>` est invisible au compilateur ET au relecteur pressé. La
// garde de capacité est le FILET SOUS LE TYPE, pas son doublon — c'est elle
// qui attrape ce que le type ne peut structurellement pas voir.

/**
 * Les audiences gouvernées.
 *
 * `OPERATOR` est la seule à droits maximaux, et c'est ce qui lui permet
 * d'émettre intégralement — voir `projeterIntegralement`.
 */
export type Audience = "ANONYMOUS" | "PARTNER" | "OPERATOR";

declare const ADMIS: unique symbol;
declare const PROJETE: unique symbol;

/**
 * L'AXE 1 — qui est admis, et par quoi.
 *
 * Le symbole unique la rend inconstructible hors de ce module : on ne peut pas
 * écrire un objet qui « ressemble » à une admission.
 */
export interface Admission<A extends Audience> {
  readonly audience: A;
  /** Ce qui a établi l'admission. Jamais une valeur par défaut. */
  readonly etabliePar: string;
  readonly [ADMIS]: true;
}

/**
 * L'AXE 2 — ce que cette audience peut recevoir.
 *
 * La marque porte l'audience : une valeur projetée pour `PARTNER` n'est pas
 * assignable là où une valeur projetée pour `ANONYMOUS` est attendue, et
 * réciproquement. Les deux axes voyagent ensemble dans la valeur émise.
 */
export type Admissible<A extends Audience, T extends object> = T & {
  readonly [PROJETE]: A;
};

const marquer = <A extends Audience>(audience: A, etabliePar: string): Admission<A> =>
  ({ audience, etabliePar } as Admission<A>);

/** Admission par une porte d'authentification d'opérateur. */
export function admettreOperateur(porte: string): Admission<"OPERATOR"> {
  return marquer("OPERATOR", porte);
}

/** Admission par une clé partenaire. Authentifié n'est PAS entitulé à tout. */
export function admettrePartenaire(porte: string): Admission<"PARTNER"> {
  return marquer("PARTNER", porte);
}

/**
 * Admission anonyme — et elle exige un MOTIF écrit.
 *
 * C'est délibéré et c'est le cœur de l'axe 1 : l'absence de porte ne prouve
 * jamais une publication intentionnelle. Une surface anonyme doit DIRE qu'elle
 * l'est, sans quoi on ne peut pas distinguer une publication décidée d'une
 * garde oubliée — l'exacte impossibilité que ce module ferme.
 */
export function admettreAnonyme(motif: string): Admission<"ANONYMOUS"> {
  return marquer("ANONYMOUS", motif);
}

/**
 * LA PROJECTION — seul constructeur d'une valeur admissible.
 *
 * Elle prend l'admission, l'entrée, et la fonction qui restreint. La valeur
 * rendue n'existe que parce que la projection a tourné : c'est en cela que la
 * déclaration est PORTANTE et non décorative.
 */
export function projeter<A extends Audience, In, Out extends object>(
  admission: Admission<A>,
  entree: In,
  projection: (entree: In) => Out,
): Admissible<A, Out> {
  void admission;
  return projection(entree) as Admissible<A, Out>;
}

/**
 * L'ÉMISSION INTÉGRALE — réservée à l'audience à droits maximaux.
 *
 * Elle existe pour que la doctrine ACCESS_CLOSED ne soit pas TAXÉE : une
 * surface d'opérateur n'a pas à rédiger une projection restrictive pour
 * satisfaire une garde. Une garde qui exigerait ce travail inutile serait un
 * impôt, et un impôt finit désarmé.
 *
 * Mais elle reste EXPLICITE, et son audience est contrainte par le type : ni
 * `ANONYMOUS` ni `PARTNER` ne peuvent l'appeler. « Pas de projection » cesse
 * donc d'être un silence et devient une affirmation, vérifiable, et réservée
 * au seul cas où elle se justifie.
 */
export function projeterIntegralement<T extends object>(
  admission: Admission<"OPERATOR">,
  entree: T,
): Admissible<"OPERATOR", T> {
  void admission;
  return entree as Admissible<"OPERATOR", T>;
}

/**
 * LA FRONTIÈRE DE RÉPONSE GOUVERNÉE.
 *
 * Elle n'accepte que ce qui a traversé une projection. Un objet nu n'a aucun
 * chemin de type vers ce paramètre : c'est ce qui rend la déclaration
 * inévitable plutôt que recommandée.
 */
export function repondre<A extends Audience, T extends object>(
  valeur: Admissible<A, T>,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(valeur), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}
