/**
 * src/lib/osint/vision/multiToken.test.ts
 *
 * SPRINT cc-offline-47 — Extraction MULTI-TOKEN + second plan.
 *
 * Prouve, sur mock vision + mock Helius (aucun appel prod), que :
 *   1. une capture multi-token produit UN claim par token, chacun marqué par sa ZONE
 *      (primary/sidebar/embedded/reply) et sa PRIORITÉ dérivée (primary=high, reste=low) ;
 *   2. une CA de second plan (sidebar) passe le MÊME triple verrou qu'une CA primary
 *      — résolue si le mint existe, PENDING si not_found ; pas de traitement au rabais ;
 *   3. un ticker de bio SANS CA est extrait (zone sidebar, low) et tombe PENDING CA_ABSENT,
 *      ni jeté ni sur-valorisé ;
 *   4. RÉGRESSION : une capture mono-token (le sujet seul, sans champ zone) se comporte
 *      exactement comme avant → 1 claim primary/high ;
 *   5. INVARIANT : aucun claim low-priority ne peut auto-committer une assertion ni
 *      devenir public, MÊME à trustTier admin.
 */
import { describe, it, expect } from "vitest";
import { mergeConsensus } from "./callVision";
import { resolveVisionTokens } from "./resolveTokens";
import { classifyClaim } from "../decision/classifyExtraction";
import type { ClaimUnderReview, ClaimSignals } from "../decision/classifyExtraction";
import { buildReviewablePlan } from "../retail/buildReviewablePlan";
import type { BuildReviewablePlanInput } from "../retail/buildReviewablePlan";
import { processSubmission } from "../decision/processSubmission";
import type { SubmissionStore } from "../decision/processSubmission";
import type { PriorSubmissionLite } from "../decision/poisoningMonitor";
import type { VisionOutput, VisionToken } from "./visionPrompt";
import type { MintVerification, VerifyMintFn } from "./verifyMintOnChain";
import type { ProvenanceRecord } from "../contracts";
import {
  ExtractionDecision,
  ClaimStatus,
  PendingReason,
  SubmissionStatus,
  SourceTrustTier,
} from "../contracts";

// ── CAs valides (validateCA vert) ────────────────────────────────────────────
const TOES_CA = "6ehEcTMCc85aNF4x9CWx8HuvWGhxQtvKdhKVf2HDpump"; // symbol TOES (primary)
const SOBAT_CA = "SoBaT7GkQ8vWm3nZ5rYxPjDdFhLcKbUeAaVfMpqRsxyz"; // symbol SOBAT (sidebar)

// ── mock Helius : exists+symbol pour les CAs connues, not_found sinon ─────────
function mkVerify(map: Record<string, string>): VerifyMintFn {
  return async (mint: string): Promise<MintVerification> => {
    const sym = map[mint];
    return sym
      ? { status: "exists", symbol: sym, name: null }
      : { status: "not_found", symbol: null, name: null };
  };
}
const verifyBoth = mkVerify({ [TOES_CA]: "TOES", [SOBAT_CA]: "SOBAT" });

// ── constructeurs vision ─────────────────────────────────────────────────────
function tok(p: Partial<VisionToken>): VisionToken {
  return {
    tokenSymbol: "TOES",
    tokenSymbolConfidence: "high",
    contractAddress: null,
    contractAddressConfidence: "high",
    // self-report du modèle = "lu avec certitude" (hint loggé ; jamais autorité seule).
    // Propagé en caCertainHint via mergeConsensus → nécessaire à evidenceOK côté classify.
    contractAddressCertain: true,
    chain: "solana",
    chainConfidence: "high",
    perf: null,
    ...p,
  };
}
function pass(tokens: VisionToken[], kolHandle = "bkokoski"): VisionOutput {
  return {
    kolHandle,
    kolHandleConfidence: "high",
    snapshotType: "osint_x_search",
    tokens,
    readWithCertainty: [],
    uncertain: [],
    notes: null,
  };
}

