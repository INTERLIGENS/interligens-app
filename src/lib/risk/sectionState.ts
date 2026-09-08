// ─── BUILD 10 · P2 — TROIS ÉTATS, PAS DEUX ─────────────────────────────────
//
// ██  Une surface qui NOMME une personne ne doit jamais transformer un       ██
// ██  échec de collecte en absence de signal.                               ██
//
// ─── Le défaut mesuré en S0 ───────────────────────────────────────────────
//
// Sur la fiche KOL, cinq appels sur six s'écrivaient :
//
//     fetch(url).then(r => r.json())
//               .then(d => { if (d?.wallets?.length > 0) setX(d.wallets) })
//               .catch(() => {})
//
// Trois situations produisaient exactement le même écran — la section
// n'apparaît pas :
//
//     1. la collecte a réussi, il n'y a rien              absence RÉELLE
//     2. l'API a échoué                                    panne
//     3. l'accès nominatif a été refusé (401)              retenu DÉLIBÉRÉMENT
//
// Sur une fiche qui nomme quelqu'un, un écran vide se lit « rien à signaler
// sur cette personne ». Le produit ne pouvait pas tenir cette lecture : il ne
// savait pas la distinguer d'une panne.
//
// ─── La règle d'instrumentation, appliquée ────────────────────────────────
//
// « Une mesure n'est valide que si le champ mesuré représente réellement le
//   phénomène annoncé. » — ne jamais inférer `empty result → no risk`.
//
// Ici : une charge vide n'est une information SUR LA PERSONNE que si la
// réponse est `ok`. Sinon, elle est une information sur le TRANSPORT, et le
// dire autrement serait une affirmation métier fabriquée.
//
// ─── Ce que ce module ne fait pas ─────────────────────────────────────────
//
// Il n'invente aucune valeur, n'ajoute aucun risque, ne touche à aucun score.
// Il classe une réponse HTTP. Le reste — quoi afficher — appartient à la
// surface, qui est la seule à savoir ce qu'elle promet à son lecteur.

import { degraded, type DegradedInput } from "./degradation";

export const SECTION_STATES = [
  /** L'appel n'a pas encore répondu. */
  "LOADING",
  /** Réponse `ok`, charge non vide. */
  "MEASURED",
  /** Réponse `ok`, charge vide. Une absence RÉELLE, et une information. */
  "MEASURED_EMPTY",
  /** L'appel a échoué : réseau, 5xx, timeout, JSON illisible. */
  "PROVIDER_FAILURE",
  /** 401 nominatif : l'accès est refusé PAR CONCEPTION, pas par panne. */
  "INTENTIONALLY_UNAVAILABLE",
] as const;
export type SectionState = (typeof SECTION_STATES)[number];

/** Le code que le gate nominatif renvoie. Voir src/lib/security/nominativeApiGate.ts. */
export const NOMINATIVE_DENIED_CODE = "NOMINATIVE_ACCESS_REQUIRED";

/**
 * Classe une réponse en un état de section.
 *
 * `isEmpty` est fourni par l'appelant : lui seul sait ce que « vide » veut
 * dire pour SA charge — un tableau à zéro élément, un drapeau `detected`
 * faux, un objet nul. Le module ne le devine pas.
 *
 * L'ordre des tests compte : le refus d'accès est examiné AVANT l'échec, sinon
 * un 401 serait rangé en panne — et une rétention délibérée serait signalée
 * comme un incident.
 */
export function classifyResponse(
  ok: boolean,
  status: number,
  body: unknown,
  isEmpty: boolean,
): SectionState {
  const code =
    body && typeof body === "object" && "code" in body
      ? String((body as { code?: unknown }).code ?? "")
      : "";

  if (status === 401 || code === NOMINATIVE_DENIED_CODE) {
    return "INTENTIONALLY_UNAVAILABLE";
  }
  if (!ok) return "PROVIDER_FAILURE";
  return isEmpty ? "MEASURED_EMPTY" : "MEASURED";
}

/** L'état d'un appel qui a levé — réseau coupé, timeout, JSON illisible. */
export function thrownState(): SectionState {
  return "PROVIDER_FAILURE";
}

/**
 * `true` quand le vide affiché N'EST PAS une information sur la personne.
 *
 * C'est la question que la fiche doit se poser avant de laisser un blanc :
 * un `MEASURED_EMPTY` est un constat, les deux autres sont des non-constats.
 */
export function isNonConstat(s: SectionState): boolean {
  return s === "PROVIDER_FAILURE" || s === "INTENTIONALLY_UNAVAILABLE";
}

/**
 * La dégradation correspondante, pour le canal posé en P0 — un CHAMP, jamais
 * une valeur. `null` quand il n'y a rien à signaler.
 *
 * `MEASURED_EMPTY` ne rend PAS de dégradation : une absence mesurée n'est pas
 * une dégradation, c'est un résultat. Confondre les deux rendrait le signal
 * inutile — tout serait toujours dégradé.
 */
export function degradationFor(field: string, s: SectionState): DegradedInput | null {
  if (s === "PROVIDER_FAILURE") return degraded(field, "PROVIDER_UNAVAILABLE");
  if (s === "INTENTIONALLY_UNAVAILABLE") return degraded(field, "NOT_EVALUATED");
  return null;
}
