// ─── SPINE-00 — L'EXÉCUTEUR GOUVERNÉ : LE TÉMOIN DU DÉPÔT ───────────────────
//
// Ruling : « L'exécuteur devra PERSISTER la décision positive, RELIRE cette
// décision depuis la base, puis seulement faire passer la version visée vers
// l'état public. Décision non persistée ou ne visant pas exactement la version
// → fail closed. »
//
// ─── Ce que ce fichier prouve, et avec quoi ───────────────────────────────
//
// Le dépôt n'a pas de Postgres sous la main (PGlite n'est pas une dépendance :
// package.json est gelé). Ce témoin travaille donc avec une CONNEXION SCRIPTÉE :
// chaque requête est reconnue par sa forme, une réponse lui est servie, et la
// SÉQUENCE exacte des requêtes est enregistrée. C'est ce qui permet de prouver
// l'ORDRE — verrou, puis insertion, puis relecture, puis promotion — et le
// fail-closed sur une relecture qui MENT.
//
// Les preuves de bout en bout, écritures comprises, sont dans
// scripts/casefile/executor-e2e-pglite.mts (Postgres jetable, et PG17 réel en
// transaction annulée). Les deux se complètent : ici la structure, là le
// contrat de la base.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  executeFoundation,
  executeRelease,
  FOUNDATION_EXECUTION_CAUSES,
  RELEASE_EXECUTION_CAUSES,
  type FoundationIntent,
  type SqlRunner,
  type SqlTransactor,
} from "@/lib/casefile/governedExecutor";
import { canonicalSealMaterial, claimContentHash } from "@/lib/casefile/versioning";
import { codeSeul } from "./codeSeul";

// ═══ LA CONNEXION SCRIPTÉE ══════════════════════════════════════════════════

type Handler = (sql: string, params: readonly unknown[]) => Record<string, unknown>[] | Error;

class FakeDb implements SqlTransactor {
  readonly journal: string[] = [];
  committed = 0;
  rolledBack = 0;
  constructor(private readonly handlers: ReadonlyArray<readonly [RegExp, Handler]>) {}
  async transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T> {
    this.journal.push("BEGIN");
    const db: SqlRunner = {
      query: async <R extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) => {
        const compact = sql.replace(/\s+/g, " ").trim();
        this.journal.push(compact);
        for (const [re, h] of this.handlers) {
          if (re.test(compact)) {
            const out = h(compact, params);
            if (out instanceof Error) throw out;
            return out as R[];
          }
        }
        return [] as R[];
      },
    };
    try {
      const out = await fn(db);
      this.committed++;
      this.journal.push("COMMIT");
      return out;
    } catch (e) {
      this.rolledBack++;
      this.journal.push("ROLLBACK");
      throw e;
    }
  }
  index(re: RegExp): number { return this.journal.findIndex((l) => re.test(l)); }
  count(re: RegExp): number { return this.journal.filter((l) => re.test(l)).length; }
}

// ─── Les formes de requête, telles que l'exécuteur les écrit.
const Q = {
  dossier: /SELECT ref FROM token_casefiles WHERE ref = \$1 FOR SHARE/,
  snapshots: /FROM "EvidenceSnapshot"/,
  sources: /FROM "CaseFileSource" WHERE "casefileRef" = \$1 ORDER BY "sourceId" FOR SHARE/,
  versions: /FROM "CaseFileClaim" WHERE "casefileRef" = \$1 AND "claimId" = \$2 ORDER BY version FOR UPDATE/,
  insSource: /INSERT INTO "CaseFileSource"/,
  insClaim: /INSERT INTO "CaseFileClaim"/,
  lock: /FROM "CaseFileClaim" WHERE "casefileRef" = \$1 AND "claimId" = \$2 AND version = \$3 FOR UPDATE/,
  insDecision: /INSERT INTO casefile_claim_publication_decisions/,
  reread: /FROM casefile_claim_publication_decisions WHERE casefile_ref = \$1 AND claim_id = \$2 AND claim_version = \$3 AND audience = \$4 ORDER BY id DESC LIMIT 1/,
  promote: /UPDATE "CaseFileClaim" SET state = 'PUBLIC'::"ArtifactState"/,
};

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

