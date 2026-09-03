// --- L'ANCRE ON-CHAIN — sémantique, pas compensation ----------------------
//
// ██ LE BUG MESURÉ, 2026-09-03 ██
//
// `ShillEvent.tweetTimestamp` et `ShillBuyerObservation.firstSeenAt` sont EN
// RETARD sur l'instant on-chain réel, de l'offset Europe/Paris applicable à
// leur date. Signature d'un instant UTC traité comme heure locale puis
// re-sérialisé en UTC. Mesuré par sonde réelle, sans marge d'interprétation :
//
//   timestamp on-chain − firstSeenAt = 7 200 s
//   896 signatures · 4 tokens · 3 KOL · 4 dates
//   UNE SEULE valeur distincte. Variance NULLE.
//
// Un comportement ne produit pas une constante à la seconde près sur quatre
// tokens et trois KOL. C'est une horloge.
//
// ─── POURQUOI PAS UN `- 7200` ───────────────────────────────────────────────
//
// 7 200 s, c'est Europe/Paris EN ÉTÉ (CEST, UTC+2). Le corpus s'étend du
// 2025-01 au 2026-06 : il contient des événements d'HIVER, où Paris est à
// UTC+1. Une constante de 7 200 les décalerait d'une heure — elle
// remplacerait un bug uniforme par un bug saisonnier, c'est-à-dire par un bug
// qu'on ne verrait plus.
//
// La correction porte donc sur la SÉMANTIQUE : on déclare le fuseau du corpus,
// et `Intl` calcule l'offset applicable À CETTE DATE, transition d'heure d'été
// comprise.
//
// ─── CE QUE LE TYPE REND IMPOSSIBLE ────────────────────────────────────────
//
// `OnChainInstant` est une marque (`branded type`). Un `Date` brut issu du
// corpus ne la satisfait PAS : le compilateur refuse de le passer là où une
// ancre on-chain est attendue. C'est le cœur du correctif — le bug n'était pas
// une soustraction manquante, c'était deux grandeurs incomparables que rien
// n'empêchait de comparer.
//
// Compenser aurait laissé le prochain appelant refaire la même erreur.

/** Fuseau dans lequel le corpus a été écrit. Déclaré, jamais deviné. */
export const CORPUS_WALL_CLOCK_ZONE = "Europe/Paris";

declare const ON_CHAIN_BRAND: unique symbol;

/**
 * Un instant VRAI, comparable à un `timestamp` on-chain (unix secondes UTC).
 *
 * Ne peut être obtenu que par `onChainAnchorFromCorpus` ou
 * `onChainAnchorFromUtc` — jamais par un cast depuis un `Date` du corpus.
 */
export type OnChainInstant = Date & { readonly [ON_CHAIN_BRAND]: true };

/**
 * Offset du fuseau, EN SECONDES, à un instant UTC donné.
 * Passe par `Intl` : la table des transitions d'heure d'été est celle du
 * système, pas une constante que ce fichier aurait recopiée.
 */
function zoneOffsetSecondsAt(utc: Date, zone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(utc)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  // `Intl` rend 24 pour minuit dans certaines implémentations.
  const hour = p.hour === 24 ? 0 : p.hour;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second);
  return Math.round((asUtc - utc.getTime()) / 1000);
}

/**
 * Convertit une valeur du corpus — heure murale parisienne stockée dans une
 * colonne UTC — en instant on-chain réel.
 *
 * DEUX PASSES, et elles sont nécessaires : l'offset dépend de l'instant, et
 * l'instant dépend de l'offset. Une seule passe se trompe d'une heure sur les
 * dates proches d'un changement d'heure — exactement les cas qu'un test ne
 * couvre jamais par hasard.
 */
export function onChainAnchorFromCorpus(
  corpusTimestamp: Date,
  zone: string = CORPUS_WALL_CLOCK_ZONE,
): OnChainInstant {
  // SENS DE LA CORRECTION, fixé par la MESURE et non par un raisonnement :
  //   timestamp on-chain − valeur stockée = +7 200 s (été)
  // L'instant vrai est donc POSTÉRIEUR à la valeur stockée. On AJOUTE l'offset.
  //
  // Le sens inverse est l'erreur naturelle ici — « heure murale lue comme UTC »
  // suggère de soustraire — et il donne un résultat faux de 4 h, pas de 0.
  // C'est pourquoi le test d'été rejoue la mesure réelle plutôt qu'un exemple.
  const storedMs = corpusTimestamp.getTime();
  const off1 = zoneOffsetSecondsAt(new Date(storedMs), zone);
  const pass1 = storedMs + off1 * 1000;
  const off2 = zoneOffsetSecondsAt(new Date(pass1), zone);
  return new Date(storedMs + off2 * 1000) as OnChainInstant;
}

/**
 * Pour une source DÉJÀ en UTC vrai (un timestamp on-chain, une API qui rend de
 * l'ISO-8601 zoné). Aucune conversion — seulement la marque, qui atteste que
 * l'appelant a vérifié la provenance.
 */
export function onChainAnchorFromUtc(utc: Date): OnChainInstant {
  return new Date(utc.getTime()) as OnChainInstant;
}

/** Secondes unix de l'ancre — l'unité des `timestamp` Helius. */
export function anchorSeconds(a: OnChainInstant): number {
  return Math.floor(a.getTime() / 1000);
}

/**
 * L'écart mesuré, exposé pour les tests d'anti-régression et l'observabilité.
 * N'est utilisé par AUCUN chemin de calcul : le corriger passe par le fuseau,
 * jamais par cette constante.
 */
export const MEASURED_CORPUS_DRIFT_SUMMER_SECONDS = 7200;

/**
 * ⚠ CE QUI EST MESURÉ, ET CE QUI NE L'EST PAS.
 *
 * MESURÉ : l'écart d'ÉTÉ, 7 200 s, sur 896 signatures de juin 2026. Variance
 * nulle.
 *
 * NON MESURÉ : le comportement en HIVER. Aucun événement d'hiver du corpus ne
 * porte d'observation, donc aucune vérité terrain. Que l'écart y vaille 3 600 s
 * est une CONSÉQUENCE de l'hypothèse « l'écart est l'offset du fuseau » — la
 * seule qui explique 7 200 s exactement — mais elle n'a pas été vérifiée.
 *
 * Si un jour un événement d'hiver reçoit des observations, c'est la mesure à
 * refaire EN PREMIER : elle départage l'hypothèse du fuseau d'une constante de
 * 7 200 s qui aurait une autre cause.
 */
export const WINTER_DRIFT_IS_INFERRED_NOT_MEASURED = true;
