// P0-2 — DÉMONSTRATION DU CYCLE COMPLET draft -> public -> archived,
// consommateur par consommateur.
//
// Ce que ce fichier prouve, par exécution réelle du code de production :
//
//   1. le cycle lui-même (approve puis archive) sur les fonctions réelles ;
//   2. l'historique conservé : qui, quand, quel motif, DEPUIS QUEL ÉTAT ;
//   3. la disparition du lien archivé chez CHAQUE consommateur aval nommé par
//      l'architecte — Explorer/Launch Dossiers, ClusterRiskBadge, watchlist,
//      coordinationSignals, kolLeaderboard, casefileMatch/PRE-BUY GUARD ;
//   4. les refus : motif manquant, code inconnu, acteur manquant, draft non
//      archivable, idempotence.
//
// CE QUE ÇA NE PROUVE PAS : le comportement de Postgres. La migration
// MIGRATION_publication_lifecycle_v1.sql n'est PAS appliquée sur
// ep-square-band (interdit du chantier), et aucun Postgres local n'existe sur
// cette machine (ni docker, ni psql). Le moteur est donc remplacé par un
// harnais en mémoire qui rejoue les instructions réelles et applique les deux
// contraintes CHECK de la migration. La logique testée, elle, est la vraie.

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  makeRawDb,
  makeStore,
  resetHarnessClock,
  CheckViolationError,
  type Store,
  type LinkRow,
} from "./helpers/rawSqlDb";
import { makeModel, type Row } from "./helpers/inMemoryPrisma";

// ── Fixture ────────────────────────────────────────────────────────────────
//
// Deux KOL publiés, un même lancement TESTTOK. On archive le lien d'ALPHA.
// BETA sert de témoin : il doit rester intact partout. Sans témoin, un
// consommateur qui renverrait systématiquement du vide passerait le test.

const ALPHA_LINK_ID = "link-alpha";
const BETA_LINK_ID = "link-beta";
const CANDIDATE_ID = "cand-alpha";
const CAMPAIGN_ID = "camp-1";
const MINT = "MintTESTTOKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

function baseLink(over: Partial<LinkRow>): LinkRow {
  return {
    id: "x",
    kolHandle: "alpha",
    contractAddress: MINT,
    chain: "solana",
    tokenSymbol: "TESTTOK",
    caseId: "TESTTOK-CASE",
    role: "promoter",
    documentationStatus: "documented",
    createdAt: new Date("2026-05-10T00:00:00Z"),
    visibility: "draft",
    reviewStatus: "auto_draft",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    canonicalMint: MINT,
    tokenResolutionConfidence: "HIGH",
    socialPostCandidateId: null,
    watcherCampaignId: null,
    createdByBridge: false,
    ...over,
  };
}

const PROFILES: Row[] = [
  {
    handle: "alpha",
    displayName: "Alpha",
    tier: "CRITICAL",
    evidenceDepth: "strong",
    behaviorFlags: JSON.stringify(["COORDINATED_PROMOTION"]),
    totalDocumented: 1000,
    publishStatus: "published",
    publishable: true,
    walletAttributionStrength: "strong",
    summary: null,
    proceedsCoverage: "partial",
    completenessLevel: "substantial",
    lastEnrichedAt: null,
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    verified: true,
    riskFlag: "confirmed_scammer",
    rugCount: 2,
  },
  {
    handle: "beta",
    displayName: "Beta",
    tier: "HIGH",
    evidenceDepth: "moderate",
    behaviorFlags: JSON.stringify(["REPEATED_CASHOUT"]),
    totalDocumented: 500,
    publishStatus: "published",
    publishable: true,
    walletAttributionStrength: "moderate",
    summary: null,
    proceedsCoverage: "none",
    completenessLevel: "incomplete",
    lastEnrichedAt: null,
    updatedAt: new Date("2026-06-02T00:00:00Z"),
    verified: false,
    riskFlag: "high_risk",
    rugCount: 1,
  },
];

let store: Store;
let db: ReturnType<typeof makeRawDb>;

