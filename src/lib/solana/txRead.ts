// ─── P0 AGAVE TX V1 — UN REFUS N'EST PAS UNE ABSENCE ──────────────────────
//
// ██  Signature connue + transaction illisible ≠ transaction absente.      ██
//
// ─── Ce qui a été mesuré ──────────────────────────────────────────────────
//
// Le RPC ne se tait pas. Il refuse, et il dit pourquoi :
//
//   getBlock(full) SANS maxSupportedTransactionVersion
//     -> error -32015 « Transaction version (0) is not supported by the
//        requesting client »
//   getBlock(full) AVEC maxSupportedTransactionVersion: 0
//     -> OK, 1 360 tx : 569 v0, 791 legacy
//
// Cinq helpers du produit faisaient `return j.result ?? null` sans jamais lire
// `j.error`. Le refus devenait `null`, puis un `if (!tx) continue` faisait
// disparaître la transaction du décompte. La perte n'était pas au RPC : elle
// était chez nous, au point de consommation.
//
// Et la signature vient de `getSignaturesForAddress`, qui est INSENSIBLE à la
// version : quand ce chemin échoue, on SAIT que la transaction existe. Il n'y
// a donc aucun état à inventer — seulement un état à cesser de détruire.
//
// ─── Les trois issues d'une lecture, et pourquoi elles sont trois ─────────
//
//   value    le nœud a répondu, la transaction est là
//   absent   le nœud a répondu `null` — il n'y a rien à cet identifiant.
//            C'est un CONSTAT, et il reste distinct d'un refus.
//   refused  le nœud a répondu `error`. Nous n'avons pas mesuré, et la cause
//            est connue : elle voyage avec l'état.
//
// Les confondre est exactement le défaut fermé ici. `absent` et `refused` ont
// la même forme en sortie — rien — et des significations opposées.

import type { MeasurementState } from "@/lib/publication/absenceVocabulary";

/**
 * La version maximale de transaction que ce produit sait lire.
 *
 * Le paramètre déclare ce que le CLIENT supporte, pas ce que la chaîne
 * produit : le nœud refuse toute transaction d'une version supérieure. Rester
 * à 0 revenait donc à refuser d'avance toute v1, et à la perdre en silence.
 *
 * Le décodage lui-même est agnostique à la version : sous `jsonParsed`, les
 * sites de ce produit lisent `accountKeys`, `pre/postTokenBalances` et
 * `blockTime`, qui ne changent pas de forme. Rien n'est deviné du contenu
 * d'une v1 — on cesse simplement de refuser de la recevoir.
 */
export const MAX_SUPPORTED_TRANSACTION_VERSION = 1;

/** La config de lecture, écrite UNE fois. Cinq sites la partagent. */
export const TX_READ_CONFIG = {
  encoding: "jsonParsed" as const,
  maxSupportedTransactionVersion: MAX_SUPPORTED_TRANSACTION_VERSION,
};

/** Le code JSON-RPC d'un refus de version. Nommé pour être reconnaissable. */
export const RPC_UNSUPPORTED_VERSION = -32015;

export type RpcRead<T> =
  | { kind: "value"; value: T }
  | { kind: "absent" }
  | { kind: "refused"; state: MeasurementState; code: number | null; message: string };

/**
 * La forme minimale d'une transaction `jsonParsed`, telle que les sites de ce
 * produit la lisent. Volontairement partielle : ce module ne prétend pas
 * décrire une transaction Solana, seulement ce que nos cinq sites consomment.
 *
 * Elle est identique pour legacy, v0 et v1 — c'est ce qui rend le support de
 * la v1 mécanique, et non une décision sur ce qu'une v1 signifie.
 */
/* eslint-disable @typescript-eslint/no-explicit-any --
 * Les cinq sites consommateurs indexent librement `accountKeys`,
 * `pre/postTokenBalances` et `uiTokenAmount`. Décrire fidèlement la forme
 * `jsonParsed` de Solana est un travail de typage à part entière, et ce P0
 * n'est pas un refactor de typage : son objet est de cesser de confondre un
 * refus avec une absence.
 *
 * La permissivité est donc CONCENTRÉE ici, en un point nommé, plutôt que
 * dispersée en `any` dans quatre fichiers gelés. Le jour où la forme sera
 * typée, elle le sera à cet endroit et nulle part ailleurs.
 */
export interface ParsedTx {
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: any[];
    postTokenBalances?: any[];
  } | null;
  transaction?: {
    message?: {
      accountKeys?: any[];
      instructions?: Array<{ programId?: string; parsed?: { type?: string } }>;
    };
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Une transaction qu'on sait exister et qu'on n'a pas pu lire. */
export interface UnreadableTx {
  signature: string;
  /** Axe MESURE uniquement. Jamais un état de publication. */
  state: MeasurementState;
  code: number | null;
  message: string;
}

/**
 * Classe une réponse JSON-RPC brute. Le seul endroit du produit qui décide
 * qu'un refus n'est pas une absence.
 *
 * `error` est regardé EN PREMIER : un nœud peut renvoyer `result: null` à côté
 * d'une erreur, et c'est l'erreur qui fait foi.
 *
 * Un refus de version est `NOT_MEASURABLE` — avec le contexte dont nous
 * disposons, cette transaction ne peut pas être interprétée. Toute autre
 * erreur est `FAILURE` : on a tenté, et ça a échoué. La distinction n'est pas
 * cosmétique : la première se corrige en supportant la version, la seconde en
 * réessayant.
 */
export function classifyRpcRead<T>(json: unknown): RpcRead<T> {
  const j = (json ?? {}) as { result?: unknown; error?: { code?: unknown; message?: unknown } };

  if (j.error) {
    const code = typeof j.error.code === "number" ? j.error.code : null;
    const message =
      typeof j.error.message === "string" ? j.error.message : "unspecified RPC error";
    return {
      kind: "refused",
      state: code === RPC_UNSUPPORTED_VERSION ? "NOT_MEASURABLE" : "FAILURE",
      code,
      message,
    };
  }

  // Pas d'erreur, pas de résultat : le nœud a répondu, et il n'y a rien.
  // C'est un constat, pas un échec — et il ne doit pas être confondu.
  if (j.result === null || j.result === undefined) return { kind: "absent" };

  return { kind: "value", value: j.result as T };
}

/** Le journal d'une lecture refusée, prêt à voyager à côté des données. */
export function unreadable(signature: string, read: RpcRead<unknown>): UnreadableTx | null {
  if (read.kind !== "refused") return null;
  return { signature, state: read.state, code: read.code, message: read.message };
}
