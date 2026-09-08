// ─── BUILD 12 · P0 — LE DÉFAUT DU CHEMIN ÉTAIT L'AUTORISATION ─────────────
//
// ██  Un état d'erreur, d'absence ou non concluant ne produit JAMAIS ALLOW. ██
//
// ─── Ce qui était là ──────────────────────────────────────────────────────
//
//   let fromVerdict: SwapVerdict = "GREEN";     // la valeur par défaut
//   let toVerdict: SwapVerdict = "GREEN";       // du chemin est l'autorisation
//   try {
//     [fromVerdict, toVerdict] = await Promise.all([...]);
//   } catch {
//     return { fromVerdict: "GREEN", toVerdict: "GREEN", blocked: false };
//   }
//
// Trois défauts, et ils se cumulent :
//
//   1. l'INITIALISATION à GREEN — le chemin s'ouvre avant toute mesure ;
//   2. le CATCH qui rend GREEN/GREEN/non bloqué — n'importe quelle panne
//      autorise, et la sortie est indistinguable d'une mesure propre ;
//   3. `Promise.all` ne rend que la PREMIÈRE rejection : si une branche a
//      mesuré RED et que sa sœur échoue, le RED mesuré est perdu.
//
// Le troisième est le plus coûteux. Un jeton réellement dangereux, correctement
// détecté, disparaissait parce qu'un provider sans rapport avait échoué sur
// l'autre côté du swap.
//
// ─── Ce qu'il y a maintenant ──────────────────────────────────────────────
//
// Chaque côté attrape sa propre panne AVANT d'être joint : `mesurerCote` ne
// rejette jamais, donc plus aucune rejection ne peut emporter la mesure d'en
// face. Chaque côté porte son propre état. Un verdict mesuré survit à l'échec
// de son voisin. Une absence de mesure est `null` et se lit, au lieu de se
// faire passer pour GREEN.
//
// `computeVerdictMeasured` est préféré à `computeVerdict` : la dégradation
// qu'il produit existait déjà, se documentait comme le chemin à préférer pour
// toute surface rendant un verdict à un utilisateur, et n'avait AUCUN
// consommateur — `computeVerdict` la jetait à sa dernière ligne.
//
// ─── Sur le mot « WARN » ──────────────────────────────────────────────────
//
// Le contrat legacy n'a pas d'état neutre : `SwapVerdict` vaut GREEN, ORANGE
// ou RED, et rien d'autre. Un cas non concluant sort donc non bloqué AVEC un
// avertissement explicite et `degraded: true`.
//
// C'est de la COMPATIBILITÉ TEMPORAIRE, pas une sémantique : cet
// avertissement ne signifie ni VERIFY ni WAIT, et ne doit être lu comme
// l'équivalent d'aucun des deux.

import { computeVerdictMeasured } from "@/lib/publicScore/computeVerdict";
import type { MeasurementState } from "@/lib/publication/absenceVocabulary";
import type { PreSwapScanResult, PreSwapSideCoverage, SwapVerdict } from "./types";

interface CoteMesure {
  verdict: SwapVerdict | null;
  coverage: PreSwapSideCoverage;
}

/** Un côté, réglé seul. Son échec n'emporte pas celui d'en face. */
async function mesurerCote(
  side: "from" | "to",
  address: string,
): Promise<CoteMesure> {
  try {
    const m = await computeVerdictMeasured(address);
    // Une mesure partielle reste une mesure : le verdict est réel, et les
    // entrées manquantes sont NOMMÉES au lieu d'être tues.
    const partielle = m.degraded.length > 0;
    return {
      verdict: m.verdict,
      coverage: {
        side,
        state: (partielle ? "NOT_MEASURED" : "MEASURED") as MeasurementState,
        ...(partielle
          ? { detail: m.degraded.map((d) => `${d.field}:${d.reason}`).join(", ") }
          : {}),
      },
    };
  } catch (e) {
    // Tenté, et échoué. Aucun verdict n'est fabriqué à la place.
    return {
      verdict: null,
      coverage: {
        side,
        state: "FAILURE" as MeasurementState,
        detail: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

export async function preSwapScan(
  fromAddress: string,
  toAddress: string,
): Promise<PreSwapScanResult> {
  // `mesurerCote` a déjà attrapé sa panne : ce `Promise.all` ne peut plus
  // rejeter, donc il ne peut plus faire disparaître la mesure de l'autre côté.
  // C'est exactement le RED qui se perdait.
  const [from, to] = await Promise.all([
    mesurerCote("from", fromAddress),
    mesurerCote("to", toAddress),
  ]);

  const sides = [from.coverage, to.coverage];
  const expectedMeasured = sides.filter((s) => s.state === "MEASURED").length;
  const coverage = { expected: 2, expectedMeasured, sides };
  const degraded = expectedMeasured < 2;
  const base = { fromVerdict: from.verdict, toVerdict: to.verdict, coverage, degraded };

  // ── 1. UN RED MESURÉ BLOQUE, quoi qu'il arrive à l'autre côté ──────────
  if (from.verdict === "RED" || to.verdict === "RED") {
    const which = from.verdict === "RED" ? "source token" : "destination token";
    return { ...base, blocked: true, blockReason: `${which} is flagged RED — swap blocked` };
  }

  // ── 2. UN ORANGE MESURÉ AVERTIT ───────────────────────────────────────
  if (from.verdict === "ORANGE" || to.verdict === "ORANGE") {
    const which = from.verdict === "ORANGE" ? "source token" : "destination token";
    return {
      ...base,
      blocked: false,
      warning: `${which} has elevated risk (ORANGE) — proceed with caution`,
    };
  }

  // ── 3. NON CONCLUANT — ni RED, ni ORANGE, mais pas mesuré non plus ────
  //
  // C'est ici que le chemin autorisait. Il avertit désormais, et le dit :
  // l'absence de signal ne peut pas être présentée comme une absence de
  // risque quand le signal n'a pas été cherché avec succès.
  if (degraded) {
    const manquants = sides
      .filter((s) => s.state !== "MEASURED")
      .map((s) => `${s.side} token`)
      .join(" and ");
    return {
      ...base,
      blocked: false,
      warning: `${manquants} could not be fully checked — this is not a clean result`,
    };
  }

  // ── 4. LES DEUX CÔTÉS MESURÉS, AUCUN SIGNAL ───────────────────────────
  return { ...base, blocked: false };
}
