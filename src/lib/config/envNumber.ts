// src/lib/config/envNumber.ts
//
// NaN NE DOIT JAMAIS GOUVERNER UN PLAFOND.
//
// parseInt / parseFloat ne signalent pas l'échec : ils rendent NaN. Et NaN a
// une propriété qui en fait un désastre silencieux pour un garde-fou —
// TOUTE comparaison avec NaN est false :
//
//     NaN >= 24000   // false
//     NaN <= 24000   // false
//     usage + estimate >= NaN   // false, quoi qu'il arrive
//
// Un plafond dont la valeur est NaN ne se déclenche donc PLUS JAMAIS. Pas
// d'erreur, pas de log, pas de comportement bizarre : juste une protection
// qui a cessé d'exister. Et la faute d'entrée qui produit ça est banale —
// une chaîne vide au provisionnement, un "24 000" avec une espace, un
// "24000 " recopié depuis un tableur, un commentaire collé dans la valeur.
//
// La chaîne vide mérite une mention à part : `process.env.X ?? "24000"` ne
// retombe PAS sur "24000" quand X="" — la chaîne vide est une valeur, elle
// gagne sur le repli, et parseInt("") vaut NaN. C'est le même angle mort que
// la famille corrigée en 185a99c / cc41f04, avec un plafond au bout.
//
// Motif calqué sur src/lib/vault/scanRateLimit.ts, qui le faisait déjà bien.
//
// ── POURQUOI Number.isFinite NE SUFFIT PAS ────────────────────────────────
// parseInt s'arrête au premier caractère non numérique et rend ce qu'il a lu :
//
//     parseInt("24 000", 10)   // 24   — PAS NaN
//     parseInt("300 000", 10)  // 300  — PAS NaN
//     parseInt("15s", 10)      // 15   — PAS NaN
//
// Un garde sur Number.isFinite laisse donc passer le cas le plus probable en
// vrai : le séparateur de milliers recopié d'un tableur. X_API_HARD_CAP_POSTS
// = "24 000" ne donne pas NaN, il donne un plafond de VINGT-QUATRE posts. Et
// RATE_WINDOW_MS = "300 000" donne une fenêtre de 300 ms, ce qui revient à
// supprimer le rate-limit. Même famille, même silence, et cette fois le garde
// sur NaN ne voit rien passer.
//
// D'où la lecture STRICTE : la valeur entière, une fois les blancs de bord
// retirés, doit être un nombre complet. Une valeur à moitié lisible est un
// provisionnement raté, pas une valeur — elle retombe sur le défaut littéral.

/** Convertit en nombre STRICT (toute la chaîne, ou rien). */
function strictNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  // Number("") et Number("   ") valent 0 : à écarter AVANT la conversion,
  // sinon une variable vide donnerait un plafond de zéro.
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lit un entier dans l'environnement, ou retombe sur le défaut littéral.
 *
 * Retombe sur `fallback` si la valeur est absente, vide, partiellement
 * numérique ("24 000", "15s"), non finie (Infinity) ou non entière.
 *
 * Le zéro et les négatifs sont CONSERVÉS : sur un plafond, `0` est un kill
 * switch légitime (« ne rien laisser passer »), et le coercer vers le défaut
 * désarmerait un arrêt volontaire.
 */
export function envInt(varName: string, fallback: number): number {
  const n = strictNumber(process.env[varName]);
  return n !== null && Number.isInteger(n) ? n : fallback;
}

/**
 * Lit un flottant dans l'environnement, ou retombe sur le défaut littéral.
 * Mêmes règles que `envInt`, sans la contrainte d'entier.
 */
export function envFloat(varName: string, fallback: number): number {
  const n = strictNumber(process.env[varName]);
  return n !== null ? n : fallback;
}

// ── Variantes OPTIONNELLES ────────────────────────────────────────────────
// Pour les seuils dont l'absence signifie « seuil désactivé », écrits jusqu'ici
// `X ? parseInt(X) : undefined`. Le piège y est plus vicieux : une valeur
// illisible passe le test de présence, parseInt rend NaN, et le seuil devient
// NaN — donc actif en apparence, mais toujours false à la comparaison. On
// obtient un filtre qui se croit armé et ne filtre rien. `undefined` (seuil
// absent) et NaN (seuil cassé) doivent retomber sur le même comportement
// explicite : pas de seuil.

/** Entier optionnel : absent, vide, illisible ou non entier -> `undefined`. */
export function envIntOptional(varName: string): number | undefined {
  const n = strictNumber(process.env[varName]);
  return n !== null && Number.isInteger(n) ? n : undefined;
}

/** Flottant optionnel : absent, vide ou illisible -> `undefined`. */
export function envFloatOptional(varName: string): number | undefined {
  const n = strictNumber(process.env[varName]);
  return n !== null ? n : undefined;
}
