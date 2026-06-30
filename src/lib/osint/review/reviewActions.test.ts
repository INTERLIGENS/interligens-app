/**
 * src/lib/osint/review/reviewActions.test.ts
 * SPRINT B — handlers de review sur store MOCK + verifyMint MOCK. Aucun IO réel.
 *
 * Couvre les invariants du sprint :
 *  - RESOLVE CA valide on-chain → traité, claimStatus monte, reste shadow.
 *  - RESOLVE CA invalide on-chain (not_found / unavailable / malformée) → refusé.
 *  - REJECT → rejeté, evidence conservée (aucune suppression).
 *  - ESCALATE → audit action=ESCALATE (sort de la file standard).
 *  - Audit écrit à CHAQUE action réussie.
 *  - Invariant global : aucune action ne produit public/published.
 */
import { describe, it, expect } from "vitest";
import { resolveItem, rejectItem, escalateItem } from "./reviewActions";
import {
  ReviewAction,
  ReviewItemType,
  type ReviewStore,
  type ReviewItemState,
  type ReviewAuditRecord,
  type ReviewItemRef,
} from "./reviewContracts";
import type { MintVerification } from "../vision/verifyMintOnChain";
import { SubmissionStatus, ClaimStatus } from "../contracts";

const CA_OK = "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump";
const CA_NOTFOUND = "FakeMintNotFound1111111111111111111111111x";
const CA_UNAVAIL  = "UnavaiMintCheck1111111111111111111111111x";

const verifyMint = async (mint: string): Promise<MintVerification> => {
  if (mint === CA_NOTFOUND) return { status: "not_found", symbol: null, name: null };
  if (mint === CA_UNAVAIL) return { status: "unavailable", symbol: null, name: null };
  return { status: "exists", symbol: "TOES", name: "Toes" };
};

interface Recorded {
  subStatus: Array<{ id: string; status: SubmissionStatus }>;
  signalStatus: Array<{ id: string; status: string }>;
  linkStatus: Array<{ id: string; reviewStatus: string }>;
  audits: ReviewAuditRecord[];
}

function memStore(item: ReviewItemState | null) {
  const rec: Recorded = { subStatus: [], signalStatus: [], linkStatus: [], audits: [] };
  const store: ReviewStore = {
    getItem: async () => item,
    setSubmissionStatus: async (id, status) => { rec.subStatus.push({ id, status }); },
    setSignalStatus: async (id, status) => { rec.signalStatus.push({ id, status }); },
    setLinkReviewStatus: async (id, reviewStatus) => { rec.linkStatus.push({ id, reviewStatus }); },
    writeAudit: async (a) => { rec.audits.push(a); },
  };
  return { store, rec };
}

function state(over: Partial<ReviewItemState> = {}): ReviewItemState {
  return {
    ref: { type: ReviewItemType.SUBMISSION, id: "sub1" },
    status: "PENDING_REVIEW",
    visibility: null, isPublic: null,
    kolHandle: "bkokoski", tokenSymbol: "TOES",
    contractAddress: null, chain: "solana",
    ...over,
  };
}

const deps = (store: ReviewStore) => ({ store, verifyMint, actor: "admin", now: () => "2026-06-30T10:00:00.000Z" });
const ref = (type: ReviewItemType = ReviewItemType.SUBMISSION, id = "sub1"): ReviewItemRef => ({ type, id });

/** Helper anti-régression : aucun champ d'audit ne fuit du public. */
function assertNoPublic(audit: ReviewAuditRecord | null | undefined) {
  const blob = JSON.stringify(audit ?? {});
  expect(blob).not.toContain("\"isPublic\":true");
  expect(blob).not.toContain("approved_public");
  expect(blob).not.toContain("published");
  expect(blob).not.toContain("\"visibility\":\"public\"");
}

