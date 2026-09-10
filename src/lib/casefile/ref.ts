/**
 * src/lib/casefile/ref.ts
 *
 * LA RÉFÉRENCE DE DOSSIER — UNE PRIMITIVE, ET UNE SEULE.
 *
 * ██  Un identifiant OPAQUE et IMMUABLE. Il ne veut rien dire.  ██
 *
 * La référence persistée (`token_casefiles.ref`) est l'autorité. Elle est
 * assignée UNE fois à la création du dossier, et elle n'est jamais dérivée de
 * l'année courante, de la famille, de la route, du moteur de rendu, de la
 * langue, du score, ni d'une couche de présentation.
 *
 * ─── CE QUE LES SEGMENTS NE SIGNIFIENT PAS ────────────────────────────────
 *
 * `IL-SHILL-…`, `IL-PND-…`, `IL-PON-…`, `IL-CONC-…` sont des MNÉMONIQUES
 * HISTORIQUES restées dans la valeur opaque. Aucun consommateur ne doit en
 * déduire une méthodologie, une famille, une année, un statut ou un routage.
 * Le dépôt porte d'ailleurs trois conventions incompatibles sur ces segments :
 * elles cessent d'être un défaut à l'instant où elles cessent de signifier.
 *
 * Le type `CaseFileRef` est MARQUÉ pour que cette règle ait un COÛT plutôt
 * qu'un commentaire : un consommateur qui veut découper la chaîne doit écrire
 * un cast délibéré, visible en revue.
 *
 * ⚠️ LE TYPE NE SUFFIT PAS, ET IL N'EST PAS LA GARDE. Mesuré : la forme
 * `(readRef(x) as string).split("-")` fait disparaître le porteur derrière la
 * parenthèse du cast — le type n'y voit rien. La garde COMPORTEMENTALE qui
 * attrape cette échappée vit ailleurs et lui est ANTÉRIEURE en autorité : ce
 * fichier est protégé par elle, il ne la remplace pas.
 *
 * ─── ENCODER EST PERMIS. INTERPRÉTER EST INTERDIT. ────────────────────────
 *
 * Assainir la valeur pour en faire une clef de chemin ou d'archive transforme
 * des CARACTÈRES et ne dérive aucune sémantique : c'est permis, et c'est ce
 * que fait `encodeRefForPath`. Lire un segment pour en tirer une famille, une
 * année ou une route ne l'est pas — quelle que soit la façon dont c'est écrit.
 *
 * ─── TROIS VERBES, ET RIEN D'AUTRE ────────────────────────────────────────
 *
 *   readRef     la seule LECTURE — elle ne découpe jamais
 *   assignRef   le siège de l'assignation UNIQUE à la création (RC-3)
 *   withoutRef  le siège de l'immuabilité en mise à jour (RC-2)
 *
 * Plus une capacité distincte, qui n'est pas un quatrième verbe mais une
 * autorité séparée : `resolveCaseFileRef`, la résolution EXACTE de citation.
 *
 * Critères : __tests__/casefile/rc2-ref-immuable.test.ts,
 *            __tests__/casefile/rc3-capacite-creation.test.ts,
 *            __tests__/casefile/rc-resolveur-citation.test.ts
 */

// ── Le type marqué ──────────────────────────────────────────────────────────

declare const MARQUE_CASEFILE_REF: unique symbol;

/**
 * Une référence de dossier. C'est une chaîne, et c'est TOUT ce qu'on peut en
 * dire : aucune structure, aucun segment lisible, aucun ordre, aucune forme
 * garantie. Un cast pour en sortir est une échappée visible, pas une autorité.
 */
export type CaseFileRef = string & { readonly [MARQUE_CASEFILE_REF]: true };

/** Ce que la primitive exige d'un enregistrement pour en lire la référence. */
export interface PorteurDeRef {
  readonly ref?: unknown;
}

export class RefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefError";
  }
}

