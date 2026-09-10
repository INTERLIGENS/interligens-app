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
declare const GARANTIE: unique symbol;

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

// ─── LA CHARGE — ce que la frontière sait émettre, et elle le DÉCLARE ────
//
// Mesuré sur les 19 routes du dépôt qui construisent une réponse : SEPT
// rendent un corps que `JSON.stringify` ne sait pas produire — un PDF, des
// octets, un CSV. Une frontière incapable d'exprimer ce que la route doit
// émettre est contournée, et ici le contournement serait le cas MAJORITAIRE
// des artefacts portables — c'est-à-dire précisément ceux dont la gouvernance
// compte le plus.
//
// La forme est DÉCLARÉE dans la charge, jamais devinée d'un `typeof`. Deviner
// la forme d'un corps est la même faute que deviner l'intention d'une clause :
// ça marche jusqu'au jour où deux formes se ressemblent.
//
// ⚠ AUCUN MEMBRE `Response` ICI, ET C'EST DÉLIBÉRÉ. Une charge qui pourrait
// transporter une réponse déjà construite rouvrirait exactement le trou mesuré
// sur l'enveloppement lâche : la projection ne peut ni lire ni restreindre un
// objet `Response`, donc elle compilerait sans rien projeter.
export type Charge =
  | { readonly forme: "json"; readonly valeur: object }
  | { readonly forme: "texte"; readonly texte: string; readonly typeMime: string }
  | { readonly forme: "octets"; readonly octets: Uint8Array; readonly typeMime: string }
  | { readonly forme: "flux"; readonly flux: ReadableStream<Uint8Array>; readonly typeMime: string };

/**
 * LE NIVEAU DE GARANTIE — et il n'est PAS uniforme selon la forme.
 *
 *   RESTREINTE  sur du JSON, la projection LIT la donnée et en retire. Ce qui
 *               sort est ce qui a été retenu, et l'écart est démontrable.
 *   ATTESTEE    sur un flux d'octets, elle ne peut RIEN retirer. Elle ne peut
 *               qu'attester que le document a été PRODUIT sous une décision
 *               d'audience.
 *
 * Ce sont DEUX PROPRIÉTÉS, et la seconde est plus faible. La question de
 * savoir si elles doivent porter le même nom n'est pas tranchée ici — elle est
 * NOMMÉE, et la frontière la rend visible plutôt que de laisser croire à une
 * garantie uniforme. Un invariant qui laisserait croire qu'il couvre tout
 * serait pire que son absence.
 */
export type Garantie = "RESTREINTE" | "ATTESTEE";

/**
 * REFUSE QU'UNE `Response` ENTRE PAR LE CHEMIN JSON.
 *
 * Trouvé en cherchant si l'élargissement avait rouvert le trou de
 * l'enveloppement lâche. Il ne l'avait pas rouvert — il était DÉJÀ LÀ, sur le
 * chemin JSON, depuis la première écriture : `Out extends object` accepte une
 * `Response`, qui se faisait alors sérialiser en `{}`.
 *
 * Ce n'était pas une fuite — rien de non projeté ne sortait — mais c'est la
 * même FORME : un objet opaque entre dans le pipeline et la projection ne peut
 * rien en dire. Une signature plus riche est une signature plus facile à
 * satisfaire par accident ; celle-ci l'était déjà, et l'élargissement aurait
 * rendu la faute plus tentante puisque le binaire devient légitime à côté.
 */
export type PasUneReponse<T> = T extends Response ? never : T;

export type GarantieDe<C extends Charge> = C extends { forme: "json" } ? "RESTREINTE" : "ATTESTEE";

/**
 * L'AXE 2 — ce que cette audience peut recevoir.
 *
 * La marque porte l'audience ET le niveau de garantie. Une valeur projetée
 * pour `PARTNER` n'est pas assignable là où une valeur `ANONYMOUS` est
 * attendue ; une charge ATTESTEE n'est pas assignable là où une charge
 * RESTREINTE est exigée. Les deux distinctions voyagent dans la valeur émise.
 */
export type Admissible<A extends Audience, C extends Charge = Charge> = C & {
  readonly [PROJETE]: A;
  readonly [GARANTIE]: GarantieDe<C>;
};

const marquer = <A extends Audience>(audience: A, etabliePar: string): Admission<A> =>
  ({ audience, etabliePar } as unknown as Admission<A>);

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
 * LA PROJECTION JSON — garantie RESTREINTE.
 *
 * Elle prend l'admission, l'entrée, et la fonction qui restreint. La valeur
 * rendue n'existe que parce que la projection a tourné : c'est en cela que la
 * déclaration est PORTANTE et non décorative.
 */
