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
 * Couverture des mesures ATTENDUES derrière un verdict, au sens BUILD 11.1 :
 * `expected` est le dénominateur contractuel, `expectedMeasured` le nombre de
 * ces mesures qui ont réellement abouti. Les capacités hors contrat ne sont
 * comptées ni au numérateur ni au dénominateur.
 */
export type PhantomMeasurementSupport = {
  expected: number;
  expectedMeasured: number;
};

/**
 * BUILD 12 · P0 — « No major risk signals detected. » n'est plus émise en
 * fonction du seul verdict.
 *
 * GREEN ne dit pas « rien trouvé », il dit « rien AU-DESSUS DU SEUIL parmi ce
 * qui a pu être regardé ». Tant que le point de consommation ne sait pas ce qui
 * a été regardé, il ne peut pas soutenir la phrase rassurante : le défaut est
 * l'absence de la mesure au point de consommation, pas sa présence supposée.
 *
 * `support` est OPTIONNEL et les appelants actuels ne le fournissent pas —
 * ils tombent donc dans le cas non soutenu, qui est le cas conservateur.
 * Le niveau reste `ALLOW` sans information de mesure : c'est de la
 * COMPATIBILITÉ, le contrat v1 ne sait pas exprimer « je n'ai pas conclu ».
 * La gouvernance du niveau lui-même appartient à la projection REFLEX (S2→S5).
 */
export function derivePhantomWarning(
  verdict: PublicVerdict,
  support?: PhantomMeasurementSupport
): {
  level: PhantomWarningLevel;
  disclaimer: string;
} {
  switch (verdict) {
    case "RED":
      return {
        level: "BLOCK",
        disclaimer: "This token has critical risk signals. Swapping is strongly discouraged.",
      };
    case "ORANGE":
      return {
        level: "WARN",
        disclaimer: "This token shows elevated risk. Proceed with caution.",
      };
    case "GREEN": {
      // Suffisante = toutes les mesures attendues ont abouti, et il y en avait.
      // `expected === 0` n'est pas une couverture parfaite : c'est l'absence de
      // contrat, donc rien à quoi adosser la phrase.
      const suffisante =
        support !== undefined &&
        support.expected > 0 &&
        support.expectedMeasured >= support.expected;

      if (suffisante) {
        return {
          level: "ALLOW",
          disclaimer: "No major risk signals detected.",
        };
      }

      if (support !== undefined) {
        // L'appelant SAIT que sa couverture est incomplète et le dit.
        return {
          level: "WARN",
          disclaimer:
            "No critical signal was returned, but part of the expected checks did not complete. " +
            "Treat this as unverified, not as safe.",
        };
      }

      // Aucune information de mesure : on n'affirme rien sur la couverture.
      return {
        level: "ALLOW",
        disclaimer:
          "No critical signal was returned. The completeness of the checks behind this result " +
          "is not established — this is not a confirmation that the token is safe.",
      };
    }
  }
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
