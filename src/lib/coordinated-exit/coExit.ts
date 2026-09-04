// --- BUILD 6 / F0 / G2 — LA CO-SORTIE, OBSERVATION SEULE ------------------
//
// PURE. Une seule question, et elle est factuelle :
//
//   « Parmi les ExitEvents FOURNIS, quels sujets sortent à moins de N secondes
//     les uns des autres — et, quand la donnée le démontre, vers un même venue ? »
//
// ██ CE QUE CE MODULE NE DIT JAMAIS ██
//
// Il ne dit pas « ces sorties sont coordonnées ». Ni dump, ni rug, ni intention.
// Deux wallets qui vendent à 40 secondes d'écart peuvent réagir au même
// graphique, au même tweet, au même stop-loss. Trancher demanderait une
// INFÉRENCE — produite ailleurs, sur une base traçable, et jamais ici. Aucun
// score, aucun classement, aucun label ne sort de cette fonction.
//
// ─── LA FENÊTRE EST UN PARAMÈTRE, ET ELLE N'A PAS DE DÉFAUT ──────────────
//
// Aucune valeur canonique n'est figée. Une fenêtre par défaut serait un choix
// méthodologique invisible : le lecteur du résultat ne saurait pas qu'une
// décision a été prise, et l'auteur de l'appel croirait n'en avoir pris
// aucune. La fonction EXIGE le paramètre et REFUSE ce qui n'est pas un nombre
// fini strictement positif.
//
// Et elle ne se règle pas après coup : changer la fenêtre jusqu'à ce que le
// résultat plaise ne mesurerait plus que la fenêtre.
//
// ─── L'ABSENCE EST `NOT_OBSERVED` ────────────────────────────────────────
//
// Ne rien observer n'établit rien. Les événements fournis sont un ÉCHANTILLON :
// ils viennent d'une collecte bornée, sur une fenêtre, sur un budget. Rendre
// « aucune co-sortie observée » comme « pas de coordination » convertirait une
// limite de collecte en fait sur le monde. Le type n'offre aucune valeur qui
// signifierait cela.

import type { ExitEvent } from "./types";

export const CO_EXIT_RULE_VERSION = "coordinated-exit/co-exit@v1";

/** Il en faut au moins deux : un sujet ne co-sort pas avec lui-même. */
export const MIN_SUBJECTS_IN_GROUP = 2;

// ═══ LES TROIS COUVERTURES — SÉPARÉES, ET ELLES LE RESTENT ════════════════
//
// Elles répondent à trois questions différentes. Les fondre en un drapeau
// produirait un signal incapable de dire lequel des trois manques il rapporte,
// et un lecteur l'attribuerait au mauvais.

/** 1. A-t-on atteint tous les SUJETS visés ? */
export interface SubjectCoverage {
  subjectsAttempted: number;
  subjectsCovered: number;
  complete: boolean;
}
/** 2. A-t-on vu toutes les TRANSACTIONS de ceux qu'on a atteints ? */
export interface TransactionCoverage {
  transactionsSeen: number;
  /** `false` dès qu'une borne a coupé : plafond de pages, budget, refus. */
  historyExhausted: boolean;
  censoredBy: string | null;
}
/** 3. Combien d'actes OBSERVÉS portent leur preuve primaire ? */
export interface PrimaryEvidenceCoverage {
  observedActCount: number;
  materializedEventCount: number;
  complete: boolean;
  /** Renseigné si et seulement si `complete` est faux. */
  reason: string | null;
}

export interface ExitCoverage {
  subjects: SubjectCoverage;
  transactions: TransactionCoverage;
  primaryEvidence: PrimaryEvidenceCoverage;
  /**
   * Vrai dès qu'UNE des trois est incomplète. Ce drapeau ne REMPLACE pas les
   * trois : il évite qu'un appelant pressé lise un résultat censuré comme
   * complet. Les trois restent lisibles pour savoir LAQUELLE manque.
   */
  anyIncomplete: boolean;
}

export function summarizeCoverage(
  subjects: SubjectCoverage,
  transactions: TransactionCoverage,
  primaryEvidence: PrimaryEvidenceCoverage,
): ExitCoverage {
  return {
    subjects, transactions, primaryEvidence,
    anyIncomplete: !subjects.complete || !transactions.historyExhausted || !primaryEvidence.complete,
  };
}

/** Deux sorties rapprochées, et l'écart qui les sépare. */
export interface CoExitPair {
  a: ExitEvent;
  b: ExitEvent;
  deltaSeconds: number;
  /** Venue commun DÉMONTRÉ. `null` si l'un des deux ne le nomme pas. */
  sharedVenue: string | null;
}

export interface CoExitGroup {
  mint: string;
  subjects: string[];
  events: ExitEvent[];
  windowSeconds: number;
  spanSeconds: number;
  earliestBlockTimeSeconds: number;
  latestBlockTimeSeconds: number;
  pairs: CoExitPair[];
  /** Nommé seulement si TOUS les événements du groupe le déclarent, identique. */
  sharedVenue: string | null;
}

