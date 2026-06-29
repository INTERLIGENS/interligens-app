/**
 * src/lib/osint/decision/classifyExtraction.ts
 *
 * SPRINT A — Le cerveau : décision automatique PAR CLAIM (pas de verdict global
 * d'une capture). Fonction PURE, zéro IO : tout signal externe (mint on-chain,
 * consensus 2-passes, match ticker, doublon) est passé via `claim.signals`,
 * calculé en amont par l'orchestrateur (processSubmission).
 *
 * DOCTRINE (plan v2) :
 *   - Token validity ≠ claim validity. Un mint réel ne prouve pas un call réel.
 *   - AUTO_COMMIT_EVIDENCE = « l'image contient cette CA, vérifiée on-chain » →
 *     auto en shadow. C'est un fait sur la CA, pas sur le KOL.
 *   - AUTO_COMMIT_ASSERTION = « ce KOL a promu ce token » → JAMAIS auto pour du
 *     retail anonyme. Exige attribution solide ET trustTier ≥ investigator.
 *   - Tout shadow, jamais auto-public.
 *
 * La décision est un ET BOOLÉEN STRICT (pas le score). Le score composite (0-100)
 * est purement EXPLICATIF (audit/monitoring) — il n'entre dans aucune branche.
 *
 * Réutilise STRICTEMENT la taxonomie A0 (src/lib/osint/contracts) : aucun statut
 * réinventé.
 */

import {
  ExtractionDecision,
  ClaimStatus,
  PendingReason,
  RejectReason,
  SourceTrustTier,
  SOURCE_TRUST_WEIGHT,
} from "../contracts";
import type {
  ExtractedClaim,
  ExtractionDecisionRecord,
  ProvenanceRecord,
} from "../contracts";

// ── Signals : ce que l'orchestrateur a vérifié AVANT de classer ──────────────

/** État de lisibilité / résolution de la contract address lue. */
export type CaState = "present" | "absent" | "partial" | "pending";
/** Résultat du check d'existence du mint (cf. verifyMintOnChain MintStatus). */
export type MintSignal = "exists" | "not_found" | "unavailable" | "not_checked";
/** Comparaison ticker lu ↔ symbol on-chain. */
export type TickerSignal = "match" | "mismatch" | "no_metadata" | "not_checked";

/**
 * Signaux externes attachés à un claim. `consensusAgree` vient du verrou 1
 * (double lecture vision) ; `mintStatus`/`tickerMatch` du verrou 2/3 (Helius) ;
 * `isDuplicate` est l'écho claim-level d'une soumission déjà ingérée.
 */
export interface ClaimSignals {
  caState: CaState;
  consensusAgree: boolean;
  mintStatus: MintSignal;
  tickerMatch: TickerSignal;
  chainKnown: boolean;
  imageExploitable: boolean;
  suspectImage: boolean;
  isDuplicate: boolean;
}

/** Un claim A0 enrichi des signaux vérifiés. */
export interface ClaimUnderReview extends ExtractedClaim {
  signals: ClaimSignals;
}

/** Sous-décision relative au LIEN KOL↔token (assertion), distincte de l'evidence. */
export interface AssertionOutcome {
  /** true ⇒ matérialiser un KolTokenLink draft (shadow). Jamais public. */
  autoCommit: boolean;
  status: "auto_shadow" | "pending" | "blocked" | "n/a";
  reason: string;
  pendingReason?: PendingReason;
}

export interface ScoreFactor {
  factor: string;
  points: number;
  max: number;
}