const REF = "IL-SHILL-VINE-001";
const SHA = "a".repeat(64);
// Les instants sont au format que `::text` rend pour un timestamptz.
const SNAP = { id: "snap-1", canonicalMint: "VineMint1111111111111111111111111111111111111", sha256: SHA, sourceUrl: "https://x.com/e/1", observedAt: "2025-12-07 10:00:00+00" };
const SOURCE = { sourceId: "SRC-001", sourceType: "screenshot", caption: null, capturedAt: "2025-12-07 10:00:00+00", sourceUrl: "https://x.com/e/1", sha256: SHA, snapshotId: "snap-1" };

const CONTENU = { claimId: "C1", title: "Coordinated posting", titleFr: null, description: null, descriptionFr: null, category: null, severity: null, status: null, claimDate: "2025-11-04", actors: [], threadUrl: null, evidenceRefs: ["SRC-001"] };
const H = claimContentHash(canonicalSealMaterial(CONTENU));
const ligneCible = (o: Record<string, unknown> = {}) => ({
  casefileRef: REF, ...CONTENU, version: 1, state: "ATTACHED", contentHash: H, rowNature: "PRIMARY_OBSERVATION", ...o,
});
const decisionRelue = (o: Record<string, unknown> = {}) => ({
  id: "7", casefile_ref: REF, claim_id: "C1", claim_version: 1, audience: "PUBLIC", decision: "GRANT", decided_by: "david", decided_at: "2026-09-14 12:00:00+00", ...o,
});

const INTENT: FoundationIntent = {
  dossier: { ref: REF, canonicalMint: SNAP.canonicalMint },
  sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: "snap-1", sourceType: "screenshot", caption: null }],
  claim: { casefileRef: REF, claimId: "C1", rowNature: "PRIMARY_OBSERVATION", title: "Coordinated posting", claimDate: "2025-11-04", evidenceRefs: ["SRC-001"] },
};
const TARGET = { casefileRef: REF, claimId: "C1", version: 1, expectedContentHash: H, audience: "PUBLIC" as const };
const AUTH = { decidedBy: "david", decidedAt: "2026-09-14T12:00:00Z" };

/** La base « honnête » de la libération : une cible ATTACHED scellée, un INSERT qui rend 7, une relecture qui rend 7/GRANT. */
const baseLiberation = (o: Partial<Record<keyof typeof Q, Handler>> = {}): ReadonlyArray<readonly [RegExp, Handler]> => [
  [Q.lock, o.lock ?? (() => [ligneCible()])],
  [Q.insDecision, o.insDecision ?? (() => [{ id: "7" }])],
  [Q.reread, o.reread ?? (() => [decisionRelue()])],
  [Q.sources, o.sources ?? (() => [SOURCE])],
  [Q.promote, o.promote ?? (() => [{ version: 1 }])],
];

// ═══ (II) LA LIBÉRATION — la séquence du ruling ═════════════════════════════