/**
 * Le mock `@/lib/prisma` est branché UNE fois pour tout le fichier ; il lit le
 * `store` courant à chaque appel, donc il reflète toujours l'état d'après la
 * dernière mutation. Chaque consommateur tourne inchangé : c'est sa propre
 * clause `where` qui filtre.
 */
vi.mock("@/lib/prisma", () => {
  const linkRelations = {
    kol: (row: Row) => PROFILES.find((p) => p.handle === row.kolHandle) ?? null,
  };
  return {
    prisma: {
      get kolProfile() {
        return makeModel(PROFILES, {
          counts: () => ({ evidences: 1, tokenLinks: 1, kolWallets: 1, laundryTrails: 0, kolCases: 1 }),
        });
      },
      get kolTokenLink() {
        return makeModel(store.links as unknown as Row[], { relations: linkRelations });
      },
      get kolCase() {
        return makeModel(CASES);
      },
      get kolWallet() {
        return makeModel([], { relations: linkRelations });
      },
      get platformCaseFile() {
        return makeModel([]);
      },
      get kolPromotionMention() {
        return makeModel([]);
      },
      get kolTokenInvolvement() {
        return makeModel([]);
      },
      get socialPostCandidate() {
        return makeModel([]);
      },
      get influencer() {
        return makeModel([]);
      },
    },
  };
});

// La route /api/watchlist lit sa liste de handles dans src/lib/watcher/handles.ts
// (source de verite du watcher) et son snapshot via buildKolCanonicalSnapshotBatch.
// Les deux sont hors du perimetre P0-2 : on les fige pour que le SEUL facteur
// variable du test soit la visibility du KolTokenLink.
vi.mock("@/lib/watcher/handles", () => ({
  handlesV2: [
    { handle: "alpha", priority: "high", category: "interligens_case", source: "seed", chainFocus: "SOL", followerCount: 1000, notes: null },
    { handle: "beta", priority: "medium", category: "interligens_case", source: "seed", chainFocus: "SOL", followerCount: 500, notes: null },
  ],
}));

vi.mock("@/lib/kol/canonical", () => ({
  buildKolCanonicalSnapshotBatch: async () =>
    PROFILES.map((p) => ({
      ...p,
      _count: { evidences: 1, kolWallets: 1, kolCases: 1, tokenLinks: 1 },
      proceedsComputedAt: null,
    })),
}));

const CASES: Row[] = [
  {
    id: "kc-1",
    caseId: "TESTTOK-CASE",
    kolHandle: "alpha",
    role: "promoter",
    paidUsd: null,
    evidence: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
  },
  {
    id: "kc-2",
    caseId: "TESTTOK-CASE",
    kolHandle: "beta",
    role: "co_promoter",
    paidUsd: null,
    evidence: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
  },
];

beforeEach(() => {
  resetHarnessClock();
  store = makeStore({
    links: [
      baseLink({
        id: ALPHA_LINK_ID,
        kolHandle: "alpha",
        visibility: "draft",
        reviewStatus: "auto_draft",
        socialPostCandidateId: CANDIDATE_ID,
        watcherCampaignId: CAMPAIGN_ID,
        createdByBridge: true,
      }),
      baseLink({
        id: BETA_LINK_ID,
        kolHandle: "beta",
        // Mint distinct : casefileMatch clef sur contractAddress, donc le
        // match sur MINT ne depend QUE du lien d'alpha. Sans ca, le temoin
        // masquerait la disparition qu'on veut prouver.
        contractAddress: "MintOTHERyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
        visibility: "public",
        reviewStatus: "approved_public",
      }),
    ],
    candidates: [{ id: CANDIDATE_ID, status: "needs_review" }],
    campaigns: [{ id: CAMPAIGN_ID, reviewStatus: "pending" }],
  });
  db = makeRawDb(store);
});

function alphaLink(): LinkRow {
  return store.links.find((l) => l.id === ALPHA_LINK_ID)!;
}

// ── Lecture des consommateurs ──────────────────────────────────────────────
//
// Chaque helper renvoie « alpha est-il visible ici ? » + le témoin beta.

