/**
 * REFLEX V1 — central constants.
 *
 * Every decision threshold, verdict template, and operational toggle lives
 * here so calibration tuning during shadow mode does not require code
 * changes outside this file. All values are validated against the
 * forbidden-words lint (see forbidden-words.test.ts meta-tests).
 */

export const REFLEX_ENGINES_VERSION = "reflex-v1.0.0";

// ─────────────────────────────────────────────────────────────────────────
// Decision thresholds — tunable during shadow calibration
// ─────────────────────────────────────────────────────────────────────────

/** Convergence STOP: minimum global confidence required. */
export const STOP_CONVERGENCE_CONFIDENCE_THRESHOLD = 0.7;

/** Narrative script match: minimum confidence to trigger WAIT on its own. */
export const NARRATIVE_MATCH_WAIT_THRESHOLD = 0.6;

/** NO_CRITICAL_SIGNAL: minimum global confidence required to emit. */
export const GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD = 0.5;

/** Discretization bands for the user-facing confidence label. */
export const GLOBAL_CONFIDENCE_HIGH_THRESHOLD = 0.75;
export const GLOBAL_CONFIDENCE_MEDIUM_THRESHOLD = 0.5;

/** KOL is considered recidivist at >= this many documented prior cases. */
export const RECIDIVIST_MIN_PRIOR_CASES = 2;

/** Convergence STOP also requires >= this many CRITICAL on-chain drivers. */
export const STOP_CONVERGENCE_MIN_CRITICAL_DRIVERS = 2;

/** WAIT via "convergent weak signals" needs at least this many. */
export const WAIT_MIN_CONVERGENT_SIGNALS = 3;

/**
 * TigerScore drivers that are INFORMATIONAL/CONTEXTUAL, not actual risk
 * signals. The REFLEX adapter skips them entirely — they neither appear
 * in the manifest's signals array nor contribute to convergence WAIT.
 *
 * Why each one is here (discovered Day 1 of shadow on 5 real EVM top-cap
 * inputs — USDC ETH, USDT ETH, wBTC, DAI, random EOA):
 *
 *  - evm_contract_interaction : "this address is a contract" — a neutral
 *    structural fact, not a risk. Fires on every token contract.
 *  - evm_dormant_wallet        : "wallet has no ETH balance + low
 *    activity". Token contracts always hold 0 ETH (they hold ERC-20
 *    tokens by mapping, not native ETH), so this drives a guaranteed
 *    false positive on every legitimate token. Also false-positives on
 *    fresh EOAs that haven't transacted yet.
 *  - evm_multi_chain_active    : "address active on multiple EVM chains".
 *    Multi-chain presence is the norm for legitimate tokens (USDC, USDT,
 *    wBTC are all on 5+ chains). Often a *positive* signal, never a risk.
 *  - low_tx_count              : "very low transaction history". On a
 *    token contract, the nonce reflects outgoing contract calls (~0 for
 *    most ERC-20s). On a fresh EOA, nonce=0 is normal. False positive in
 *    both common cases.
 *
 * TigerScore's score numérique is unaffected (these drivers' deltas
 * still apply to the score the engine returns to /api/v1/score). The
 * filter is REFLEX-side only — anti-regression snapshots on the scan
 * routes are preserved.
 *
 * If shadow reveals additional informational drivers (candidates being
 * watched: evm_high_tx_count, volume_very_low), add their ids to this
 * set — no code change beyond the constant.
 */
export const NON_RISK_TIGERSCORE_DRIVER_IDS: ReadonlySet<string> = new Set([
  "evm_contract_interaction",
  "evm_dormant_wallet",
  "evm_multi_chain_active",
  "low_tx_count",
]);

// ─────────────────────────────────────────────────────────────────────────
// Output shaping
// ─────────────────────────────────────────────────────────────────────────

export const MAX_VERDICT_REASONS = 3;
export const MAX_INPUT_LENGTH = 500;
export const WATCH_DEFAULT_TTL_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────
// Verdict wording — spec-fixed, mutating breaks calibration contract
// ─────────────────────────────────────────────────────────────────────────

export const VERDICT_WORDING = {
  STOP: {
    en: "We documented critical risk signals on this asset.",
    fr: "Plusieurs signaux critiques ont été documentés sur cet asset.",
  },
  WAIT: {
    en: "This signal carries hallmarks of retail FOMO manipulation.",
    fr: "Ce signal présente des marqueurs de manipulation de FOMO retail.",
  },
  VERIFY: {
    en: "Claims are present but not verifiable with the sources we audit.",
    fr: "Des claims sont présents mais non vérifiables avec les sources auditées.",
  },
  NO_CRITICAL_SIGNAL: {
    en: "No critical risk signals detected with current sources.",
    fr: "Aucun signal de risque critique détecté avec les sources actuelles.",
  },
} as const;

export const ACTION_WORDING = {
  STOP: {
    en: "Do not buy. Do not connect. Do not sign.",
    fr: "Ne pas acheter. Ne pas connecter. Ne pas signer.",
  },
  WAIT: {
    en: "Waiting 24 hours may reveal what marketing cannot.",
    fr: "Attendre 24 heures peut révéler ce que le marketing cache.",
  },
  VERIFY: {
    en: "Demand verifiable proof before committing capital.",
    fr: "Exige une preuve vérifiable avant d'engager des fonds.",
  },
  NO_CRITICAL_SIGNAL: {
    en: "",
    fr: "",
  },
} as const;

export const DISCLAIMER_NO_SIGNAL = {
  en: "This is not a safety guarantee. Crypto remains hostile by default.",
  fr: "Ce n'est pas une garantie de sécurité. La crypto reste hostile par défaut.",
} as const;

export const MICRO_COPY = {
  subtitleEn: "Before you buy, check if you're being played.",
  subtitleFr: "Avant d'acheter, vérifie si on est en train de te jouer.",
  inputPlaceholderEn: "Paste token, wallet, URL, or X handle",
  inputPlaceholderFr: "Collez un token, wallet, URL ou handle X",
  ctaEn: "REFLEX",
  ctaFr: "REFLEX",
  microCopyEn: "We do not approve assets. We document risk.",
  microCopyFr: "Nous n'approuvons pas d'actifs. Nous documentons les risques.",
  calibrationNoticeEn:
    "REFLEX is in calibration. Public access opens after shadow review.",
  calibrationNoticeFr:
    "REFLEX est en calibration. L'accès public ouvre après la revue shadow.",
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Operational flags (defaults; env vars override at runtime)
// ─────────────────────────────────────────────────────────────────────────

export const REFLEX_PUBLIC_ENABLED_DEFAULT = false;
export const REFLEX_LINT_BLOCK_DEFAULT = true;
