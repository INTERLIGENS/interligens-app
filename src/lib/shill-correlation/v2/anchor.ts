// --- L'ANCRE ON-CHAIN — marquage, plus aucune compensation ---------------
//
// ██ T3 — `onChainAnchorFromCorpus` A ÉTÉ RETIRÉE. ██
//
// Elle ajoutait l'offset Europe/Paris à tout timestamp du corpus, sur la foi
// d'une mesure : « on-chain − firstSeenAt = 7 200 s, 896 signatures, variance
// nulle ». La constance était réelle ; la conclusion était fausse.
//
// L'écart ne venait pas des données mais du LECTEUR. Les sondes lisaient avec
// le driver `pg`, qui interprète une colonne `timestamp without time zone`
// dans le fuseau LOCAL du process. Prisma l'interprète en UTC. Mesuré le
// 2026-09-04, même ligne, même instant :
//
//   en base     2026-09-02 21:26:00
//   snowflake   2026-09-02T21:26:00.192Z   ← la vérité, sans fuseau
//   via pg      2026-09-02T19:26:00.000Z   ← écart 2 h
//   via Prisma  2026-09-02T21:26:00.000Z   ← écart 0
//
// Relu via Prisma, le corpus de juin est à ZÉRO d'écart sur 148 des 169 lignes
// à tweetId exploitable. Il n'y avait rien à compenser — et la compensation
// décalait de 2 h des instants justes.
//
// Ce qui reste : le TYPE MARQUÉ. Il gardait déjà l'essentiel — un `Date`
// quelconque ne peut pas être passé là où une ancre on-chain est attendue.
// L'ancre elle-même vient de `timeAnchor.ts`, dérivée du snowflake du post,
// que ni fuseau ni driver ne peuvent décaler.
//
// AUCUNE constante de correction ne subsiste ici. Un décalage qu'on compense
// est un décalage qu'on cesse de voir.

declare const ON_CHAIN_BRAND: unique symbol;

/**
 * Un instant VRAI, comparable à un `timestamp` on-chain (unix secondes UTC).
 * Ne peut être obtenu que par `onChainAnchorFromUtc` — jamais par un cast.
 */
export type OnChainInstant = Date & { readonly [ON_CHAIN_BRAND]: true };

/**
 * Marque un instant DÉJÀ en UTC vrai — un timestamp on-chain, une ancre
 * dérivée d'un snowflake, une API qui rend de l'ISO-8601 zoné.
 *
 * Aucune conversion : la marque atteste que l'appelant a vérifié la
 * provenance, elle ne la fabrique pas. C'est le seul constructeur d'ancre qui
 * subsiste, et c'est voulu — il n'y a plus rien à convertir.
 */
export function onChainAnchorFromUtc(utc: Date): OnChainInstant {
  return new Date(utc.getTime()) as OnChainInstant;
}

/** Secondes unix de l'ancre — l'unité des `timestamp` Helius. */
export function anchorSeconds(a: OnChainInstant): number {
  return Math.floor(a.getTime() / 1000);
}
