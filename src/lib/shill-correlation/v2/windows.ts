// --- A - Les deux fenetres, nommees et separees ---------------------------
//
// La fenetre d'OBSERVATION est celle de v1 (ANALYSIS_WINDOW, arbitrage senior
// du 2026-06-09) : [-10 min, +15 min] autour de la publication, decoupee en
// trois zones. Elle n'est PAS redefinie ici - la reutiliser garantit que v1 et
// v2 parlent du meme objet.
//
// La fenetre TEMOIN est de MEME LARGEUR, sur le MEME token, decalee dans le
// passe la ou aucune publication n'a eu lieu. Une co-occurrence n'est une
// correlation que rapportee a un taux de base : « 251 wallets ont achete avant
// le tweet » ne dit rien tant qu'on ignore combien achetent avant n'importe
// quel instant.
//
// Les deux constructeurs rendent le MEME type, mais `kind` les distingue et
// aucune fonction du moteur n'accepte les deux sans le lire.

import { ANALYSIS_WINDOW } from "../types";
import type { BehaviorType, BehaviorZone } from "./types";
import type { EnginePolicy } from "./policy";

export type WindowKind = "observed" | "baseline";

export interface TimeWindow {
  startMs: number;
  endMs: number;
  /** Instant de reference : la publication, ou son image decalee pour le temoin. */
  anchorMs: number;
  kind: WindowKind;
}

/** Largeur commune aux deux fenetres. Elles ne peuvent pas differer : un
 *  temoin plus large ou plus etroit ne serait pas un temoin. */
export const WINDOW_WIDTH_SECONDS =
  ANALYSIS_WINDOW.preSeconds + ANALYSIS_WINDOW.postSeconds; // 1500

export function observedWindow(observedAt: Date): TimeWindow {
  const anchorMs = observedAt.getTime();
  return {
    anchorMs,
    startMs: anchorMs - ANALYSIS_WINDOW.preSeconds * 1000,
    endMs: anchorMs + ANALYSIS_WINDOW.postSeconds * 1000,
    kind: "observed",
  };
}

/**
 * Fenetre temoin : meme largeur, meme token, decalee de
 * `baselineOffsetSeconds` dans le passe.
 */
export function baselineWindow(observedAt: Date, policy: EnginePolicy): TimeWindow {
  const anchorMs = observedAt.getTime() - policy.baselineOffsetSeconds * 1000;
  return {
    anchorMs,
    startMs: anchorMs - ANALYSIS_WINDOW.preSeconds * 1000,
    endMs: anchorMs + ANALYSIS_WINDOW.postSeconds * 1000,
    kind: "baseline",
  };
}

/**
 * Le decalage temoin est-il assez grand pour ne pas recouvrir l'observation ?
 *
 * Si non, le temoin contient tout ou partie des achats qu'il est cense servir
 * de reference : le lift se compare a lui-meme et tend mecaniquement vers 1.
 * Ce n'est pas un lift faible, c'est un lift qui ne mesure rien - d'ou un refus
 * en amont (`BASELINE_WINDOW_OVERLAPS_OBSERVED`), pas une valeur degradee.
 */
export function baselineIsDisjoint(policy: EnginePolicy): boolean {
  return policy.baselineOffsetSeconds > WINDOW_WIDTH_SECONDS;
}

/** Les deux fenetres se recouvrent-elles reellement, pour une occasion donnee ? */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.startMs <= b.endMs && b.startMs <= a.endMs;
}

/** Zone d'un achat, a partir de son ecart signe a l'ancre. Bornes de v1. */
export function zoneForDelta(
  deltaSeconds: number,
): { zone: BehaviorZone; type: BehaviorType } | null {
  if (deltaSeconds < -ANALYSIS_WINDOW.preSeconds) return null;
  if (deltaSeconds > ANALYSIS_WINDOW.postSeconds) return null;
  if (deltaSeconds < ANALYSIS_WINDOW.zoneBStartSeconds) return { zone: "zone_a", type: "pre_tweet" };
  if (deltaSeconds <= ANALYSIS_WINDOW.zoneBEndSeconds) return { zone: "zone_b", type: "near_tweet" };
  return { zone: "zone_c", type: "post_tweet" };
}