/** Décision complète d'un claim : verdict A0 + assertion + score explicatif. */
export interface ClaimDecision {
  /** Verdict primaire — STRICTEMENT un des 4 ExtractionDecision A0. */
  decision: ExtractionDecisionRecord;
  /** Palier de vérification atteint (taxonomie A0). */
  claimStatus: ClaimStatus;
  /** Sort du lien KOL↔token (peut être PENDING même si l'evidence est commitée). */
  assertion: AssertionOutcome;
  /** Score composite 0-100 — EXPLICATIF uniquement, ne décide rien. */
  score: number;
  scoreBreakdown: ScoreFactor[];
  /** Raisons détaillées (audit/monitoring). */
  reasons: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const INVESTIGATOR_WEIGHT = SOURCE_TRUST_WEIGHT[SourceTrustTier.INVESTIGATOR];

function isLowConfidence(claim: ExtractedClaim): boolean {
  return (
    claim.tokenSymbolConfidence === "low" ||
    claim.contractAddressConfidence === "low" ||
    claim.chainConfidence === "low"
  );
}

function strongAttribution(claim: ExtractedClaim): boolean {
  // Un lien KOL↔token n'est « solide » que si le handle est lu de l'image avec
  // haute confiance. Un handle null, ou medium/low, ne suffit jamais.
  return !!claim.kolHandle && claim.kolHandleConfidence === "high";
}

// ── Score composite (explicatif) ─────────────────────────────────────────────

function computeScore(
  claim: ClaimUnderReview,
  trustTier: SourceTrustTier,
): { score: number; breakdown: ScoreFactor[] } {
  const s = claim.signals;
  const b: ScoreFactor[] = [
    { factor: "ca_present_certain", points: s.caState === "present" && claim.contractAddressCertain ? 15 : 0, max: 15 },
    { factor: "consensus_2pass", points: s.consensusAgree ? 15 : 0, max: 15 },
    { factor: "mint_exists", points: s.mintStatus === "exists" ? 20 : 0, max: 20 },
    { factor: "ticker_match", points: s.tickerMatch === "match" ? 15 : 0, max: 15 },
    { factor: "chain_known", points: s.chainKnown && s.caState !== "absent" ? 10 : 0, max: 10 },
    { factor: "image_clean", points: s.imageExploitable && !s.suspectImage ? 10 : 0, max: 10 },
    { factor: "attribution", points: strongAttribution(claim) ? 10 : 0, max: 10 },
    {
      factor: "provenance_trust",
      points: Math.round((SOURCE_TRUST_WEIGHT[trustTier] / SOURCE_TRUST_WEIGHT[SourceTrustTier.ADMIN]) * 5),
      max: 5,
    },
  ];
  const score = b.reduce((a, f) => a + f.points, 0);
  return { score, breakdown: b };
}

// ── La décision ──────────────────────────────────────────────────────────────

/**
 * classifyClaim — applique, DANS L'ORDRE : (a) REJECT, (b) PENDING, (c)
 * AUTO_COMMIT_EVIDENCE, (d) AUTO_COMMIT_ASSERTION. Le passage en evidence est un
 * ET booléen strict ; l'assertion ajoute attribution + trustTier ≥ investigator.
 */
export function classifyClaim(
  claim: ClaimUnderReview,
  _provenance: ProvenanceRecord,
  trustTier: SourceTrustTier,
): ClaimDecision {
  const s = claim.signals;
  const reasons: string[] = [];
  const { score, breakdown } = computeScore(claim, trustTier);

  const finish = (
    decision: ExtractionDecisionRecord,
    claimStatus: ClaimStatus,
    assertion: AssertionOutcome,
  ): ClaimDecision => ({ decision, claimStatus, assertion, score, scoreBreakdown: breakdown, reasons });

  const noAssertion: AssertionOutcome = { autoCommit: false, status: "n/a", reason: "no assertion materialized" };

  // ── (a) REJECT : aucun signal exploitable ──────────────────────────────────
  const hasSignal = !!claim.contractAddress || !!claim.tokenSymbol || !!claim.kolHandle || !!claim.perf;
  if (!hasSignal) {
    reasons.push("no exploitable signal: no CA, no ticker, no handle, no call card");
    return finish(
      { decision: ExtractionDecision.REJECT, reason: "empty claim — nothing extractable", rejectReason: RejectReason.NO_SIGNAL },
      ClaimStatus.UNVERIFIED_SUBMISSION,
      noAssertion,
    );
  }

  // ── (b) PENDING : collecte des blocages (ordre de priorité figé) ───────────
  // chaque entrée = [condition, PendingReason, texte audit]
  const pendingChecks: Array<[boolean, PendingReason, string]> = [
    [s.suspectImage, PendingReason.SUSPECT_IMAGE, "screenshot suspecte (montage probable / incohérence)"],
    [s.mintStatus === "not_found", PendingReason.MINT_NOT_FOUND, "mint introuvable on-chain (CA factice)"],
    [s.tickerMatch === "mismatch", PendingReason.TICKER_MISMATCH, "ticker lu ≠ symbol on-chain"],
    [s.caState === "partial", PendingReason.CA_PARTIAL, "CA partielle / tail clippée au bord du screenshot"],
    [s.caState === "absent" || s.caState === "pending", PendingReason.CA_ABSENT, "CA absente ou non résolue (PENDING)"],
    [!s.chainKnown, PendingReason.CHAIN_AMBIGUOUS, "chain indéterminable"],
    [!s.consensusAgree, PendingReason.LOW_CONFIDENCE, "divergence des 2 passes vision (verrou 1)"],
    [s.mintStatus === "unavailable" || s.mintStatus === "not_checked", PendingReason.LOW_CONFIDENCE, "check mint indisponible — ne résout pas"],
    [s.tickerMatch === "no_metadata", PendingReason.LOW_CONFIDENCE, "pas de metadata on-chain pour confirmer le ticker"],
    [isLowConfidence(claim), PendingReason.LOW_CONFIDENCE, "confiance vision basse sur un champ clé"],
    [!s.imageExploitable, PendingReason.LOW_CONFIDENCE, "capture non exploitable"],
  ];
  const blockers = pendingChecks.filter(([cond]) => cond);
  for (const [, , text] of blockers) reasons.push(text);

  // ── (c) AUTO_COMMIT_EVIDENCE : ET booléen STRICT ───────────────────────────
  const evidenceOK =
    !!claim.contractAddress &&
    s.caState === "present" &&
    claim.contractAddressCertain && // hint (verrou 1 self-report) — loggé, pas autorité seule
    s.consensusAgree &&
    s.mintStatus === "exists" &&
    s.tickerMatch === "match" &&
    s.chainKnown &&
    claim.chain !== "unknown" &&
    s.imageExploitable &&
    !s.suspectImage &&
    !s.isDuplicate;

  if (!evidenceOK) {
    if (s.isDuplicate) reasons.push("doublon (sha256 déjà ingéré) — pas de re-commit");
    // primary reason = premier blocage par priorité ; fallback LOW_CONFIDENCE.
    const primary = blockers[0]?.[1] ?? PendingReason.LOW_CONFIDENCE;
    return finish(
      { decision: ExtractionDecision.PENDING, reason: `evidence non auto-committable: ${reasons[0] ?? "signaux insuffisants"}`, pendingReason: primary },
      ClaimStatus.UNVERIFIED_SUBMISSION,
      { autoCommit: false, status: "pending", reason: "claim en revue — assertion non évaluée", pendingReason: PendingReason.ATTRIBUTION },
    );
  }

  reasons.push("evidence: CA présente + certaine + consensus + mint exists + ticker match + chain connue → shadow");

  // ── (d) AUTO_COMMIT_ASSERTION : evidence OK + attribution + trust ≥ investigator
  const attributionSolid = strongAttribution(claim);
  const trustOK = SOURCE_TRUST_WEIGHT[trustTier] >= INVESTIGATOR_WEIGHT;

  if (attributionSolid && trustOK) {
    reasons.push(`assertion: attribution solide + trustTier '${trustTier}' ≥ investigator → lien draft (shadow)`);
    return finish(
      { decision: ExtractionDecision.AUTO_COMMIT_ASSERTION, reason: "evidence + attribution + trust suffisant" },
      ClaimStatus.ATTRIBUTION_VERIFIED,
      { autoCommit: true, status: "auto_shadow", reason: "lien KOL↔token auto-commité en shadow (visibility draft)" },
    );
  }

  // evidence OK mais assertion bloquée → la CA est commitée, le lien NON.
  const why = !trustOK
    ? `trustTier '${trustTier}' < investigator — assertion KOL↔token JAMAIS auto pour retail/anonyme`
    : "attribution insuffisante (handle null ou confiance < high)";
  reasons.push(`assertion BLOQUÉE: ${why} → evidence shadow seule, lien en PENDING (ATTRIBUTION)`);
  return finish(
    { decision: ExtractionDecision.AUTO_COMMIT_EVIDENCE, reason: "CA vérifiée on-chain commitée en shadow ; assertion non autorisée" },
    ClaimStatus.ONCHAIN_VERIFIED_ONLY,
    {
      autoCommit: false,
      status: trustOK ? "pending" : "blocked",
      reason: why,
      pendingReason: PendingReason.ATTRIBUTION,
    },
  );
}
