// ─── BUILD 11 · S3 — LE CONTRAT DE RÉPONSE DE REFLEX ──────────────────────
//
// ██  L'état de mesure voyage À CÔTÉ de la valeur, jusqu'au consommateur.  ██
//
// Cette projection vivait en fonction locale DANS la route, qui est gelée.
// Elle n'y avait rien à faire : c'est le contrat public de REFLEX, et le
// modifier exigeait donc une fenêtre d'exemption à chaque fois. Elle est
// extraite ici, dans un fichier libre ; la route ne fait plus que l'appeler.
//
// Ce que la réponse porte désormais, en plus du verdict :
//
//   coverage         ce qui a été mesuré, ce qui ne l'a pas été, et pourquoi
//   degraded         vrai dès qu'UN moteur n'a pas pu se prononcer
//   confidenceState  pourquoi le score vaut ce qu'il vaut
//   confidenceScore  `null` — jamais 0 — quand rien n'a été mesuré
//
// Aucune UI retail n'est ajoutée : R est ratifié engine/API only, l'intégration
// retail appartient à BUILD 12.

import type { ReflexAnalysisResult, ReflexLocale } from "./types";

export function localizedResponse(
  result: ReflexAnalysisResult,
  locale: ReflexLocale,
) {
  return {
    id: result.id,
    createdAt: result.createdAt.toISOString(),
    verdict: result.verdict,
    verdictReason:
      locale === "fr" ? result.verdictReasonFr : result.verdictReasonEn,
    action: locale === "fr" ? result.actionFr : result.actionEn,
    confidence: result.confidence,
    confidenceScore: result.confidenceScore,
    // ── L'état de mesure, servi explicitement ──────────────────────────
    confidenceState: result.confidenceState,
    coverage: {
      // Les TROIS notions, servies séparément. Les confondre faisait passer
      // « quatre moteurs ne s'appliquent pas ici » pour « quatre manquent ».
      total: result.coverage.total,
      measured: result.coverage.measured,
      expected: result.coverage.expected,
      expectedMeasured: result.coverage.expectedMeasured,
      // Ce que le contrat ne demandait pas — visible, avec sa cause exacte,
      // pour qu'un lecteur voie que l'absence est normale plutôt que de la
      // déduire d'un silence.
      notExpected: result.coverage.notExpected.map((m) => ({
        engine: m.engine,
        reason: m.reason,
      })),
      missing: result.coverage.missing.map((m) => ({
        engine: m.engine,
        reason: m.reason,
        // `error` n'est servi que s'il existe. On ne fabrique pas de cause.
        ...(m.detail ? { detail: m.detail } : {}),
      })),
    },
    degraded: result.degraded,
    input: {
      type: result.input.type,
      chain: result.input.chain ?? null,
      address: result.input.address ?? null,
      handle: result.input.handle ?? null,
      url: result.input.url ?? null,
    },
    signalsHashShort: result.signalsHash.slice(0, 8),
    mode: result.mode,
    enginesVersion: result.enginesVersion,
    latencyMs: result.latencyMs,
  };
}