describe("resolveItem — RESOLVE avec re-vérification on-chain", () => {
  it("CA valide on-chain → RESOLVED_BY_REVIEW, claimStatus monte (source_verified), reste shadow", async () => {
    const { store, rec } = memStore(state());
    const r = await resolveItem(ref(), { contractAddress: CA_OK, chain: "solana", reason: "corrected CA" }, deps(store));

    expect(r.ok).toBe(true);
    expect(r.resultingStatus).toBe(SubmissionStatus.RESOLVED_BY_REVIEW);
    expect(r.claimStatus).toBe(ClaimStatus.SOURCE_VERIFIED);
    expect(r.claimStatus).not.toBe(ClaimStatus.HUMAN_APPROVED); // le seul palier public
    expect(r.mint).toEqual({ status: "exists", symbol: "TOES" });
    expect(rec.subStatus).toEqual([{ id: "sub1", status: SubmissionStatus.RESOLVED_BY_REVIEW }]);
    expect(rec.audits).toHaveLength(1);
    expect(rec.audits[0].action).toBe(ReviewAction.RESOLVE);
    assertNoPublic(r.audit);
  });

  it("CA introuvable on-chain (not_found) → refusé, item reste pending, aucun audit", async () => {
    const { store, rec } = memStore(state());
    const r = await resolveItem(ref(), { contractAddress: CA_NOTFOUND, chain: "solana", reason: "x" }, deps(store));

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not found/i);
    expect(r.resultingStatus).toBe("PENDING_REVIEW"); // inchangé
    expect(rec.subStatus).toHaveLength(0);
    expect(rec.audits).toHaveLength(0);
  });

  it("check on-chain indisponible (unavailable) → refusé (ne résout jamais sur un check raté)", async () => {
    const { store, rec } = memStore(state());
    const r = await resolveItem(ref(), { contractAddress: CA_UNAVAIL, chain: "solana", reason: "x" }, deps(store));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unavailable/i);
    expect(rec.audits).toHaveLength(0);
  });

  it("CA malformée → refusée AVANT tout appel on-chain", async () => {
    const { store, rec } = memStore(state());
    const r = await resolveItem(ref(), { contractAddress: "nope", chain: "solana", reason: "x" }, deps(store));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/malformed/i);
    expect(rec.audits).toHaveLength(0);
  });

  it("RESOLVE d'un KolTokenLink → reste 'draft' / 'pending_review' (jamais public)", async () => {
    const { store, rec } = memStore(state({ ref: ref(ReviewItemType.LINK, "lk1"), status: "pending_review", visibility: "draft" }));
    const r = await resolveItem(ref(ReviewItemType.LINK, "lk1"), { contractAddress: CA_OK, chain: "solana", reason: "ok" }, deps(store));
    expect(r.ok).toBe(true);
    expect(rec.linkStatus).toEqual([{ id: "lk1", reviewStatus: "pending_review" }]);
    expect(rec.linkStatus.some((l) => l.reviewStatus === "approved_public")).toBe(false);
    assertNoPublic(r.audit);
  });
});

describe("rejectItem — REJECT", () => {
  it("rejette, evidence conservée, audit écrit, jamais public", async () => {
    const { store, rec } = memStore(state());
    const r = await rejectItem(ref(), { reason: "documented critical risk — unverifiable source" }, deps(store));
    expect(r.ok).toBe(true);
    expect(r.resultingStatus).toBe(SubmissionStatus.REJECTED_BY_REVIEW);
    expect(rec.audits[0].action).toBe(ReviewAction.REJECT);
    // evidence préservée : l'after l'affirme, aucune suppression n'est exposée par le store.
    expect(JSON.stringify(rec.audits[0].after)).toContain("evidencePreserved");
    assertNoPublic(r.audit);
  });

  it("raison vide → refusé", async () => {
    const { store, rec } = memStore(state());
    const r = await rejectItem(ref(), { reason: "  " }, deps(store));
    expect(r.ok).toBe(false);
    expect(rec.audits).toHaveLength(0);
  });
});

describe("escalateItem — ESCALATE", () => {
  it("pose un audit action=ESCALATE, statut inchangé, aucun statut réinventé", async () => {
    const { store, rec } = memStore(state());
    const r = await escalateItem(ref(), { reason: "P0 forensic" }, deps(store));
    expect(r.ok).toBe(true);
    expect(r.resultingStatus).toBe("PENDING_REVIEW"); // inchangé
    expect(rec.subStatus).toHaveLength(0);              // aucune mutation de statut
    expect(rec.audits[0].action).toBe(ReviewAction.ESCALATE);
    expect(JSON.stringify(rec.audits[0].after)).toContain("removedFromStandardQueue");
    assertNoPublic(r.audit);
  });
});

describe("invariant global — aucune action ne publie", () => {
  it("balaye les 3 actions : zéro public/published dans les audits", async () => {
    for (const t of [ReviewItemType.SUBMISSION, ReviewItemType.SIGNAL, ReviewItemType.LINK]) {
      const { store, rec } = memStore(state({ ref: ref(t, "x"), status: t === ReviewItemType.SUBMISSION ? "PENDING_REVIEW" : t === ReviewItemType.SIGNAL ? "needs_resolution" : "pending_review", visibility: t === ReviewItemType.LINK ? "draft" : null }));
      await resolveItem(ref(t, "x"), { contractAddress: CA_OK, chain: "solana", reason: "r" }, deps(store));
      await rejectItem(ref(t, "x"), { reason: "documented critical risk" }, deps(store));
      await escalateItem(ref(t, "x"), { reason: "P0" }, deps(store));
      for (const a of rec.audits) assertNoPublic(a);
    }
  });
});