async function explorerLaunchActors(): Promise<string[]> {
  const { getLaunchDossiers } = await import("@/lib/explorer/explorerItems");
  const published = new Map(
    PROFILES.map((p) => [
      p.handle as string,
      {
        displayName: p.displayName as string | null,
        tier: p.tier as string | null,
        evidenceDepth: p.evidenceDepth as string,
        behaviorFlags: p.behaviorFlags as string,
        totalDocumented: p.totalDocumented as number | null,
        // P0 containment — le gate proceeds exige l'etat de publication ; sans
        // lui, redactProceeds fail-close (voir src/lib/kol/proceedsGate.ts).
        proceedsPublication: (p.proceedsPublication as string | undefined) ?? "published",
      },
    ]),
  );
  const dossiers = await getLaunchDossiers(published);
  const launch = dossiers.find((d) => d.id === "launch-TESTTOK");
  return (launch?.linkedActors ?? []).map((a) => a.handle);
}

async function explorerLaunchCount(): Promise<number> {
  const { getExplorerStats } = await import("@/lib/explorer/explorerItems");
  const stats = await getExplorerStats();
  return stats.linkedLaunches;
}

async function clusterLaunchActors(): Promise<string[]> {
  const { getClusterContextForLaunch } = await import("@/lib/cluster/clusterRisk");
  const ctx = await getClusterContextForLaunch("TESTTOK");
  return ctx.linkedActors.map((a) => a.handle);
}

async function clusterProfileTokens(handle: string): Promise<string[]> {
  const { getRelatedActorsForProfile } = await import("@/lib/cluster/clusterRisk");
  const ctx = await getRelatedActorsForProfile(handle);
  return ctx?.relatedActors.flatMap((a) => a.sharedTokens) ?? [];
}

async function coordinationLaunchActorCount(): Promise<number> {
  const { getCoordinationSignalsForLaunch } = await import("@/lib/coordination");
  const ctx = await getCoordinationSignalsForLaunch("TESTTOK");
  return ctx.relatedActorsCount;
}

async function leaderboardLinkedTokens(): Promise<number> {
  const { getLeaderboardStats } = await import("@/lib/kol/kolLeaderboard");
  const stats = await getLeaderboardStats();
  return stats.totalLinkedTokens;
}

async function casefileMatchCaseIds(): Promise<string[]> {
  const { runCasefileMatch } = await import("@/lib/reflex/casefileMatch");
  const res = await runCasefileMatch({ address: MINT, handle: null } as never);
  return res.raw?.caseIds ?? [];
}

// ── 1. Le cycle ────────────────────────────────────────────────────────────

