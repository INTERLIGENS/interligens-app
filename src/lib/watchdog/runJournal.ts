// ─── LE JOURNAL — deux horloges nommées, et une durée mesurée ───────────────
//
// Ce module ne décide rien. Il met en forme ce que le décideur a tranché, pour
// que le journal cesse d'être muet sur le QUAND et sur le POURQUOI.
//
// ── CE QUE LE JOURNAL NE SAVAIT PAS DIRE ──────────────────────────────────
//
// Mesuré le 2026-09-15 sur les 1205 lignes existantes
// (`~/Library/Logs/interligens-watchdog.log`, depuis le 2026-06-24) :
//
//   - 74 lignes portent une date — et RIEN d'autre : `todayStr()` rend
//     `toISOString().slice(0, 10)`, soit une date de CALENDRIER UTC.
//   - 0 ligne, sur 1205, porte une heure. Pas une.
//   - Aucune durée de run n'est écrite nulle part.
//
// Conséquence directe sur l'incident du 2026-09-14 : le delta qui a franchi —
// ou non — la frontière des 24h n'est reconstructible d'AUCUNE façon. Deux runs
// datés du même jour calendaire peuvent être séparés de 30 secondes ou de 23
// heures ; deux runs datés de jours consécutifs, de 1 minute ou de 47 heures.
//
// ── DEUX HORLOGES, JAMAIS UNE PRÉCISION RECONSTRUITE ──────────────────────
//
// Chaque ligne porte les DEUX lectures, chacune nommée :
//
//     [UTC 2026-09-15T07:00:04.123Z | LOC 2026-09-15T09:00:04.123+02:00]
//
// L'UTC est l'instant. Le LOC est ce que l'horloge de l'hôte affichait, offset
// EXPLICITE compris. On ne note jamais une heure locale nue : ce dépôt a déjà
// payé ce prix (captures OSINT horodatées Paris alors que la machine était en
// UTC+8). Une heure sans offset n'est pas un instant, c'est une opinion.
//
// L'offset est un PARAMÈTRE, avec `-getTimezoneOffset()` pour défaut : c'est ce
// qui rend cette mise en forme testable sans dépendre du fuseau de la machine
// qui fait tourner les tests.

import type { AlertDecision, AlertOutcome } from "./alertDecision";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** L'offset local de l'hôte, en minutes à l'EST de UTC (Paris été = +120). */
export function localOffsetMinutes(at: Date): number {
  return -at.getTimezoneOffset();
}

/** `+02:00`, `-05:30`, `+00:00` — jamais un nom de fuseau, jamais rien. */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** ISO 8601 de l'heure MURALE locale, offset explicite en queue. */
export function formatLocalIso(at: Date, offsetMinutes: number = localOffsetMinutes(at)): string {
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().replace("Z", "") + formatOffset(offsetMinutes);
}

/** Le préfixe de ligne : les deux horloges, nommées. */
export function formatClockPrefix(at: Date, offsetMinutes: number = localOffsetMinutes(at)): string {
  return `[UTC ${at.toISOString()} | LOC ${formatLocalIso(at, offsetMinutes)}]`;
}

/**
 * Préfixe CHAQUE ligne d'un message, y compris multi-lignes.
 *
 * Le résumé du watchdog fait dix lignes d'un seul `console.log`. N'horodater
 * que la première laisserait neuf lignes sur dix anonymes — exactement le
 * défaut qu'on corrige.
 */
export function stampLines(prefix: string, text: string): string {
  return text
    .split("\n")
    .map((l) => `${prefix} ${l}`)
    .join("\n");
}

// ─── L'HISTORIQUE — un enregistrement par run, append-only ─────────────────
//
// Le journal launchd est du texte destiné à un humain. L'historique est une
// SÉRIE : une ligne JSON par run, jamais réécrite, qui permet de répondre à
// « combien de temps s'est-il écoulé entre ces deux décisions » sans lire une
// seule phrase.

/** Quelle branche de `main()` a produit cet enregistrement. */
export type RunBranch = "PROBLEMS" | "GREEN" | "DB_FAILURE";

export interface RunJournalRecord {
  readonly schema: 1;
  readonly runId: string;
  /** Instant du point de décision. */
  readonly decidedAtUtc: string;
  readonly decidedAtLocal: string;
  /** Instant de démarrage du PROCESSUS (dérivé de `process.uptime()`). */
  readonly processStartedAtUtc: string;
  /** Du démarrage du processus au point de décision. */
  readonly runDurationMs: number;
  readonly branch: RunBranch;
  readonly problemCount: number;
  /**
   * `true` seulement quand le décideur a réellement arbitré (branche
   * PROBLEMS). Sur GREEN il est calculé À TITRE D'OBSERVATION et n'a influencé
   * aucune décision : la branche verte suit le heartbeat, pas l'anti-spam.
   */
  readonly deciderApplied: boolean;
  readonly signature: string;
  readonly lastSignature: string | null;
  readonly changed: boolean | null;
  readonly lastAlertAt: number | null;
  readonly lastAlertAtUtc: string | null;
  readonly deltaMs: number | null;
  readonly realertWindowMs: number | null;
  readonly stale: boolean | null;
  readonly decision: AlertOutcome;
  readonly reasonCode: string;
  readonly reason: string;
}

export interface BuildRecordInput {
  readonly runId: string;
  readonly decidedAt: Date;
  readonly processStartedAt: Date;
  readonly runDurationMs: number;
  readonly branch: RunBranch;
  readonly problemCount: number;
  readonly deciderApplied: boolean;
  readonly decision: AlertOutcome;
  /** Absent quand le run n'a jamais atteint le décideur (panne DB). */
  readonly alertDecision?: AlertDecision;
  /** Raison réellement observée — prime sur celle du décideur. */
  readonly reasonCode: string;
  readonly reason: string;
  readonly offsetMinutes?: number;
}

/** Fonction PURE : aucune horloge lue, aucune écriture. */
export function buildRunJournalRecord(input: BuildRecordInput): RunJournalRecord {
  const offset = input.offsetMinutes ?? localOffsetMinutes(input.decidedAt);
  const d = input.alertDecision;
  const lastAlertAt = d?.lastAlertAt ?? null;

  return {
    schema: 1,
    runId: input.runId,
    decidedAtUtc: input.decidedAt.toISOString(),
    decidedAtLocal: formatLocalIso(input.decidedAt, offset),
    processStartedAtUtc: input.processStartedAt.toISOString(),
    runDurationMs: input.runDurationMs,
    branch: input.branch,
    problemCount: input.problemCount,
    deciderApplied: input.deciderApplied,
    signature: d?.signature ?? "",
    lastSignature: d ? d.lastSignature : null,
    changed: d ? d.changed : null,
    lastAlertAt,
    lastAlertAtUtc: lastAlertAt ? new Date(lastAlertAt).toISOString() : null,
    deltaMs: d ? d.deltaMs : null,
    realertWindowMs: d ? d.realertWindowMs : null,
    stale: d ? d.stale : null,
    decision: input.decision,
    reasonCode: input.reasonCode,
    reason: input.reason,
  };
}

/** Une ligne JSON, sans saut interne — le format append-only du fichier. */
export function serializeRecord(record: RunJournalRecord): string {
  return JSON.stringify(record) + "\n";
}