export function projeter<A extends Audience, In, Out extends object>(
  admission: Admission<A>,
  entree: In,
  projection: (entree: In) => PasUneReponse<Out>,
): Admissible<A, { forme: "json"; valeur: Out }> {
  void admission;
  return { forme: "json", valeur: projection(entree) } as unknown as Admissible<
    A, { forme: "json"; valeur: Out }
  >;
}

/**
 * LA PRODUCTION DE DOCUMENT — garantie ATTESTEE, et la frontière le DIT.
 *
 * `produire` reçoit l'entrée et rend les octets. Elle est exigée pour la même
 * raison que la projection JSON : sans elle, la valeur émise n'aurait rien
 * traversé. Ce qui change n'est pas le caractère portant de la marque — c'est
 * ce que la marque peut établir.
 */
export function projeterDocument<A extends Audience, In>(
  admission: Admission<A>,
  entree: In,
  produire: (entree: In) => Uint8Array,
  typeMime: string,
): Admissible<A, { forme: "octets"; typeMime: string; octets: Uint8Array }> {
  void admission;
  return { forme: "octets", typeMime, octets: produire(entree) } as Admissible<
    A, { forme: "octets"; typeMime: string; octets: Uint8Array }
  >;
}

/** Production d'un corps textuel non-JSON — CSV, HTML. Garantie ATTESTEE. */
export function projeterTexte<A extends Audience, In>(
  admission: Admission<A>,
  entree: In,
  produire: (entree: In) => string,
  typeMime: string,
): Admissible<A, { forme: "texte"; typeMime: string; texte: string }> {
  void admission;
  return { forme: "texte", typeMime, texte: produire(entree) } as Admissible<
    A, { forme: "texte"; typeMime: string; texte: string }
  >;
}

/** Production d'un flux. Garantie ATTESTEE, et par construction non relisible. */
export function projeterFlux<A extends Audience, In>(
  admission: Admission<A>,
  entree: In,
  produire: (entree: In) => ReadableStream<Uint8Array>,
  typeMime: string,
): Admissible<A, { forme: "flux"; typeMime: string; flux: ReadableStream<Uint8Array> }> {
  void admission;
  return { forme: "flux", typeMime, flux: produire(entree) } as Admissible<
    A, { forme: "flux"; typeMime: string; flux: ReadableStream<Uint8Array> }
  >;
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
  entree: PasUneReponse<T>,
): Admissible<"OPERATOR", { forme: "json"; valeur: T }> {
  void admission;
  return { forme: "json", valeur: entree } as unknown as Admissible<
    "OPERATOR", { forme: "json"; valeur: T }
  >;
}

/**
 * EXIGER LA GARANTIE FORTE.
 *
 * Un consommateur qui a besoin d'une restriction DÉMONTRÉE, et pas seulement
 * attestée, l'exige par le type. C'est ce qui rend la différence des deux
 * propriétés mécanique plutôt que documentaire : une charge attestée n'est
 * pas assignable ici, et le compilateur le dit.
 */
export function exigerRestreinte<A extends Audience, T extends object>(
  valeur: Admissible<A, { forme: "json"; valeur: T }>,
): Admissible<A, { forme: "json"; valeur: T }> {
  return valeur;
}

/**
 * LA FRONTIÈRE DE RÉPONSE GOUVERNÉE.
 *
 * Elle n'accepte que ce qui a traversé une projection. Un objet nu n'a aucun
 * chemin de type vers ce paramètre : c'est ce qui rend la déclaration
 * inévitable plutôt que recommandée.
 *
 * Statut et en-têtes arbitraires sont portés ici — ils étaient déjà couverts,
 * et la mesure l'a confirmé : le trou n'était jamais le statut ni le CORS,
 * c'était le CORPS.
 */
export function repondre<A extends Audience, C extends Charge>(
  valeur: Admissible<A, C>,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  const charge = valeur as unknown as Charge;
  const enTetes: Record<string, string> = { ...(init?.headers ?? {}) };
  const statut = init?.status ?? 200;

  switch (charge.forme) {
    case "json":
      return new Response(JSON.stringify(charge.valeur), {
        status: statut,
        headers: { "content-type": "application/json", ...enTetes },
      });
    case "texte":
      return new Response(charge.texte, {
        status: statut,
        headers: { "content-type": charge.typeMime, ...enTetes },
      });
    case "octets":
      return new Response(charge.octets as unknown as BodyInit, {
        status: statut,
        headers: { "content-type": charge.typeMime, ...enTetes },
      });
    case "flux":
      return new Response(charge.flux, {
        status: statut,
        headers: { "content-type": charge.typeMime, ...enTetes },
      });
  }
}