describe("SPINE-00 · exécuteur — la libération suit la séquence du ruling, dans une transaction", () => {
  it("TÉMOIN POSITIF · verrou → insertion → relecture → contrat → promotion, puis COMMIT", async () => {
    const db = new FakeDb(baseLiberation());
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "RELEASED", target: { casefileRef: REF, claimId: "C1", version: 1, contentHash: H, expectedContentHash: H }, decisionId: "7" });
    const [lock, ins, reread, promote] = [db.index(Q.lock), db.index(Q.insDecision), db.index(Q.reread), db.index(Q.promote)];
    expect(lock, "le verrou est la PREMIÈRE requête").toBe(1);
    expect(ins).toBeGreaterThan(lock);
    expect(reread).toBeGreaterThan(ins);
    expect(promote).toBeGreaterThan(reread);
    expect(db.count(Q.promote), "UNE promotion").toBe(1);
    expect(db.committed).toBe(1);
    expect(db.rolledBack).toBe(0);
  });

  it("la promotion est GARDÉE par state = 'ATTACHED' ET contentHash = celui attendu", async () => {
    const db = new FakeDb(baseLiberation());
    await executeRelease(db, TARGET, AUTH);
    const promote = db.journal[db.index(Q.promote)];
    expect(promote).toMatch(/state = 'ATTACHED'::"ArtifactState" AND "contentHash" = \$4/);
  });

  // Les TROIS conditions du ruling, falsifiées UNE PAR UNE par une relecture qui ment.
  const FALSIFICATIONS: ReadonlyArray<readonly [string, Handler, string, string]> = [
    ["la relecture ne rend RIEN", () => [], "NO_PERSISTED_DECISION", "decision"],
    ["la relecture rend un id qui n'est pas celui inséré", () => [decisionRelue({ id: "8" })], "DECISION_NOT_LATEST", "decision.id"],
    ["la relecture rend une décision REVOKE sous l'id inséré", () => [decisionRelue({ decision: "REVOKE" })], "DECISION_NOT_GRANT", "decision.decision"],
    ["la relecture rend une décision sur une autre version", () => [decisionRelue({ claim_version: 2 })], "DECISION_TARGET_MISMATCH", "decision.claimVersion"],
    ["la relecture rend une décision sur un autre dossier", () => [decisionRelue({ casefile_ref: "IL-SHILL-BOTIFY-001" })], "DECISION_TARGET_MISMATCH", "decision.casefileRef"],
  ];
  for (const [nom, reread, cause, at] of FALSIFICATIONS) {
    it(`3d falsifiée · ${nom} → REFUSED/${cause}, AUCUNE promotion émise, ROLLBACK`, async () => {
      const db = new FakeDb(baseLiberation({ reread }));
      const r = await executeRelease(db, TARGET, AUTH);
      expect(r).toEqual({ outcome: "REFUSED", refusal: { cause, at } });
      expect(db.count(Q.promote)).toBe(0);
      expect(db.rolledBack).toBe(1);
      expect(db.committed).toBe(0);
    });
  }

  it("MUTANT · faire confiance à la décision SANS la relire serait invisible ici — la relecture est donc exigée par la séquence", async () => {
    // Si l'exécuteur cessait de relire, la relecture menteuse ci-dessus ne
    // serait plus interrogée : ce test l'exige NOMMÉMENT dans le journal.
    const db = new FakeDb(baseLiberation());
    await executeRelease(db, TARGET, AUTH);
    expect(db.count(Q.reread), "une relecture, depuis la base, après l'insertion").toBe(1);
  });

  it("le contrat est re-dérivé À L'INSTANT de la promotion : une pièce citée sans sha256 refuse malgré un GRANT valide", async () => {
    const db = new FakeDb(baseLiberation({ sources: () => [{ ...SOURCE, sha256: null }] }));
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "REFUSED", refusal: { cause: "SOURCE_PROVENANCE_INCOMPLETE", at: "SRC-001.sha256" } });
    expect(db.count(Q.promote)).toBe(0);
    expect(db.rolledBack).toBe(1);
  });

  it("une ligne déjà PUBLIC → TARGET_NOT_ATTACHED, la décision insérée est ANNULÉE avec la transaction", async () => {
    const db = new FakeDb(baseLiberation({ lock: () => [ligneCible({ state: "PUBLIC" })] }));
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "REFUSED", refusal: { cause: "TARGET_NOT_ATTACHED", at: "state" } });
    expect(db.count(Q.insDecision), "l'INSERT a eu lieu dans la transaction…").toBe(1);
    expect(db.rolledBack, "…et la transaction est annulée : rien ne reste").toBe(1);
  });

  it("un sceau attendu qui n'est pas celui de la ligne → SEAL_MISMATCH", async () => {
    const db = new FakeDb(baseLiberation());
    const r = await executeRelease(db, { ...TARGET, expectedContentHash: "f".repeat(64) }, AUTH);
    expect(r).toEqual({ outcome: "REFUSED", refusal: { cause: "SEAL_MISMATCH", at: "contentHash" } });
    expect(db.count(Q.promote)).toBe(0);
  });

  it("ABORT · la ligne visée n'existe pas → TARGET_MISSING, AUCUNE décision insérée", async () => {
    const db = new FakeDb(baseLiberation({ lock: () => [] }));
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "TARGET_MISSING", at: "C1@v1" } });
    expect(db.count(Q.insDecision)).toBe(0);
    expect(db.rolledBack).toBe(1);
  });

  it("ABORT · la ligne a été modifiée en place (sceau cassé) → SEAL_BROKEN, AUCUNE décision insérée", async () => {
    const db = new FakeDb(baseLiberation({ lock: () => [ligneCible({ title: "réécrit après scellement" })] }));
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "SEAL_BROKEN", at: "C1@v1" } });
    expect(db.count(Q.insDecision)).toBe(0);
  });

  it("ABORT · l'UPDATE gardé ne touche aucune ligne → PROMOTION_NOT_APPLIED, ROLLBACK", async () => {
    const db = new FakeDb(baseLiberation({ promote: () => [] }));
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "PROMOTION_NOT_APPLIED", at: "C1@v1" } });
    expect(db.rolledBack).toBe(1);
  });

  it("ABORT · l'INSERT de la décision ne rend pas d'id → DECISION_NOT_RECORDED", async () => {
    const db = new FakeDb(baseLiberation({ insDecision: () => [] }));
    const r = await executeRelease(db, TARGET, AUTH);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "DECISION_NOT_RECORDED", at: "decision.id" } });
    expect(db.count(Q.promote)).toBe(0);
  });

  it("une autorité vide ou mal datée est refusée AVANT toute transaction", async () => {
    for (const auth of [{ decidedBy: "", decidedAt: AUTH.decidedAt }, { decidedBy: " david", decidedAt: AUTH.decidedAt }, { decidedBy: "david", decidedAt: "2026-09-14T12:00:00+02:00" }]) {
      const db = new FakeDb(baseLiberation());
      const r = await executeRelease(db, TARGET, auth);
      expect(r.outcome).toBe("REFUSED");
      expect(db.journal, JSON.stringify(auth)).toEqual([]);
    }
  });

  it("une erreur INATTENDUE de la base n'est pas traduite en refus : elle remonte, et la transaction est annulée", async () => {
    const db = new FakeDb(baseLiberation({ insDecision: () => new Error("connexion perdue") }));
    await expect(executeRelease(db, TARGET, AUTH)).rejects.toThrow("connexion perdue");
    expect(db.rolledBack).toBe(1);
  });

  it("toute cause propre à l'exécution de la libération est atteinte par un cas", () => {
    const atteintes = new Set(["TARGET_MISSING", "SEAL_BROKEN", "DECISION_NOT_RECORDED", "PROMOTION_NOT_APPLIED"]);
    for (const c of RELEASE_EXECUTION_CAUSES) expect(atteintes.has(c), c).toBe(true);
  });
});

