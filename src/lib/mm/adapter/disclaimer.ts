// ─── Disclaimer generator (spec §8.7) ─────────────────────────────────────
// Pure function. No I/O. Copy strings live here so the UI, PDF exports and
// API response all speak the same language.

import type { MmSubjectType } from "../types";
import type { ConfidenceLevel, CoverageLevel } from "../engine/types";
import type { DominantDriver, Freshness } from "./types";

export interface DisclaimerInput {
  subjectType: MmSubjectType;
  dominantDriver: DominantDriver;
  confidence: ConfidenceLevel;
  coverage: CoverageLevel;
  freshness: Freshness;
}

function freshnessPrefix(f: Freshness): string {
  if (f.staleness === "stale") return "Analyse datant de plus de 24h. ";
  if (f.staleness === "aging") return "Analyse de moins de 24h. ";
  return "";
}

export function generateDisclaimer(input: DisclaimerInput): string {
  const { subjectType, dominantDriver, confidence, coverage, freshness } = input;
  const prefix = freshnessPrefix(freshness);

  if (subjectType === "ENTITY") {
    // Entity pages are editorial — we do not override their disclaimer with
    // engine state, and freshness is not meaningful there.
    return "Fiche éditoriale. Voir méthodologie et droit de réponse.";
  }

  if (subjectType === "WALLET") {
    if (dominantDriver === "MIXED") {
      return (
        prefix +
        "Attribution entité ET patterns comportementaux concordants. Signal fort."
      );
    }
    if (dominantDriver === "REGISTRY" && confidence === "high") {
      return (
        prefix +
        "Wallet attribué à une entité documentée. Le score reflète le statut de l'entité, pas nécessairement son activité actuelle."
      );
    }
    if (dominantDriver === "BEHAVIORAL" && confidence === "high") {
      return (
        prefix +
        "Comportement on-chain suspect détecté. Aucune attribution entité formelle."
      );
    }
    if (coverage === "low") {
      return prefix + "Données partielles — interprétation prudente.";
    }
    return prefix + "Signaux faibles ou isolés.";
  }

  if (subjectType === "TOKEN") {
    if (dominantDriver === "MIXED") {
      return (
        prefix +
        "Attribution entité ET patterns comportementaux concordants. Signal fort."
      );
    }
    if (dominantDriver === "BEHAVIORAL" && confidence === "high") {
      return (
        prefix +
        "Patterns de manipulation détectés sur ce token. Volume et distribution anormaux vs cohorte."
      );
    }
    if (dominantDriver === "REGISTRY") {
      return (
        prefix +
        "Un ou plusieurs wallets actifs sur ce token sont attribués à une entité documentée."
      );
    }
    if (coverage === "low") {
      return prefix + "Historique token insuffisant pour analyse robuste.";
    }
    return prefix + "Aucun pattern significatif détecté.";
  }

  return prefix + "Analyse standard.";
}