export type CoExitObservation =
  | {
      observed: true;
      ruleVersion: string;
      windowSeconds: number;
      groups: CoExitGroup[];
      eventsConsidered: number;
      coverage: ExitCoverage;
    }
  | {
      observed: false;
      /** ██ JAMAIS « pas de coordination », ni « pas de co-sortie ». ██ */
      diagnostic: "NOT_OBSERVED";
      ruleVersion: string;
      windowSeconds: number;
      /** Une limite, pas une conclusion. */
      reason:
        | "no_events_provided"
        | "fewer_than_two_subjects"
        | "no_subjects_within_window";
      eventsConsidered: number;
      coverage: ExitCoverage;
    };

export class MissingCoExitWindowError extends Error {
  constructor(got: unknown) {
    super(
      `[coordinated-exit] observeCoExit — la fenêtre est un PARAMÈTRE OBLIGATOIRE, ` +
        `reçu « ${String(got)} ». Aucune valeur par défaut n'existe : une fenêtre ` +
        `implicite serait un choix méthodologique invisible, que ni l'appelant ni le ` +
        `lecteur du résultat ne sauraient avoir été fait.`,
    );
    this.name = "MissingCoExitWindowError";
  }
}

export interface ObserveCoExitInput {
  events: readonly ExitEvent[];
  /** OBLIGATOIRE. Nombre fini, strictement positif. */
  windowSeconds: number;
  coverage: ExitCoverage;
}

/**
 * Observe les co-sorties dans la fenêtre FOURNIE.
 *
 * Ne collecte rien. Groupe par mint, puis par proximité temporelle : un
 * événement rejoint le groupe courant tant qu'il est à moins de `windowSeconds`
 * du PRÉCÉDENT. Un groupe n'est retenu que s'il réunit au moins deux sujets
 * DISTINCTS — plusieurs sorties d'un même wallet sont un comportement, pas une
 * co-sortie.
 */
export function observeCoExit(input: ObserveCoExitInput): CoExitObservation {
  const w = input.windowSeconds;
  if (typeof w !== "number" || !Number.isFinite(w) || w <= 0) {
    throw new MissingCoExitWindowError(w);
  }
  const base = {
    ruleVersion: CO_EXIT_RULE_VERSION,
    windowSeconds: w,
    eventsConsidered: input.events.length,
    coverage: input.coverage,
  };

  if (input.events.length === 0) {
    return { observed: false, diagnostic: "NOT_OBSERVED", reason: "no_events_provided", ...base };
  }
  if (new Set(input.events.map((e) => e.subjectWallet)).size < MIN_SUBJECTS_IN_GROUP) {
    return { observed: false, diagnostic: "NOT_OBSERVED", reason: "fewer_than_two_subjects", ...base };
  }

  const byMint = new Map<string, ExitEvent[]>();
  for (const e of input.events) {
    const l = byMint.get(e.mint) ?? [];
    l.push(e);
    byMint.set(e.mint, l);
  }

  const groups: CoExitGroup[] = [];
  for (const [mint, list] of byMint) {
    const sorted = [...list].sort((a, b) => a.blockTimeSeconds - b.blockTimeSeconds);
    let current: ExitEvent[] = [];
    const flush = () => {
      const subjects = [...new Set(current.map((e) => e.subjectWallet))];
      if (current.length >= 2 && subjects.length >= MIN_SUBJECTS_IN_GROUP) {
        const times = current.map((e) => e.blockTimeSeconds);
        const earliest = Math.min(...times);
        const latest = Math.max(...times);
        const pairs: CoExitPair[] = [];
        for (let i = 0; i < current.length; i++)
          for (let j = i + 1; j < current.length; j++) {
            const a = current[i], b = current[j];
            if (a.subjectWallet === b.subjectWallet) continue;
            const d = Math.abs(a.blockTimeSeconds - b.blockTimeSeconds);
            // ██ Aucune paire au-delà de la fenêtre FOURNIE. ██ Le chaînage
            // peut étirer un groupe ; une PAIRE, elle, reste dans la fenêtre.
            if (d > w) continue;
            pairs.push({
              a, b, deltaSeconds: d,
              sharedVenue: a.venue && b.venue && a.venue === b.venue ? a.venue : null,
            });
          }
        if (pairs.length > 0) {
          const venues = new Set(current.map((e) => e.venue));
          groups.push({
            mint, subjects, events: current, windowSeconds: w,
            spanSeconds: latest - earliest,
            earliestBlockTimeSeconds: earliest, latestBlockTimeSeconds: latest,
            pairs,
            sharedVenue: venues.size === 1 && !venues.has(null) ? current[0].venue : null,
          });
        }
      }
      current = [];
    };
    for (const e of sorted) {
      if (current.length === 0) { current = [e]; continue; }
      if (e.blockTimeSeconds - current[current.length - 1].blockTimeSeconds <= w) current.push(e);
      else { flush(); current = [e]; }
    }
    flush();
  }

  if (groups.length === 0) {
    return { observed: false, diagnostic: "NOT_OBSERVED", reason: "no_subjects_within_window", ...base };
  }
  groups.sort((a, b) => a.earliestBlockTimeSeconds - b.earliestBlockTimeSeconds);
  return { observed: true, groups, ...base };
}
