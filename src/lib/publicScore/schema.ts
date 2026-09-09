import { canonicalPreBuyDecision, contratSatisfait } from "@/lib/prebuy/canonicalDecision";
import { projectPreBuy, REASSURANCE, type PreBuyProjection } from "@/lib/prebuy/projection";

export type SignalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PublicSignal = {
  id: string;
  label: string;
  severity: SignalSeverity;
  value?: string | number;
};

export type PublicVerdict = "GREEN" | "ORANGE" | "RED";

export type PhantomWarningLevel = "BLOCK" | "WARN" | "ALLOW";

export type PublicScoreResponse = {
  mint: string;
  symbol?: string;
  name?: string;
  score: number;
  verdict: PublicVerdict;
  phantom_warning_level: PhantomWarningLevel;
  phantom_disclaimer: string;
  signals: PublicSignal[];
  sources: string[];
  cached: boolean;
  timestamp: string;
  api_version: "v1";
  website?: string | null;
  pairAgeDays?: number | null;
  liquidityUsd?: number | null;
  topHolderPct?: number | null;
  /**
   * D'ou vient `topHolderPct`, ou pourquoi il manque. `topHolderPct: null`
   * seul ne permettait pas de distinguer « concentration faible » de
   * « concentration inconnue » — et la source historique
   * (public-api.solscan.io) rendait 404, donc null, en permanence.
   */
  topHolderSource?: "helius" | "solana_public_rpc" | null;
  topHolderUnavailableReason?: string | null;
  mintAuthority?: boolean | null;
  freezeAuthority?: boolean | null;
  communityScans?: number | null;
};

/**
 * BUILD 12 · S2 — la phrase publique dérive de la PROJECTION CANONIQUE.
 *
 * `derivePhantomWarning` ne porte plus de table à elle. Elle traduit une
 * `PreBuyProjection` — donc un verdict ET un état de mesure — vers le
 * vocabulaire public. Il n'y a plus deux endroits où l'on décide.
 */
export function phantomFromProjection(p: PreBuyProjection): {
  level: PhantomWarningLevel;
  disclaimer: string;
} {
  if (p.level === "BLOCK") {
    return {
      level: "BLOCK",
      disclaimer: "This token has critical risk signals. Swapping is strongly discouraged.",
    };
  }
  if (p.level === "ALLOW") {
    return { level: "ALLOW", disclaimer: `${REASSURANCE}.` };
  }

  // WARN. La CAUSE est dite, parce que les trois causes ne demandent pas la
  // même chose au lecteur — les confondre serait mentir sur ce qu'on sait.
  //
  // L'ORDRE compte, et il a été corrigé : un risque MESURÉ (WAIT / VERIFY)
  // l'emporte sur l'identité. Tester l'identité d'abord faisait ressortir un
  // ORANGE mesuré avec le libellé « adresse non résolue » — un avertissement
  // exact au niveau, et faux sur sa cause.
  if (p.because === "WAIT" || p.because === "VERIFY") {
    return {
      level: "WARN",
      disclaimer: "This token shows elevated risk. Proceed with caution.",
    };
  }
  if (!p.identityResolved) {
    return {
      level: "WARN",
      disclaimer:
        "This address could not be resolved to a known token by any of our sources. " +
        "Treat this as unidentified, not as safe.",
    };
  }
  return {
    level: "WARN",
    disclaimer:
      "No critical signal was returned, but part of the expected checks did not complete. " +
      "Treat this as unverified, not as safe.",
  };
}

/**
 * Couverture des mesures ATTENDUES derrière un verdict, au sens BUILD 11.1.
 */
export type PhantomMeasurementSupport = {
  expected: number;
  expectedMeasured: number;
};

/**
 * ADAPTATEUR de compatibilité, pour les appelants qui n'ont qu'un verdict
 * legacy en main. Il CONSTRUIT une décision canonique minimale et délègue —
 * il ne rejoue aucune table.
 *
 * Sans `support`, l'identité n'est pas attestée et le contrat de mesure n'est
 * pas établi : le résultat est donc conservateur par construction.
 */
export function derivePhantomWarning(
  verdict: PublicVerdict,
  support?: PhantomMeasurementSupport
): {
  level: PhantomWarningLevel;
  disclaimer: string;
} {
  const measurement = {
    expected: support?.expected ?? 0,
    expectedMeasured: support?.expectedMeasured ?? 0,
    missing: [],
  };
  const decision = canonicalPreBuyDecision({
    reflexVerdict:
      verdict === "RED" ? "STOP" : verdict === "ORANGE" ? "VERIFY" : "NO_CRITICAL_SIGNAL",
    score: null,
    measurement,
    // Un appelant qui fournit une couverture attendue complète a, de fait,
    // mesuré la cible ; sans couverture, rien n'atteste l'identité.
    identity: contratSatisfait(measurement)
      ? { resolved: true, authorities: ["casefile"] }
      : { resolved: false, reason: "NO_AUTHORITY" },
  });
  const p = phantomFromProjection(projectPreBuy(decision));

  // Compatibilité v1 : sans information de mesure, le niveau reste ALLOW —
  // le contrat public ne sait pas exprimer « je n'ai pas conclu ». La phrase,
  // elle, ne ment pas : elle dit que la complétude n'est pas établie.
  if (support === undefined && verdict === "GREEN") {
    return {
      level: "ALLOW",
      disclaimer:
        "No critical signal was returned. The completeness of the checks behind this result " +
        "is not established — this is not a confirmation that the token is safe.",
    };
  }
  return p;
}

export type PublicErrorResponse = {
  error: "invalid_mint" | "token_not_found" | "rate_limit_exceeded" | "internal_error";
  message?: string;
  retry_after?: number;
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

export function isValidMint(mint: string): boolean {
  return BASE58_RE.test(mint);
}

export function isValidEvmAddress(addr: string): boolean {
  return EVM_RE.test(addr);
}

/** Accept either a SOL base58 mint or an EVM 0x address. */
export function isValidScoreTarget(s: string): boolean {
  return isValidMint(s) || isValidEvmAddress(s);
}

/** Map TigerDriver severity (lowercase) to public API severity (uppercase) */
export function mapSeverity(s: string): SignalSeverity {
  switch (s) {
    case "critical": return "CRITICAL";
    case "high":     return "HIGH";
    case "med":      return "MEDIUM";
    case "low":      return "LOW";
    default:         return "LOW";
  }
}
