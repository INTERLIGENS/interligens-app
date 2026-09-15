// ─── LE DÉCIDEUR — la pièce qui choisit d'envoyer, ou de se taire ───────────
//
// Ce module ne fait qu'une chose : dire si une alerte part, ou si elle est
// SUPPRIMÉE par l'anti-spam, et POURQUOI.
//
// ── POURQUOI IL EXISTE ────────────────────────────────────────────────────
//
// Le 2026-09-14, le watchdog s'est tu sur quatre problèmes réels. La cause a
// été mesurée : suppression par déduplication (journal, ligne 1178), branche
// `changed || stale`. Cette logique vivait EN LIGNE dans `main()` de
// `watcher-health.mjs`. Trois symboles — REALERT_MS, lastSignature,
// lastAlertAt — n'apparaissaient dans AUCUN test du dépôt : le décideur était
// la seule pièce de la chaîne d'alerte ni extraite ni prouvée, alors que c'est
// lui qui décide du silence.
//
// L'extraction est à comportement IDENTIQUE. Rien n'est corrigé ici :
//
//   ⚠️ LA FENÊTRE DE RÉ-ALERTE VAUT 24h, ET LE CRON launchd A UNE PÉRIODE DE
//      24h. Une fenêtre égale à la cadence est un DÉFAUT DE CONCEPTION NOMMÉ :
//      la comparaison est un `>` strict, donc deux runs séparés par exactement
//      une période tombent du mauvais côté de la frontière et la seconde
//      alerte est supprimée. C'est précisément ce qui a produit le silence du
//      14. Sa correction est une décision d'architecture qui n'est pas rendue :
//      elle n'appartient pas à une fenêtre d'observabilité. Ce module la REND
//      VISIBLE — il ne la répare pas.
//
// Ce que ce module apporte, et que la version en ligne ne pouvait pas donner :
// la décision porte sa RAISON. « On sait qu'il y a eu suppression, pas de
// quoi » cesse d'être vrai.

/**
 * Fenêtre de ré-alerte : un même problème n'est renvoyé qu'une fois par 24h.
 *
 * Valeur et comparaison reprises À L'IDENTIQUE de `watcher-health.mjs`
 * (`const REALERT_MS = 24 * 3_600_000`, comparaison `>` stricte). Le constat
 * qu'elle est égale à la période du cron est consigné, pas corrigé.
 */
export const REALERT_WINDOW_MS = 24 * 3_600_000;

/** L'état anti-spam tel qu'il est lu sur disque — champs possiblement absents. */
export interface WatchdogAntiSpamState {
  readonly lastAlertAt?: number | null;
  readonly lastSignature?: string | null;
  readonly lastHeartbeatDate?: string | null;
}

/** Ce qu'il est advenu de l'alerte, pour l'historique. */
export type AlertOutcome = "ENVOI" | "SUPPRIMEE" | "ECHEC";

/** Pourquoi le décideur a tranché comme il l'a fait. */
export type AlertReasonCode =
  | "CHANGEMENT_DE_SIGNATURE"
  | "FENETRE_DEPASSEE"
  | "CHANGEMENT_ET_FENETRE"
  | "DOUBLON_DANS_FENETRE";

export interface AlertDecisionInput {
  /** Signature du run : clés de problème triées, jointes par des virgules. */
  readonly signature: string;
  readonly state: WatchdogAntiSpamState;
  /** `Date.now()` au point de décision. */
  readonly now: number;
  /** Injectable POUR LES TESTS uniquement. La production prend le défaut. */
  readonly realertWindowMs?: number;
}

export interface AlertDecision {
  /** `true` => l'alerte part. C'est `changed || stale`, rien d'autre. */
  readonly send: boolean;
  readonly changed: boolean;
  readonly stale: boolean;
  /** `now - (lastAlertAt || 0)`. Vaut `now` quand aucune alerte n'a été émise. */
  readonly deltaMs: number;
  readonly realertWindowMs: number;
  readonly signature: string;
  /** Tel que lu : `null` si le champ était absent de l'état. */
  readonly lastSignature: string | null;
  readonly lastAlertAt: number | null;
  readonly reasonCode: AlertReasonCode;
  /** Phrase nommant la signature et le delta mesuré. */
  readonly reason: string;
}

const fmtDelta = (ms: number): string => {
  if (!Number.isFinite(ms)) return `${ms}`;
  return `${ms} ms (${(ms / 3_600_000).toFixed(2)}h)`;
};

const quote = (s: string | null): string => (s === null ? "(absente)" : s === "" ? "(vide)" : `«${s}»`);

/**
 * Décide si l'alerte part — fonction PURE, aucune E/S, aucune horloge lue.
 *
 * Reproduit exactement la branche historique de `main()` :
 *
 *     const changed = signature !== state.lastSignature;
 *     const stale   = now - (state.lastAlertAt || 0) > REALERT_MS;
 *     if (changed || stale) { ...envoi... } else { ...suppression... }
 *
 * Les deux opérateurs sont conservés tels quels, y compris le `||` de
 * `(state.lastAlertAt || 0)` — un `??` donnerait un autre résultat sur `NaN`.
 */
export function decideAlert(input: AlertDecisionInput): AlertDecision {
  const realertWindowMs = input.realertWindowMs ?? REALERT_WINDOW_MS;

  const changed = input.signature !== input.state.lastSignature;
  const deltaMs = input.now - (input.state.lastAlertAt || 0);
  const stale = deltaMs > realertWindowMs;
  const send = changed || stale;

  const lastSignature = input.state.lastSignature ?? null;
  const lastAlertAt = input.state.lastAlertAt ?? null;

  let reasonCode: AlertReasonCode;
  let reason: string;

  if (changed && stale) {
    reasonCode = "CHANGEMENT_ET_FENETRE";
    reason =
      `signature changée ${quote(lastSignature)} → ${quote(input.signature)} ` +
      `ET delta ${fmtDelta(deltaMs)} > fenêtre ${fmtDelta(realertWindowMs)}`;
  } else if (changed) {
    reasonCode = "CHANGEMENT_DE_SIGNATURE";
    reason =
      `signature changée ${quote(lastSignature)} → ${quote(input.signature)} ` +
      `(delta ${fmtDelta(deltaMs)} ≤ fenêtre ${fmtDelta(realertWindowMs)})`;
  } else if (stale) {
    reasonCode = "FENETRE_DEPASSEE";
    reason =
      `même signature ${quote(input.signature)} mais delta ${fmtDelta(deltaMs)} ` +
      `> fenêtre ${fmtDelta(realertWindowMs)}`;
  } else {
    reasonCode = "DOUBLON_DANS_FENETRE";
    reason =
      `même signature ${quote(input.signature)} et delta ${fmtDelta(deltaMs)} ` +
      `≤ fenêtre ${fmtDelta(realertWindowMs)} — renvoi supprimé`;
  }

  return {
    send,
    changed,
    stale,
    deltaMs,
    realertWindowMs,
    signature: input.signature,
    lastSignature,
    lastAlertAt,
    reasonCode,
    reason,
  };
}