// ═══ (I) LE FONDEMENT — atomicité, idempotence, ATTACHED ════════════════════

const baseFondation = (o: Partial<Record<keyof typeof Q, Handler>> = {}): ReadonlyArray<readonly [RegExp, Handler]> => [
  [Q.dossier, o.dossier ?? (() => [{ ref: REF }])],
  [Q.snapshots, o.snapshots ?? (() => [SNAP])],
  [Q.sources, o.sources ?? (() => [])],
  [Q.versions, o.versions ?? (() => [])],
  [Q.insSource, o.insSource ?? (() => [{ sourceId: "SRC-001" }])],
  [Q.insClaim, o.insClaim ?? (() => [{ version: 1, chained: false }])],
];

describe("SPINE-00 · exécuteur — le fondement écrit pièce et claim dans UNE transaction, en ATTACHED", () => {
  it("TÉMOIN POSITIF · lectures sous verrou, puis INSERT pièce, puis INSERT claim ATTACHED, puis COMMIT", async () => {
    const db = new FakeDb(baseFondation());
    const r = await executeFoundation(db, INTENT);
    expect(r).toEqual({ outcome: "EXECUTED", claim: { casefileRef: REF, claimId: "C1", version: 1, contentHash: H }, sourcesInserted: ["SRC-001"] });
    expect(db.index(Q.dossier)).toBeLessThan(db.index(Q.versions));
    expect(db.index(Q.versions)).toBeLessThan(db.index(Q.insSource));
    expect(db.index(Q.insSource)).toBeLessThan(db.index(Q.insClaim));
    expect(db.journal[db.index(Q.insClaim)]).toContain(`'ATTACHED'::"ArtifactState"`);
    expect(db.journal[db.index(Q.insClaim)]).not.toContain("PUBLIC");
    expect(db.committed).toBe(1);
    expect(db.journal.at(-1)).toBe("COMMIT");
  });

  it("ATOMICITÉ · une panne entre la pièce et le claim annule la transaction : la pièce écrite ne survit pas", async () => {
    const db = new FakeDb(baseFondation({ insClaim: () => new Error("panne injectée") }));
    await expect(executeFoundation(db, INTENT)).rejects.toThrow("panne injectée");
    expect(db.count(Q.insSource), "la pièce avait été écrite dans la transaction").toBe(1);
    expect(db.rolledBack, "et la transaction est annulée").toBe(1);
    expect(db.journal.at(-1)).toBe("ROLLBACK");
  });

  it("IDEMPOTENCE · le claim existe déjà au même sceau, la pièce aussi → ALREADY_EXECUTED, aucun INSERT", async () => {
    const db = new FakeDb(baseFondation({
      sources: () => [SOURCE],
      versions: () => [{ ...CONTENU, version: 1, contentHash: H }],
    }));
    const r = await executeFoundation(db, INTENT);
    expect(r).toEqual({ outcome: "ALREADY_EXECUTED", claim: { casefileRef: REF, claimId: "C1", version: 1, contentHash: H } });
    expect(db.count(Q.insSource)).toBe(0);
    expect(db.count(Q.insClaim)).toBe(0);
  });

  it("IDEMPOTENCE · le claim existe au même sceau mais sa pièce MANQUE → INCONSISTENT_STATE, rien n'est complété en silence", async () => {
    const db = new FakeDb(baseFondation({ versions: () => [{ ...CONTENU, version: 1, contentHash: H }] }));
    const r = await executeFoundation(db, INTENT);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "INCONSISTENT_STATE", at: "SRC-001" } });
    expect(db.count(Q.insSource)).toBe(0);
  });

  it("le claim existe avec un AUTRE contenu, sans supplantation déclarée → REFUSED/SILENT_REWRITE, rien d'écrit", async () => {
    const db = new FakeDb(baseFondation({
      sources: () => [SOURCE],
      versions: () => [{ ...CONTENU, title: "Ancienne formulation", version: 1, contentHash: claimContentHash(canonicalSealMaterial({ ...CONTENU, title: "Ancienne formulation" })) }],
    }));
    const r = await executeFoundation(db, INTENT);
    expect(r).toEqual({ outcome: "REFUSED", refusal: { cause: "SILENT_REWRITE", at: "C1" } });
    expect(db.count(Q.insClaim)).toBe(0);
  });

  it("ABORT · le dossier n'existe pas → DOSSIER_ABSENT, aucune lecture au-delà", async () => {
    const db = new FakeDb(baseFondation({ dossier: () => [] }));
    const r = await executeFoundation(db, INTENT);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "DOSSIER_ABSENT", at: REF } });
    expect(db.count(Q.insSource)).toBe(0);
  });

  it("ABORT · la pièce existe déjà sous un AUTRE contenu → SOURCE_COLLISION", async () => {
    const db = new FakeDb(baseFondation({ sources: () => [{ ...SOURCE, sha256: "b".repeat(64) }] }));
    const r = await executeFoundation(db, INTENT);
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "SOURCE_COLLISION", at: "SRC-001" } });
  });

  it("ABORT · la supplantation déclarée ne se résout pas à l'INSERT → SUPERSEDES_UNRESOLVED", async () => {
    const ancienne = { ...CONTENU, title: "Ancienne", version: 1, contentHash: claimContentHash(canonicalSealMaterial({ ...CONTENU, title: "Ancienne" })) };
    const db = new FakeDb(baseFondation({ sources: () => [SOURCE], versions: () => [ancienne], insClaim: () => [{ version: 2, chained: false }] }));
    const r = await executeFoundation(db, { ...INTENT, sources: [], claim: { ...INTENT.claim, supersedesVersion: 1 } });
    expect(r).toEqual({ outcome: "ABORTED", refusal: { cause: "SUPERSEDES_UNRESOLVED", at: "C1@v1" } });
    expect(db.rolledBack).toBe(1);
  });

  it("toute cause propre à l'exécution du fondement est atteinte par un cas", () => {
    const atteintes = new Set(["DOSSIER_ABSENT", "SOURCE_COLLISION", "INCONSISTENT_STATE", "SUPERSEDES_UNRESOLVED"]);
    for (const c of FOUNDATION_EXECUTION_CAUSES) expect(atteintes.has(c), c).toBe(true);
  });
});