describe("P0-2 — cycle draft -> public -> archived", () => {
  it("un draft n'est visible chez AUCUN consommateur public", async () => {
    expect(alphaLink().visibility).toBe("draft");
    expect(await explorerLaunchActors()).toEqual(["beta"]);
    expect(await clusterLaunchActors()).toEqual(["beta"]);
    expect(await coordinationLaunchActorCount()).toBe(1);
  });

  it("approve met le lien en ligne chez TOUS les consommateurs", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const res = await approveDraftLink(db, ALPHA_LINK_ID, "david");

    expect(res.action).toBe("approved");
    expect(alphaLink().visibility).toBe("public");
    expect((await explorerLaunchActors()).sort()).toEqual(["alpha", "beta"]);
    expect((await clusterLaunchActors()).sort()).toEqual(["alpha", "beta"]);
    expect(await coordinationLaunchActorCount()).toBe(2);
    expect(await casefileMatchCaseIds()).toContain("TESTTOK-CASE");
  });

  it("archive retire le lien de CHAQUE consommateur nommé", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");

    await approveDraftLink(db, ALPHA_LINK_ID, "david");

    // État publié — référence AVANT dépublication.
    const before = {
      explorerActors: (await explorerLaunchActors()).sort(),
      explorerLaunches: await explorerLaunchCount(),
      clusterActors: (await clusterLaunchActors()).sort(),
      alphaSharedTokens: await clusterProfileTokens("alpha"),
      coordinationActors: await coordinationLaunchActorCount(),
      leaderboardTokens: await leaderboardLinkedTokens(),
      casefileCases: await casefileMatchCaseIds(),
    };
    expect(before.explorerActors).toEqual(["alpha", "beta"]);
    expect(before.alphaSharedTokens).toContain("TESTTOK");
    expect(before.casefileCases).toContain("TESTTOK-CASE");

    const res = await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "contestation reçue le 2026-08-15, preuve retirée",
      reasonCode: "contested",
      contestationRef: "CONTEST-2026-001",
    });
    expect(res.action).toBe("archived");
    expect(res.from).toBe("public");
    expect(res.to).toBe("archived");
    expect(alphaLink().visibility).toBe("archived");

    // ── Consommateur par consommateur ────────────────────────────────────
    // Explorer / Launch Dossiers
    expect(await explorerLaunchActors()).toEqual(["beta"]);
    // Explorer — compteur « launches » (getExplorerStats)
    expect(await explorerLaunchCount()).toBeLessThanOrEqual(before.explorerLaunches);
    // ClusterRiskBadge — vue lancement
    expect(await clusterLaunchActors()).toEqual(["beta"]);
    // ClusterRiskBadge — vue profil : alpha n'a plus de token partagé
    expect(await clusterProfileTokens("alpha")).toEqual([]);
    // coordinationSignals
    expect(await coordinationLaunchActorCount()).toBe(1);
    // kolLeaderboard — le compteur de tokens liés reste à 1 : le lien de BETA
    // sur le même symbole est toujours public, et c'est correct. La preuve que
    // le compteur lit bien la visibility se fait en archivant AUSSI beta, plus
    // bas : il tombe alors à 0.
    expect(before.leaderboardTokens).toBe(1);
    expect(await leaderboardLinkedTokens()).toBe(1);
    // casefileMatch / PRE-BUY GUARD
    expect(await casefileMatchCaseIds()).not.toContain("TESTTOK-CASE");

    // Témoin : beta n'a pas bougé.
    expect(store.links.find((l) => l.id === BETA_LINK_ID)!.visibility).toBe("public");

    // Et quand le DERNIER lien public du symbole part aussi, le compteur
    // kolLeaderboard tombe à zéro — il lit bien la visibility, pas le profil.
    const beta = await archiveLinkPublication(db, BETA_LINK_ID, {
      actorId: "david",
      reason: "erratum sur le second lien",
      reasonCode: "erratum",
    });
    expect(beta.action).toBe("archived");
    expect(await leaderboardLinkedTokens()).toBe(0);
    expect(await explorerLaunchCount()).toBe(0);
  });

  it("le candidat source suit le lien jusqu'à archived", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");
    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    expect(store.candidates[0].status).toBe("approved_public");

    const res = await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "erratum",
      reasonCode: "erratum",
    });
    expect(res.candidateTransition).toBe("approved_public→archived");
    expect(store.candidates[0].status).toBe("archived");
  });

  it("la campagne redescend de approved_public à archived", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");

    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    expect(store.campaigns[0].reviewStatus).toBe("approved_public");

    await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "erratum constaté",
      reasonCode: "erratum",
    });
    expect(store.campaigns[0].reviewStatus).toBe("archived");
  });
});

describe("P0-2 — consommateur /api/watchlist", () => {
  async function watchlistTickers(handle: string): Promise<string[]> {
    const { GET } = await import("@/app/api/watchlist/route");
    const res = await GET();
    const body = (await res.json()) as { entries: Array<{ handle: string; tickers: string[] }> };
    const entry = body.entries.find((e) => e.handle.toLowerCase() === handle.toLowerCase());
    return entry?.tickers ?? [];
  }

  it("le ticker apparait a l'approbation et disparait a l'archivage", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");

    // draft -> aucun ticker cure pour alpha
    expect(await watchlistTickers("alpha")).toEqual([]);

    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    expect(await watchlistTickers("alpha")).toContain("TESTTOK");

    await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "contestation honoree",
      reasonCode: "contested",
    });
    expect(await watchlistTickers("alpha")).toEqual([]);
    // Temoin : beta garde le sien.
    expect(await watchlistTickers("beta")).toContain("TESTTOK");
  });
});

// ── 2. L'historique ────────────────────────────────────────────────────────