// La capture réelle : $TOES sujet (primary+CA) ; $SOBAT colonne latérale (sidebar+CA) ;
// $WIZARD mentionné en bio sans CA (sidebar, low, pas de contrat).
function multiTokenVision(): VisionOutput {
  const tokens = (): VisionToken[] => [
    tok({ tokenSymbol: "TOES", contractAddress: TOES_CA, zone: "primary" }),
    tok({ tokenSymbol: "SOBAT", contractAddress: SOBAT_CA, zone: "sidebar" }),
    tok({ tokenSymbol: "WIZARD", contractAddress: null, chain: "unknown", zone: "sidebar" }),
  ];
  return mergeConsensus(pass(tokens()), pass(tokens()), null);
}

function mkPlanInput(vision: VisionOutput, resolutions: Awaited<ReturnType<typeof resolveVisionTokens>>): BuildReviewablePlanInput {
  return {
    vision,
    resolutions,
    imageSha256: "a".repeat(64),
    perceptualHash: null,
    modelVersion: "claude-sonnet-4-5",
    promptVersion: "vision_v1",
    submitter: "iphash_x",
    ingestedAt: "2026-07-05T00:00:00.000Z",
    sourceType: "osint_retail_screenshot",
    capturedAt: null,
    fileName: "shot.png",
    bytes: 1234,
  };
}

// ── mock store in-memory (shadow) ────────────────────────────────────────────
interface Calls {
  evidence: Array<{ isPublic: boolean; reviewStatus: string }>;
  links: Array<{ visibility: string; reviewStatus: string; kolHandle: string; tokenSymbol: string | null }>;
  submissions: Array<{ status: SubmissionStatus; claimsCount: number }>;
}
function memStore(opts: { priors?: PriorSubmissionLite[] } = {}) {
  const calls: Calls = { evidence: [], links: [], submissions: [] };
  const store: SubmissionStore = {
    findByImageSha256: async () => null,
    listRecentForPoisoning: async () => opts.priors ?? [],
    insertEvidenceShadow: async (i) => { calls.evidence.push(i as never); return { id: "ev1" }; },
    upsertLinkDraft: async (i) => { calls.links.push(i as never); return { id: "lk" + (calls.links.length + 1) }; },
    insertSubmission: async (i) => { calls.submissions.push(i as never); return { id: "sub1" }; },
  };
  return { store, calls };
}

// ── claim direct (pour classifyClaim unitaire) ───────────────────────────────
const ALL_OK: ClaimSignals = {
  caState: "present",
  consensusAgree: true,
  mintStatus: "exists",
  tickerMatch: "match",
  chainKnown: true,
  imageExploitable: true,
  suspectImage: false,
  isDuplicate: false,
};
function claim(over: Partial<ClaimUnderReview> = {}, sig: Partial<ClaimSignals> = {}): ClaimUnderReview {
  return {
    tokenSymbol: "SOBAT",
    tokenSymbolConfidence: "high",
    contractAddress: SOBAT_CA,
    contractAddressConfidence: "high",
    contractAddressCertain: true,
    chain: "solana",
    chainConfidence: "high",
    perf: null,
    kolHandle: "bkokoski",
    kolHandleConfidence: "high",
    zone: "primary",
    decision: { decision: ExtractionDecision.PENDING, reason: "seed" },
    claimStatus: ClaimStatus.UNVERIFIED_SUBMISSION,
    signals: { ...ALL_OK, ...sig },
    ...over,
  };
}