// ═══ LA STRUCTURE — impossible à exprimer, pas seulement refusé ═════════════

function fichiersSource(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "__tests__" || e === "node_modules" || e === ".next") continue;
      fichiersSource(p, out);
    } else if (/\.(ts|tsx|mts)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe("SPINE-00 · exécuteur — la structure tient la règle", () => {
  const EXECUTEUR = "src/lib/casefile/governedExecutor.ts";
  const executeur = codeSeul(readFileSync(EXECUTEUR, "utf8"));
  const sources = fichiersSource("src").map((f) => [f, codeSeul(readFileSync(f, "utf8"))] as const);

  it("UNE SEULE écriture de `state = 'PUBLIC'` dans tout src/, et elle est dans l'exécuteur", () => {
    const porteurs = sources.filter(([, c]) => /SET\s+state\s*=\s*'PUBLIC'/.test(c)).map(([f]) => f);
    expect(porteurs).toEqual([EXECUTEUR]);
    expect(executeur.match(/SET state = 'PUBLIC'/g)?.length).toBe(1);
  });

  it("la promotion n'est atteignable qu'APRÈS l'insertion et la relecture de la décision, dans le même corps", () => {
    const ins = executeur.indexOf("INSERT INTO casefile_claim_publication_decisions");
    const reread = executeur.indexOf("ORDER BY id DESC LIMIT 1");
    const attest = executeur.indexOf("attestPersistedDecision(");
    const decide = executeur.indexOf("decidePublicRelease(");
    const promote = executeur.indexOf("SET state = 'PUBLIC'");
    expect(ins).toBeGreaterThan(0);
    expect(reread).toBeGreaterThan(ins);
    expect(attest).toBeGreaterThan(reread);
    expect(decide).toBeGreaterThan(attest);
    expect(promote).toBeGreaterThan(decide);
  });

  it("la ligne visée est VERROUILLÉE (FOR UPDATE) avant l'insertion de la décision", () => {
    const lock = executeur.indexOf(`AND version = $3\n          FOR UPDATE`);
    const ins = executeur.indexOf("INSERT INTO casefile_claim_publication_decisions");
    expect(lock, "le verrou existe").toBeGreaterThan(0);
    expect(lock).toBeLessThan(ins);
  });

  it("attestPersistedDecision n'est appelée QU'UNE fois dans src/, dans l'exécuteur, sur la ligne relue", () => {
    const appels = sources.filter(([f, c]) => f !== "src/lib/casefile/governedWriter.ts" && /attestPersistedDecision\(/.test(c)).map(([f]) => f);
    expect(appels).toEqual([EXECUTEUR]);
    expect(executeur.match(/attestPersistedDecision\(/g)?.length).toBe(1);
  });

  it("l'exécuteur n'écrit JAMAIS sur la table de décisions autrement qu'en INSERT — et jamais UPDATE/DELETE sur elle nulle part dans src/", () => {
    for (const [f, c] of sources) {
      expect(c, f).not.toMatch(/UPDATE\s+casefile_claim_publication_decisions/);
      expect(c, f).not.toMatch(/DELETE\s+FROM\s+casefile_claim_publication_decisions/);
      expect(c, f).not.toMatch(/TRUNCATE\s+casefile_claim_publication_decisions/);
    }
    expect(executeur.match(/INSERT INTO casefile_claim_publication_decisions/g)?.length).toBe(1);
  });

  it("le fondement insère un LITTÉRAL 'ATTACHED' et ne connaît pas 'PUBLIC' — le chemin (I) ne peut pas publier", () => {
    const corpsFondation = executeur.slice(executeur.indexOf("export async function executeFoundation"), executeur.indexOf("export interface ReleaseAuthorityInput"));
    expect(corpsFondation).toContain(`'ATTACHED'::"ArtifactState"`);
    expect(corpsFondation).not.toMatch(/PUBLIC/);
    expect(corpsFondation).not.toMatch(/casefile_claim_publication_decisions/);
  });

  it("le sceau du fondement vient de la décision (canonicalSealMaterial), jamais d'une composition locale", () => {
    expect(executeur).not.toMatch(/actors:\s*asStrings\(/);
    expect(executeur).not.toMatch(/createHash\(/);
    expect(executeur).toMatch(/claimContentHash\(canonicalSealMaterial\(/);
  });

  it("l'exécuteur ne connaît pas Prisma ; seul l'adaptateur le connaît, et il ne porte aucun SQL", () => {
    expect(executeur).not.toContain("@/lib/prisma");
    expect(executeur).not.toContain("@prisma/client");
    const adaptateur = codeSeul(readFileSync("src/lib/casefile/governedExecutorPrisma.ts", "utf8"));
    expect(adaptateur).toContain("RepeatableRead");
    expect(adaptateur).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE)\b/);
  });

  it("le SQL est écrit en clair dans les appels db.query — la garde S24 le découvre", () => {
    for (const table of ['"CaseFileClaim"', '"CaseFileSource"', '"EvidenceSnapshot"', "token_casefiles", "casefile_claim_publication_decisions"]) {
      expect(executeur, table).toMatch(new RegExp(`db\\.query[\\s\\S]{0,400}${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  });
});
