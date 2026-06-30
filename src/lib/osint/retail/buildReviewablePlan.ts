/**
 * src/lib/osint/retail/buildReviewablePlan.ts
 *
 * SPRINT C1 — Pont vision → cerveau A. Convertit une sortie vision (VisionOutput
 * + résolutions 3-locks) en ReviewablePlan (contrats A0) consommable par
 * processSubmission. C'est l'étage qui permet au processeur retail async de
 * réutiliser le cerveau A tel quel — AUCUN nouveau chemin de décision.
 *
 * Le `decision`/`claimStatus` initial de chaque claim est un PLACEHOLDER
 * (unverified) : classifyClaim recalcule tout. On préserve en revanche la finesse
 * du caState (absent vs pending) via signals, pour que le PendingReason humain
 * soit juste (CA_ABSENT vs CA_PARTIAL).
 */

import {
  ExtractionDecision,
  ClaimStatus,
  SourceTrustTier,
} from "../contracts";
import type {
  ExtractedClaim,
  Confidence,
  VisionChain,
} from "../contracts";
import { isPending } from "../vision/validateCA";
import type { VisionOutput } from "../vision/visionPrompt";
import type { TokenResolution } from "../vision/resolveTokens";
import type { ReviewablePlan, ReviewableClaim } from "../decision";

export interface BuildReviewablePlanInput {
  vision: VisionOutput;
  resolutions: TokenResolution[];
  imageSha256: string;
  perceptualHash: string | null;
  modelVersion: string;
  promptVersion: string;
  submitter: string;        // IP-hash
  ingestedAt: string;       // ISO
  sourceType: string;       // ex 'osint_retail_screenshot'
  capturedAt: string | null;
  fileName: string;
  bytes: number;
  tweetUrl?: string | null;
  contextNote?: string | null;
}

function toVisionChain(raw: string | null | undefined): VisionChain {
  const c = (raw ?? "unknown").toLowerCase();
  return c === "solana" || c === "ethereum" ? c : "unknown";
}

function sanitizeHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  const clean = h.replace(/^@/, "").trim().toLowerCase();
  return /^[a-z0-9_]{1,50}$/.test(clean) ? clean : null;
}

/** Convertit en ReviewablePlan. trustTier n'est PAS posé ici (passé à processSubmission). */
export function buildReviewablePlan(input: BuildReviewablePlanInput): ReviewablePlan {
  const { vision, resolutions } = input;
  const kolHandle = sanitizeHandle(vision.kolHandle);
  const tokens = vision.tokens ?? [];

  const claims: ReviewableClaim[] = resolutions.map((r) => {
    // Retrouve le token vision correspondant (par ticker normalisé) pour les confiances.
    const tk = tokens.find(
      (t) => (t.tokenSymbol ?? "").replace(/^\$/, "").trim().toLowerCase() === (r.tokenSymbol ?? "").toLowerCase(),
    );
    const resolvedCA = r.resolved && !isPending(r.contractAddress) ? r.contractAddress : null;
    const hadCaRead = !!(r.audit.caReads[0] || r.audit.caReads[1]);

    const base: ExtractedClaim = {
      tokenSymbol: r.tokenSymbol,
      tokenSymbolConfidence: (tk?.tokenSymbolConfidence ?? "low") as Confidence,
      contractAddress: resolvedCA,
      contractAddressConfidence: (tk?.contractAddressConfidence ?? "low") as Confidence,
      contractAddressCertain: r.audit.caCertainHint,
      chain: toVisionChain(r.chain),
      chainConfidence: (tk?.chainConfidence ?? "low") as Confidence,
      perf: tk?.perf ?? null,
      kolHandle,
      kolHandleConfidence: vision.kolHandleConfidence,
      // Placeholders : classifyClaim recalcule.
      decision: { decision: ExtractionDecision.PENDING, reason: "placeholder — recomputed by classifyClaim" },
      claimStatus: ClaimStatus.UNVERIFIED_SUBMISSION,
    };

    // Finesse caState : CA lu mais non résolu → 'pending' (CA_PARTIAL), sinon hérité.
    const claim: ReviewableClaim = { ...base };
    if (!resolvedCA && hadCaRead) {
      claim.signals = { caState: "pending" };
    }
    return claim;
  });

  return {
    provenance: {
      imageSha256: input.imageSha256,
      perceptualHash: input.perceptualHash,
      promptVersion: input.promptVersion,
      modelVersion: input.modelVersion,
      rawVisionPass1: vision.diagnostics ?? vision,
      rawVisionPass2: vision.diagnostics?.tokens ?? null,
      decisionReasons: [
        ...(input.tweetUrl ? [`retail_tweet_url:${input.tweetUrl}`] : []),
        ...(input.contextNote ? [`retail_context:${input.contextNote.slice(0, 200)}`] : []),
      ],
      ingestedAt: input.ingestedAt,
      sourceType: input.sourceType,
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      submitter: input.submitter,
    },
    claims,
    captureMeta: {
      fileName: input.fileName,
      bytes: input.bytes,
      width: null,
      height: null,
      capturedAt: input.capturedAt,
      timezoneAssumption: "Asia/Makassar (UTC+08:00)",
      sessionId: null,
    },
  };
}
