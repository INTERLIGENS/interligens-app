// ─── L'armement de la sonde C4 — quand elle a le DROIT de juger ─────────────
//
// Une sonde de fraîcheur n'est crédible qu'à partir du moment où l'écrivain
// qu'elle observe a eu une CHANCE d'écrire. Avant ça, son silence ne dit rien
// sur le Watcher — il dit seulement qu'elle vient d'être branchée.
//
// ── LE FAUX POSITIF QUE CE MODULE EXISTE POUR TUER ────────────────────────
//
// Constaté en production le 2026-08-25, quelques minutes après le déploiement
// de l'écrivain : la fenêtre ne contenait qu'un run MANUEL (un curl de
// vérification). La sonde a donc rendu, en toute rigueur :
//
//     🔴 Scheduler — dernier cron démarré : jamais
//     Runs LIVE+CRON retenus : 0 (écartés : 1)
//
// C'est formellement exact et pratiquement faux : le Watcher allait très bien,
// simplement aucun rendez-vous cron n'était encore passé DEPUIS que l'écrivain
// existe. Le prochain était à 06:00 UTC le lendemain. Sans garde, le watchdog
// envoyait une ALERTE CRITICAL le soir même, résolue toute seule au matin.
//
// C'est exactement le travers contre lequel la sonde a été écrite : une alerte
// qui crie faux pendant une journée est une alerte qu'on apprend à ignorer.
//
// ── LA GARDE, ET SA LIMITE STRICTE ────────────────────────────────────────
//
// On ne suspend le jugement que lorsqu'on peut PROUVER que l'écrivain est plus
// jeune qu'un cycle complet — c'est-à-dire qu'aucun rendez-vous cron n'a pu
// être manqué, faute d'avoir existé. Passé ce délai, l'absence de run cron
// redevient ce qu'elle est : une panne, et la sonde crie.
//
// La garde ne peut donc JAMAIS masquer un ordonnanceur mort plus d'une cadence.
// C'est ce qui la distingue d'un simple « on ignore les premiers jours ».

import type { WatcherRunRecord } from "./watcherRunTypes";

/** Pourquoi la sonde ne juge pas encore. `null` = elle juge. */
export type ArmingState =
  | { readonly armed: true }
  | { readonly armed: false; readonly reason: string };

export interface ArmingInput {
  /** Toutes les lignes WATCHER_V2 lues, tous triggers confondus. */
  readonly runs: readonly WatcherRunRecord[];
  /** Runs retenus par la sonde (CRON + LIVE). */
  readonly liveCronRunCount: number;
  readonly now: Date;
  /** Intervalle entre deux rendez-vous cron. */
  readonly cadenceMs: number;
}

/** L'horodatage le plus ancien observé, tous triggers confondus. */
function oldestObservation(runs: readonly WatcherRunRecord[]): Date | null {
  let oldest: Date | null = null;
  for (const r of runs) {
    const t = r.startedAt ?? r.scheduledAt ?? r.finishedAt;
    if (t == null) continue;
    if (oldest == null || t.getTime() < oldest.getTime()) oldest = t;
  }
  return oldest;
}

export function evaluateArming(input: ArmingInput): ArmingState {
  const { runs, liveCronRunCount, now, cadenceMs } = input;

  // 1. Rien du tout : l'écrivain n'est pas déployé, ou n'écrit pas.
  if (runs.length === 0) {
    return {
      armed: false,
      reason: "aucun run watcher-v2 journalisé — écrivain JobRunLog non déployé, ou muet",
    };
  }

  // 2. Des lignes, mais aucune du cron. Deux mondes très différents :
  //    l'écrivain vient d'arriver (rien à dire), ou le cron est mort (tout à dire).
  //    Seule l'ANCIENNETÉ de l'écrivain les sépare.
  if (liveCronRunCount === 0) {
    const oldest = oldestObservation(runs);
    // Pas d'horodatage exploitable : on ne peut pas prouver la jeunesse de
    // l'écrivain, donc on ne suspend rien. Dans le doute, la sonde juge.
    if (oldest == null) return { armed: true };

    const writerAgeMs = now.getTime() - oldest.getTime();
    if (writerAgeMs < cadenceMs) {
      const h = (writerAgeMs / 3_600_000).toFixed(1);
      return {
        armed: false,
        reason:
          `écrivain JobRunLog en service depuis ${h} h seulement — ` +
          `aucun rendez-vous cron n'est encore passé depuis son déploiement`,
      };
    }
    // Plus vieux qu'une cadence sans un seul run cron : c'est une panne.
    return { armed: true };
  }

  return { armed: true };
}