describe("P0-2 — historique conservé", () => {
  it("le journal contient les DEUX étapes, avec motif, acteur et état de départ", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication, getLinkPublicationHistory } = await import(
      "@/lib/watcher-bridge/archiveLinkPublication"
    );

    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "contestation reçue, preuve retirée",
      reasonCode: "contested",
      contestationRef: "CONTEST-2026-001",
    });

    const history = await getLinkPublicationHistory(db, ALPHA_LINK_ID);
    expect(history).toHaveLength(2);

    const [latest, first] = history; // ORDER BY createdAt DESC
    expect(first.fromVisibility).toBe("draft");
    expect(first.toVisibility).toBe("public");
    expect(first.reasonCode).toBe("approved");
    expect(first.actorId).toBe("david");

    expect(latest.fromVisibility).toBe("public");
    expect(latest.toVisibility).toBe("archived");
    expect(latest.reasonCode).toBe("contested");
    expect(latest.reason).toContain("contestation");
    expect(latest.actorId).toBe("david");
    expect(latest.contestationRef).toBe("CONTEST-2026-001");
    expect(latest.createdAt.getTime()).toBeGreaterThan(first.createdAt.getTime());
  });

  it("l'historique est interrogeable PAR PERSONNE — le socle d'une contestation", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication, getHandlePublicationHistory } = await import(
      "@/lib/watcher-bridge/archiveLinkPublication"
    );
    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "contestation honorée",
      reasonCode: "contested",
      contestationRef: "CONTEST-2026-001",
    });

    // Interrogation insensible à la casse : une contestation n'arrive pas
    // avec la casse exacte du handle en base.
    const byHandle = await getHandlePublicationHistory(db, "ALPHA");
    expect(byHandle).toHaveLength(2);
    expect(byHandle.every((e) => e.kolHandle === "alpha")).toBe(true);
    expect(byHandle.map((e) => e.toVisibility)).toEqual(["archived", "public"]);
  });

  it("l'historique survit à la disparition du lien (aucune FK cascade)", async () => {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    const { archiveLinkPublication, getHandlePublicationHistory } = await import(
      "@/lib/watcher-bridge/archiveLinkPublication"
    );
    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    await archiveLinkPublication(db, ALPHA_LINK_ID, {
      actorId: "david",
      reason: "doublon",
      reasonCode: "duplicate",
    });

    // Le lien disparaît (suppression manuelle, purge, cascade profil…).
    store.links = store.links.filter((l) => l.id !== ALPHA_LINK_ID);

    const byHandle = await getHandlePublicationHistory(db, "alpha");
    expect(byHandle).toHaveLength(2);
    expect(byHandle[0].tokenSymbol).toBe("TESTTOK");
  });
});

// ── 3. Les refus ───────────────────────────────────────────────────────────