/**
 * La seule vérification consentie sur la VALEUR : elle est une chaîne non vide
 * et ne porte pas d'espace en bord.
 *
 * Volontairement, il n'y a AUCUN test de préfixe, de forme `IL-*`, de nombre
 * de segments ni de casse : valider la forme reviendrait à décider que la
 * forme signifie quelque chose, et c'est exactement l'interdit. Ceci est de
 * l'hygiène de chaîne, pas de la sémantique.
 */
function estValeurAcceptable(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.trim() === v;
}

// ── readRef — la seule lecture ──────────────────────────────────────────────

/**
 * Rend la référence d'un enregistrement persisté.
 *
 * Elle ne la découpe pas, ne la normalise pas, ne la complète pas et ne lui
 * substitue aucun repli : un enregistrement sans référence utilisable est une
 * erreur, pas une occasion d'en fabriquer une.
 */
export function readRef(record: PorteurDeRef): CaseFileRef {
  const brut = record?.ref;
  if (!estValeurAcceptable(brut)) {
    throw new RefError(
      "readRef : l'enregistrement ne porte pas de référence utilisable. " +
        "Aucune valeur de repli n'est fabriquée ici.",
    );
  }
  return brut as CaseFileRef;
}

// ── assignRef — le siège de l'assignation UNIQUE (RC-3) ─────────────────────

/**
 * Charges déjà passées par l'assignation. Un `WeakSet` plutôt qu'une marque
 * posée sur l'objet : la charge reste comparable champ pour champ par les
 * tests et par Prisma, et rien de la frontière ne fuit dans la base.
 */
const DEJA_ASSIGNEES = new WeakSet<object>();

/**
 * Le SIÈGE de la création. Ce n'est PAS un allocateur.
 *
 * Il n'invente aucune référence, ne dérive aucune forme `IL-${famille}`, ne
 * lit ni l'horloge ni la famille ni la route. Il exige que l'appelant
 * FOURNISSE la valeur, et il refuse une seconde assignation sur une charge
 * qui est déjà passée par lui — « exactly once » au sens littéral.
 *
 * Sa raison d'être n'est pas ce qu'il fait, c'est ce qu'il rend MESURABLE :
 * toute capacité de création qui ne passe pas par ici est visible depuis
 * l'extérieur du fichier, et le critère RC-3 la voit.
 */
export function assignRef<T extends PorteurDeRef & object>(
  payload: T,
): T & { ref: CaseFileRef } {
  if (payload === null || typeof payload !== "object") {
    throw new RefError("assignRef : une charge d'objet est requise.");
  }
  if (DEJA_ASSIGNEES.has(payload)) {
    throw new RefError(
      "assignRef : cette charge porte déjà une assignation. " +
        "Une référence est assignée UNE fois, à la création du dossier.",
    );
  }
  if (!estValeurAcceptable(payload.ref)) {
    throw new RefError(
      "assignRef : aucune référence fournie. La primitive n'en alloue pas — " +
        "la valeur est fournie par le chemin de création, jamais inventée ici.",
    );
  }
  const assignee = { ...payload, ref: payload.ref as CaseFileRef };
  DEJA_ASSIGNEES.add(assignee);
  return assignee;
}

// ── withoutRef — le siège de l'immuabilité (RC-2) ───────────────────────────

/**
 * Rend la charge PRIVÉE de sa référence.
 *
 * Elle ne compare aucune valeur, et c'est délibéré : la propriété gouvernée
 * est « le `ref` n'est PAS dans la charge de mise à jour », jamais « le `ref`
 * ne change pas ». La seconde est satisfaite par coïncidence de littéral —
 * c'est l'état d'aujourd'hui, et c'est ce que RC-2 remplace.
 */
export function withoutRef<T extends object>(payload: T): Omit<T, "ref"> {
  if (payload === null || typeof payload !== "object") {
    throw new RefError("withoutRef : une charge d'objet est requise.");
  }
  const { ref: _ignore, ...reste } = payload as T & { ref?: unknown };
  return reste as Omit<T, "ref">;
}

