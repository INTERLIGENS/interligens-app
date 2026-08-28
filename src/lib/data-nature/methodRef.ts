// ─── S6-0 — la grammaire canonique d'une référence de méthode ──────────────
//
// UNE SEULE SOURCE. Avant S6, deux modules portaient deux grammaires
// incompatibles et personne ne l'a vu, parce que le validateur n'était appelé
// nulle part :
//
//   data-nature/nature.ts      /^[a-z][a-z0-9-]{2,63}@(?:\d+|\d+\.\d+\.\d+)$/
//   methodology/registry.ts    /^([a-z0-9-]+)\/([a-z0-9-]+)@(v\d+)$/
//
// Le premier REJETAIT `financial-estimates/est-proceeds@v1` — la référence
// écrite sur les 7 KolCase par S5-B, et ratifiée. Un CHECK calqué sur le code
// aurait rejeté les données ; un CHECK calqué sur les données aurait contredit
// le code.
//
// Ce module est désormais l'unique définition. La base la REPRODUIT (via
// METHOD_REF_SQL_PATTERN, dérivé du même corps), elle ne la redérive pas.

/**
 * Corps de la grammaire, sans ancres — source unique dont sont dérivés le
 * RegExp JavaScript ET le motif POSIX du CHECK SQL.
 *
 *     <slug>/<component>@v<N>
 *
 * Chaque segment : minuscule initiale, puis lettres/chiffres/tirets, 2 à 64
 * caractères. Version : `v` suivi d'un entier. Rien d'autre.
 *
 * Volontairement STRICT — la correction de S6-0 élargit à la forme
 * hiérarchique ratifiée, elle ne rend pas la grammaire permissive :
 *   · un segment unique sans `/` est refusé (il ne nomme pas de composant)
 *   · un chemin de route (`/en/methodology`) est refusé (initiale `/`)
 *   · un semver (`@1.0.0`) est refusé — la convention arbitrée est `v<N>`
 */
export const METHOD_REF_PATTERN_BODY =
  "[a-z][a-z0-9-]{1,63}/[a-z][a-z0-9-]{1,63}@v[0-9]+";

/** Le RegExp applicatif, ancré, avec captures pour la résolution. */
export const METHOD_REF_RE = new RegExp(
  `^([a-z][a-z0-9-]{1,63})/([a-z][a-z0-9-]{1,63})@(v[0-9]+)$`,
);

/**
 * Le motif POSIX que la base utilise, dérivé du MÊME corps.
 * Un test vérifie que les deux restent la même chaîne — ils ne peuvent pas
 * diverger en silence.
 */
export const METHOD_REF_SQL_PATTERN = `^${METHOD_REF_PATTERN_BODY}$`;

/**
 * Formules d'évitement refusées même si la forme était correcte. Une méthode
 * qu'on ne peut pas retrouver n'est pas une méthode.
 *
 * `/en/methodology` n'a pas besoin d'y figurer : la grammaire le rejette déjà
 * (il commence par `/`). Il est nommé dans le CHECK DB par prudence explicite,
 * parce que la colonne l'a longtemps porté comme DEFAULT.
 */
export const METHOD_REF_BLOCKLIST: ReadonlySet<string> = new Set([
  "internal", "n/a", "na", "none", "manual", "tbd", "todo", "unknown", "legacy",
  "/en/methodology",
]);

/** L'unique validateur. Tout le reste — app et base — en découle. */
export function isValidMethodRef(ref: unknown): ref is string {
  if (typeof ref !== "string") return false;
  if (METHOD_REF_BLOCKLIST.has(ref.toLowerCase())) return false;
  const slug = ref.split("@")[0]?.toLowerCase() ?? "";
  if (METHOD_REF_BLOCKLIST.has(slug)) return false;
  return METHOD_REF_RE.test(ref);
}

export interface ParsedMethodRef {
  readonly methodologyId: string;
  readonly componentId: string;
  readonly version: string;
}

/** Décompose une référence valide. Rend null sinon — jamais de devinette. */
export function parseMethodRef(ref: unknown): ParsedMethodRef | null {
  if (!isValidMethodRef(ref)) return null;
  const m = METHOD_REF_RE.exec(ref);
  if (!m) return null;
  return { methodologyId: m[1], componentId: m[2], version: m[3] };
}