describe("P0-2 — refus et idempotence", () => {
  async function archive(input: Record<string, unknown>) {
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");
    return archiveLinkPublication(db, ALPHA_LINK_ID, input as never);
  }

  async function publishAlpha() {
    const { approveDraftLink } = await import("@/lib/watcher-bridge/reviewDraftLink");
    await approveDraftLink(db, ALPHA_LINK_ID, "david");
    store.linkStatusLog.length = 0; // on isole les écritures du refus testé
  }

  it("refuse un motif vide — sans motif, ce n'est pas une dépublication", async () => {
    await publishAlpha();
    const res = await archive({ actorId: "david", reason: "   ", reasonCode: "erratum" });
    expect(res.action).toBe("missing_reason");
    expect(alphaLink().visibility).toBe("public");
    expect(store.linkStatusLog).toHaveLength(0);
  });

  it("refuse un code de motif inconnu", async () => {
    await publishAlpha();
    const res = await archive({ actorId: "david", reason: "parce que", reasonCode: "parce_que" });
    expect(res.action).toBe("invalid_reason_code");
    expect(alphaLink().visibility).toBe("public");
    expect(store.linkStatusLog).toHaveLength(0);
  });

  it("refuse une décision sans acteur", async () => {
    await publishAlpha();
    const res = await archive({ actorId: "", reason: "erratum", reasonCode: "erratum" });
    expect(res.action).toBe("missing_actor");
    expect(alphaLink().visibility).toBe("public");
  });

  it("refuse d'archiver un DRAFT — un draft se rejette, il ne s'archive pas", async () => {
    const res = await archive({ actorId: "david", reason: "erratum", reasonCode: "erratum" });
    expect(res.action).toBe("not_public");
    expect(res.from).toBe("draft");
    expect(alphaLink().visibility).toBe("draft");
    expect(store.linkStatusLog).toHaveLength(0);
  });

  it("est idempotent : archiver deux fois ne réécrit pas le journal", async () => {
    await publishAlpha();
    const first = await archive({ actorId: "david", reason: "erratum", reasonCode: "erratum" });
    expect(first.action).toBe("archived");
    const second = await archive({ actorId: "david", reason: "erratum", reasonCode: "erratum" });
    expect(second.action).toBe("noop_already_archived");
    expect(store.linkStatusLog).toHaveLength(1);
  });

  it("un lien inconnu ne crée aucune écriture", async () => {
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");
    const res = await archiveLinkPublication(db, "link-nope", {
      actorId: "david",
      reason: "erratum",
      reasonCode: "erratum",
    });
    expect(res.action).toBe("not_found");
    expect(store.linkStatusLog).toHaveLength(0);
  });

  it("un échec du journal ANNULE la dépublication (pas de retrait silencieux)", async () => {
    await publishAlpha();
    const failing = {
      async $queryRawUnsafe<T>(sql: string, ...v: unknown[]): Promise<T> {
        if (/INSERT INTO "KolTokenLinkStatusLog"/.test(sql)) {
          throw new CheckViolationError("KolTokenLinkStatusLog_reason_not_blank");
        }
        return db.$queryRawUnsafe<T>(sql, ...v);
      },
    };
    const { archiveLinkPublication } = await import("@/lib/watcher-bridge/archiveLinkPublication");
    await expect(
      archiveLinkPublication(failing, ALPHA_LINK_ID, {
        actorId: "david",
        reason: "erratum",
        reasonCode: "erratum",
      }),
    ).rejects.toBeInstanceOf(CheckViolationError);
    // Le lien est toujours public : rien n'a été retiré sans trace.
    expect(alphaLink().visibility).toBe("public");
  });
});

// ── 4. Alignement code <-> migration ───────────────────────────────────────

describe("P0-2 — alignement code / migration SQL", () => {
  it("les codes de motif du code sont exactement ceux de la contrainte CHECK", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const { PUBLICATION_DECISION_CODES } = await import(
      "@/lib/watcher-bridge/linkPublicationJournal"
    );

    const sql = readFileSync(
      join(__dirname, "..", "..", "migrations", "MIGRATION_publication_lifecycle_v1.sql"),
      "utf8",
    );
    const block = sql.slice(sql.indexOf('"reasonCode" IN ('));
    const inList = block.slice(0, block.indexOf("))"));
    const sqlCodes = Array.from(inList.matchAll(/'([a-z_]+)'/g)).map((m) => m[1]);

    expect(sqlCodes.sort()).toEqual([...PUBLICATION_DECISION_CODES].sort());
  });

  it("les motifs d'ARCHIVE sont un sous-ensemble strict, sans 'approved'", async () => {
    const { ARCHIVE_REASON_CODES } = await import("@/lib/watcher-bridge/archiveLinkPublication");
    const { PUBLICATION_DECISION_CODES } = await import(
      "@/lib/watcher-bridge/linkPublicationJournal"
    );
    for (const code of ARCHIVE_REASON_CODES) {
      expect(PUBLICATION_DECISION_CODES).toContain(code);
    }
    expect(ARCHIVE_REASON_CODES as readonly string[]).not.toContain("approved");
    expect(ARCHIVE_REASON_CODES as readonly string[]).not.toContain("rejected");
  });

  it("/api/scan/resolve filtre bien en dur sur visibility = 'public'", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "scan", "resolve", "route.ts"),
      "utf8",
    );
    // Ce consommateur lit en SQL brut : il n'a pas de clause Prisma à évaluer.
    // On vérifie donc le littéral, et l'invariant global fait le reste.
    expect(source).toMatch(/FROM "KolTokenLink"\s+WHERE "visibility" = 'public'/);
  });
});