describe("MULTI-TOKEN — extraction de tous les tokens, marqués par zone", () => {
  it("capture multi-token → 3 claims, zones + priorités correctes", async () => {
    const vision = multiTokenVision();
    const resolutions = await resolveVisionTokens(vision, { verifyMint: verifyBoth });
    expect(resolutions).toHaveLength(3);

    const byTicker = Object.fromEntries(resolutions.map((r) => [r.tokenSymbol, r]));
    // zones portées intactes à travers les 3 locks
    expect(byTicker["TOES"].zone).toBe("primary");
    expect(byTicker["SOBAT"].zone).toBe("sidebar");
    expect(byTicker["WIZARD"].zone).toBe("sidebar");
    // le sujet ET le second plan avec CA résolvent ; le ticker sans CA reste PENDING
    expect(byTicker["TOES"].resolved).toBe(true);
    expect(byTicker["SOBAT"].resolved).toBe(true);
    expect(byTicker["WIZARD"].resolved).toBe(false);

    const plan = buildReviewablePlan(mkPlanInput(vision, resolutions));
    expect(plan.claims).toHaveLength(3);
    const c = Object.fromEntries(plan.claims.map((x) => [x.tokenSymbol, x]));
    expect(c["TOES"].zone).toBe("primary");
    expect(c["TOES"].priority).toBe("high");
    expect(c["SOBAT"].zone).toBe("sidebar");
    expect(c["SOBAT"].priority).toBe("low");
    expect(c["WIZARD"].zone).toBe("sidebar");
    expect(c["WIZARD"].priority).toBe("low");
  });

  it("CA sidebar → MÊME triple verrou : mint exists → resolved", async () => {
    const vision = mergeConsensus(
      pass([tok({ tokenSymbol: "SOBAT", contractAddress: SOBAT_CA, zone: "sidebar" })]),
      pass([tok({ tokenSymbol: "SOBAT", contractAddress: SOBAT_CA, zone: "sidebar" })]),
      null,
    );
    const [r] = await resolveVisionTokens(vision, { verifyMint: verifyBoth });
    expect(r.zone).toBe("sidebar");
    expect(r.resolved).toBe(true);
    expect(r.contractAddress).toBe(SOBAT_CA);
    expect(r.resolutionPath).toBe("double_vision:ok|onchain:ok|ticker:ok");
  });

  it("CA sidebar → MÊME triple verrou : mint not_found → PENDING (pas au rabais)", async () => {
    const vision = mergeConsensus(
      pass([tok({ tokenSymbol: "SOBAT", contractAddress: SOBAT_CA, zone: "sidebar" })]),
      pass([tok({ tokenSymbol: "SOBAT", contractAddress: SOBAT_CA, zone: "sidebar" })]),
      null,
    );
    const [r] = await resolveVisionTokens(vision, { verifyMint: mkVerify({}) }); // rien on-chain
    expect(r.zone).toBe("sidebar");
    expect(r.resolved).toBe(false);
    expect(r.resolutionPath).toBe("onchain:not_found");
    expect(r.contractAddress).toBe("PENDING:SOBAT");
  });

  it("ticker bio sans CA → PENDING CA_ABSENT, zone sidebar, low priority", async () => {
    const vision = mergeConsensus(
      pass([tok({ tokenSymbol: "WIZARD", contractAddress: null, chain: "unknown", zone: "sidebar" })]),
      pass([tok({ tokenSymbol: "WIZARD", contractAddress: null, chain: "unknown", zone: "sidebar" })]),
      null,
    );
    const resolutions = await resolveVisionTokens(vision, { verifyMint: verifyBoth });
    const plan = buildReviewablePlan(mkPlanInput(vision, resolutions));
    const w = plan.claims[0];
    expect(w.tokenSymbol).toBe("WIZARD");
    expect(w.zone).toBe("sidebar");
    expect(w.priority).toBe("low");
    expect(w.contractAddress).toBeNull();
    // classifyClaim : extrait mais non résolu → PENDING CA_ABSENT, unverified
    const under: ClaimUnderReview = { ...w, signals: { ...ALL_OK, caState: "absent", mintStatus: "not_checked", tickerMatch: "not_checked", chainKnown: false } };
    const d = classifyClaim(under, PROV_ADMIN, SourceTrustTier.ADMIN);
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.CA_ABSENT);
    expect(d.claimStatus).toBe(ClaimStatus.UNVERIFIED_SUBMISSION);
  });

  it("RÉGRESSION : capture mono-token (sujet seul, sans champ zone) → 1 claim primary/high, comportement identique", async () => {
    // token SANS zone → normZone défaut 'primary' → legacy strictement préservé
    const vision = mergeConsensus(
      pass([tok({ tokenSymbol: "TOES", contractAddress: TOES_CA })]),
      pass([tok({ tokenSymbol: "TOES", contractAddress: TOES_CA })]),
      null,
    );
    const resolutions = await resolveVisionTokens(vision, { verifyMint: verifyBoth });
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].zone).toBe("primary");
    expect(resolutions[0].resolved).toBe(true);

    const plan = buildReviewablePlan(mkPlanInput(vision, resolutions));
    expect(plan.claims).toHaveLength(1);
    expect(plan.claims[0].zone).toBe("primary");
    expect(plan.claims[0].priority).toBe("high");

    // à trust investigator, le sujet primary auto-commit l'assertion comme avant
    const under: ClaimUnderReview = { ...plan.claims[0], signals: { ...ALL_OK } };
    const d = classifyClaim(under, {
      imageSha256: "a".repeat(64), perceptualHash: null, promptVersion: "v", modelVersion: "m",
      rawVisionPass1: {}, rawVisionPass2: null, decisionReasons: [], ingestedAt: "2026-07-05T00:00:00.000Z",
      sourceType: "s", trustTier: SourceTrustTier.INVESTIGATOR, submitter: "x",
    }, SourceTrustTier.INVESTIGATOR);
    expect(d.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_ASSERTION);
    expect(d.assertion.autoCommit).toBe(true);
  });

  it("INVARIANT : claim low-priority (sidebar) ne peut JAMAIS auto-committer d'assertion, même à ADMIN", () => {
    // même signaux all-OK + attribution forte que le primary ; seule la zone diffère
    const primary = classifyClaim(claim({ zone: "primary" }), PROV_ADMIN, SourceTrustTier.ADMIN);
    const sidebar = classifyClaim(claim({ zone: "sidebar" }), PROV_ADMIN, SourceTrustTier.ADMIN);

    // le sujet, lui, auto-commit l'assertion à ADMIN
    expect(primary.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_ASSERTION);
    expect(primary.assertion.autoCommit).toBe(true);

    // le second plan : au mieux evidence shadow, assertion bloquée DUR
    expect(sidebar.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(sidebar.claimStatus).toBe(ClaimStatus.ONCHAIN_VERIFIED_ONLY);
    expect(sidebar.assertion.autoCommit).toBe(false);
    expect(sidebar.assertion.status).toBe("blocked");
  });

  it("INVARIANT bout-en-bout : multi-token à ADMIN → link SEULEMENT pour le primary, rien de public", async () => {
    const vision = multiTokenVision();
    const resolutions = await resolveVisionTokens(vision, { verifyMint: verifyBoth });
    const plan = buildReviewablePlan(mkPlanInput(vision, resolutions));
    const { store, calls } = memStore();
    const res = await processSubmission(plan, SourceTrustTier.ADMIN, { store, verifyMint: verifyBoth });

    expect(res.claims).toHaveLength(3);
    const cr = Object.fromEntries(res.claims.map((c) => [c.tokenSymbol, c]));
    // primary → assertion + lien
    expect(cr["TOES"].decision).toBe(ExtractionDecision.AUTO_COMMIT_ASSERTION);
    expect(cr["TOES"].linkWritten).toBe(true);
    // sidebar résolu → evidence shadow, PAS de lien
    expect(cr["SOBAT"].decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(cr["SOBAT"].linkWritten).toBe(false);
    // bio sans CA → PENDING
    expect(cr["WIZARD"].decision).toBe(ExtractionDecision.PENDING);
    expect(cr["WIZARD"].linkWritten).toBe(false);

    // UN SEUL lien écrit (le primary), en draft/pending — jamais public
    expect(calls.links).toHaveLength(1);
    expect(calls.links[0].tokenSymbol).toBe("TOES");
    for (const l of calls.links) {
      expect(l.visibility).toBe("draft");
      expect(l.visibility).not.toBe("public");
    }
    // evidence shadow uniquement : jamais public
    for (const e of calls.evidence) expect(e.isPublic).toBe(false);
    expect(res.status).toBe(SubmissionStatus.AUTO_COMMITTED_SHADOW);
  });
});

const PROV_ADMIN: ProvenanceRecord = {
  imageSha256: "a".repeat(64),
  perceptualHash: null,
  promptVersion: "vision_v1",
  modelVersion: "claude-sonnet-4-5",
  rawVisionPass1: {},
  rawVisionPass2: null,
  decisionReasons: [],
  ingestedAt: "2026-07-05T00:00:00.000Z",
  sourceType: "osint_screenshot",
  trustTier: SourceTrustTier.ADMIN,
  submitter: "iphash_x",
};