// ── Encodage : permis, parce qu'il ne dérive rien ───────────────────────────

/**
 * Assainit la référence pour en faire un segment de chemin ou de clef
 * d'archive. TRANSFORME des caractères — ne LIT aucun segment, ne réordonne
 * rien, ne tire ni famille, ni année, ni routage.
 *
 * Rendue en `string` et non en `CaseFileRef` : le produit d'un encodage n'est
 * plus une référence, c'est un nom de fichier. Le lui laisser porter le type
 * marqué autoriserait le chemin du retour, qui serait une interprétation.
 */
export function encodeRefForPath(ref: CaseFileRef): string {
  return String(ref).replace(/[^A-Za-z0-9._-]/g, "_");
}

// ── La résolution de citation — une AUTORITÉ distincte ──────────────────────

/**
 * Le port de lecture. La primitive ne connaît ni Prisma, ni requête, ni
 * audience : elle reçoit une recherche EXACTE et une décision d'habilitation
 * déjà prise.
 *
 * `visible` porte l'habilitation RELATIVE À UNE AUDIENCE — la confirmation
 * d'existence n'est due qu'à une audience habilitée à savoir que ce dossier
 * existe. Cette décision appartient à l'appelant ; la primitive se contente de
 * ne jamais la laisser transparaître.
 */
export interface PortDeResolution {
  trouverParRefExact(
    ref: string,
  ): Promise<{ readonly ref: string; readonly visible: boolean } | null>;
}

export type ResolutionOutcome = "EXACT_MATCH" | "NOT_FOUND";

/** L'issue, et rien d'autre. Aucun champ ne s'y ajoute — voir le critère. */
export interface Resolution {
  readonly outcome: ResolutionOutcome;
}

const NOT_FOUND: Resolution = Object.freeze({ outcome: "NOT_FOUND" });
const EXACT_MATCH: Resolution = Object.freeze({ outcome: "EXACT_MATCH" });

/**
 * Résout une référence de citation. EXACTEMENT, ou pas du tout.
 *
 * INTERDITS, et absents par construction : approximation, préfixe,
 * sous-chaîne, nom de code, handle d'acteur, similarité de mint, lecture d'une
 * forme `CASE-*`, repli implicite sur un alias historique. Il n'y a aucune
 * normalisation à l'entrée : ne rien transformer est ce qui rend l'exactitude
 * démontrable plutôt que promise.
 *
 * DEUX RÈGLES DE SORTIE, et la seconde est celle qu'on viole par accident :
 *
 *   · `EXACT_MATCH` n'établit qu'une IDENTITÉ. Il ne rend publiable aucune
 *     autre propriété du dossier — pas de titre, pas de claim, pas de statut.
 *     Un résolveur qui rend le dossier est une surface de PUBLICATION, et l'on
 *     aurait réinventé l'explorer par la porte de service.
 *
 *   · « existe mais tu n'es pas habilité à le savoir » est INDISCERNABLE de
 *     « n'existe pas ». Pas équivalent — identique, champ pour champ. Sans
 *     quoi le résolveur devient un test d'appartenance ÉNUMÉRABLE, et la
 *     doctrine tient : on peut TESTER l'appartenance, on ne peut pas
 *     l'ÉNUMÉRER.
 *
 * Cette primitive n'est exposée par aucune route. Une surface d'exposition est
 * une PROJECTION, elle se décide séparément, et elle vient après.
 */
export async function resolveCaseFileRef(
  ref: string,
  port: PortDeResolution,
): Promise<Resolution> {
  if (!estValeurAcceptable(ref)) return NOT_FOUND;

  const enregistrement = await port.trouverParRefExact(ref);
  if (enregistrement === null) return NOT_FOUND;

  // Une ligne trouvée mais non habilitée rend la MÊME valeur qu'une absence.
  // Le `return` est volontairement identique — pas un objet équivalent, la
  // constante elle-même.
  if (enregistrement.visible !== true) return NOT_FOUND;

  return EXACT_MATCH;
}
