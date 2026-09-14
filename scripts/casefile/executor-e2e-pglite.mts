// ─── SPINE-00 — L'EXÉCUTEUR GOUVERNÉ, DE BOUT EN BOUT ───────────────────────
//
// ██  Deux modes. Aucun des deux n'écrit quoi que ce soit qui survive.       ██
//
//   npx tsx scripts/casefile/executor-e2e-pglite.mts
//       Postgres JETABLE en WASM (PGlite). Le schéma est reconstruit tel que
//       MESURÉ en production (enums, CHECK, uniques, FK), le DDL de la table de
//       décisions est rejoué depuis docs/prep/, puis l'exécuteur est exercé,
//       écritures comprises. PGlite n'est PAS une dépendance du dépôt :
//       PGLITE_PATH doit pointer sur une installation locale.
//
//   npx tsx scripts/casefile/executor-e2e-pglite.mts --pg17-rollback
//       PRODUCTION (DATABASE_URL de .env.local), UNE transaction explicite,
//       un SAVEPOINT par scénario, ROLLBACK FINAL. Un dossier SYNTHÉTIQUE
//       (IL-SPINE00-EXEC-TEST) est créé dans la transaction : aucune ligne
//       VINE ni BOTIFY n'est touchée, même transitoirement. Preuve de
//       non-destruction imprimée : comptes et md5 de CaseFileClaim et
//       CaseFileSource inchangés, table de décisions revenue à son compte.
//
// Les scénarios sont LES MÊMES dans les deux modes. Ce qui se prouve en WASM
// est la logique ; ce qui se prouve en PG17 réel est le contrat de la base.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  executeFoundation,
  executeRelease,
  type FoundationIntent,
  type SqlRunner,
  type SqlTransactor,
} from "@/lib/casefile/governedExecutor";
import { canonicalSealMaterial, claimContentHash } from "@/lib/casefile/versioning";
import { FOUNDATION_REFUSAL_CAUSES } from "@/lib/casefile/governedWriter";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODE_PG17 = process.argv.includes("--pg17-rollback");
const DDL = readFileSync(path.join(REPO, "docs/prep/MIGRATION_DECISIONS_PUBLICATION_CLAIM_2026-09-14.sql"), "utf8");

// ─── Un client minimal : pg et PGlite parlent tous deux `.query(sql, params)`.
interface Client {
  query(sql: string, params?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  /** Un script multi-instructions (le DDL). PGlite l'exige distinct de `query`. */
  exec?(sql: string): Promise<unknown>;
}

/**
 * Le transactor des preuves : chaque `transaction()` est un SAVEPOINT dans une
 * transaction EXTERNE que le harnais ouvre et ANNULE. En PG17 réel, c'est ce
 * qui garantit qu'aucune écriture ne survit ; en PGlite, c'est ce qui isole
 * les scénarios sans reconstruire le schéma.
 */
let sp = 0;
function savepointTransactor(c: Client): SqlTransactor {
  return {
    async transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T> {
      const name = `sp_${++sp}`;
      await c.query(`SAVEPOINT ${name}`);
      const db: SqlRunner = { query: async (sql, params = []) => (await c.query(sql, params as unknown[])).rows as never };
      try {
        const out = await fn(db);
        await c.query(`RELEASE SAVEPOINT ${name}`);
        return out;
      } catch (e) {
        await c.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw e;
      }
    },
  };
}

/** Un saboteur : intercepte certaines requêtes. Sert à FALSIFIER, jamais en production. */
function saboteur(base: SqlTransactor, intercept: (sql: string, params: readonly unknown[]) => Record<string, unknown>[] | "THROW" | null): SqlTransactor {
  return {
    transaction: (fn) => base.transaction((db) => fn({
      query: async (sql, params = []) => {
        const r = intercept(sql, params);
        if (r === "THROW") throw new Error("PANNE INJECTÉE");
        if (r !== null) return r as never;
        return db.query(sql, params);
      },
    })),
  };
}

// ─── Le compte-rendu.
const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => { if (!ok) ko++; lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? " · " + detail : ""}`); };
const j = (x: unknown) => JSON.stringify(x);

// ─── Le dossier synthétique et ses snapshots.
const REF = "IL-SPINE00-EXEC-TEST";
const MINT = "Spine00ExecTestMint11111111111111111111111";
const SHA = "e".repeat(64);
const SNAP = "spine00-exec-test-snap-1";
const SNAP_NU = "spine00-exec-test-snap-nu";        // sans sha256 : non admissible
const SNAP_AUTRE = "spine00-exec-test-snap-autre";  // autre mint : DOSSIER_MIX

async function fixture(c: Client): Promise<void> {
  await c.query(`INSERT INTO token_casefiles (ref, codename, ticker, title, family, subtype, verdict, status, "primaryChain")
    VALUES ($1, 'SPINE00-TEST', '$TEST', 'Dossier synthétique de preuve', 'test', 'test', 'AVOID', 'test', 'solana')`, [REF]);
  await c.query(`INSERT INTO "EvidenceSnapshot" (id, "relationType", "relationKey", "snapshotType", title, caption, "canonicalMint", sha256, "sourceUrl", "observedAt")
    VALUES ($1, 'token', $2, 'screenshot', 't', 'c', $2, $3, 'https://x.com/e/1', '2025-12-07T10:00:00Z'),
           ($4, 'token', $2, 'screenshot', 't', 'c', $2, NULL, 'https://x.com/e/2', '2025-12-07T10:00:00Z'),
           ($5, 'token', 'autre', 'screenshot', 't', 'c', 'AutreMint111111111111111111111111111111111', $6, 'https://x.com/e/3', '2025-12-07T10:00:00Z')`,
    // sha256 DISTINCTS : EvidenceSnapshot porte un index UNIQUE sur sha256 en
    // production (EvidenceSnapshot_sha256_key) — mesuré par l'échec 23505 du
    // premier essai en PG17, invisible dans pg_constraint parce que c'est un index.
    [SNAP, MINT, SHA, SNAP_NU, SNAP_AUTRE, "d".repeat(64)]);
}

const intent = (o: Omit<Partial<FoundationIntent>, "claim"> & { claim?: Partial<FoundationIntent["claim"]> & Record<string, unknown> } = {}): FoundationIntent => ({
  dossier: { ref: REF, canonicalMint: MINT },
  sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: SNAP, sourceType: "screenshot", caption: "Fil 1/8" }],
  ...o,
  claim: {
    casefileRef: REF, claimId: "C1", rowNature: "PRIMARY_OBSERVATION", title: "Coordinated posting",
    claimDate: "2025-11-04", evidenceRefs: ["SRC-001"],
    ...(o.claim ?? {}),
  } as FoundationIntent["claim"],
});

async function etat(c: Client) {
  const claims = (await c.query(`SELECT count(*)::int AS n FROM "CaseFileClaim" WHERE "casefileRef" = $1`, [REF])).rows[0].n;
  const sources = (await c.query(`SELECT count(*)::int AS n FROM "CaseFileSource" WHERE "casefileRef" = $1`, [REF])).rows[0].n;
  const decisions = (await c.query(`SELECT count(*)::int AS n FROM casefile_claim_publication_decisions WHERE casefile_ref = $1`, [REF])).rows[0].n;
  return { claims: Number(claims), sources: Number(sources), decisions: Number(decisions) };
}

async function scenarios(c: Client): Promise<void> {
  const tx = savepointTransactor(c);

  // ═══ (I) FONDEMENT ═══
  lignes.push("── (I) FONDEMENT");
  const pos = await executeFoundation(tx, intent());
  check("TÉMOIN POSITIF · fondation complète → EXECUTED v1", pos.outcome === "EXECUTED" && pos.claim.version === 1, j(pos));
  const l1 = (await c.query(`SELECT state::text AS state, version, "contentHash", "rowNature"::text AS rn FROM "CaseFileClaim" WHERE "casefileRef"=$1 AND "claimId"='C1'`, [REF])).rows;
  check("  la ligne est ATTACHED, v1, scellée, classifiée", l1.length === 1 && l1[0].state === "ATTACHED" && l1[0].version === 1 && !!l1[0].contentHash && l1[0].rn === "PRIMARY_OBSERVATION", j(l1));
  const s1 = (await c.query(`SELECT sha256, "sourceUrl", "snapshotId", "capturedAt" IS NOT NULL AS cap FROM "CaseFileSource" WHERE "casefileRef"=$1 AND "sourceId"='SRC-001'`, [REF])).rows;
  check("  la pièce est DÉRIVÉE du snapshot (sha256, URL, snapshotId, capturedAt)", s1.length === 1 && s1[0].sha256 === SHA && s1[0].sourceUrl === "https://x.com/e/1" && s1[0].snapshotId === SNAP && s1[0].cap === true, j(s1));
  const sceau = claimContentHash(canonicalSealMaterial({ claimId: "C1", title: "Coordinated posting", claimDate: "2025-11-04", actors: [], evidenceRefs: ["SRC-001"] }));
  check("  le sceau persisté = canonicalSealMaterial (règle B)", l1[0]?.contentHash === sceau);

  const e0 = await etat(c);
  const idem = await executeFoundation(tx, intent());
  const e1 = await etat(c);
  check("IDEMPOTENCE · rejouer la même fondation → ALREADY_EXECUTED, aucune ligne de plus", idem.outcome === "ALREADY_EXECUTED" && j(e0) === j(e1), `${j(idem)} · ${j(e0)} → ${j(e1)}`);

  const corr = await executeFoundation(tx, intent({ claim: { title: "Coordinated posting (reformulé)", supersedesVersion: 1 } }));
  const versions = (await c.query(`SELECT version, "contentHash", supersedes IS NOT NULL AS chained, state::text AS state FROM "CaseFileClaim" WHERE "casefileRef"=$1 AND "claimId"='C1' ORDER BY version`, [REF])).rows;
  check("VERSIONNEMENT · correction déclarée → v2 chaînée, v1 intacte (même sceau)", corr.outcome === "EXECUTED" && corr.claim.version === 2 && versions.length === 2 && versions[0].contentHash === sceau && versions[1].chained === true, j(versions));
  const idem2 = await executeFoundation(tx, intent({ claim: { title: "Coordinated posting (reformulé)", supersedesVersion: 1 } }));
  check("IDEMPOTENCE · rejouer la correction → ALREADY_EXECUTED v2", idem2.outcome === "ALREADY_EXECUTED" && idem2.claim.version === 2, j(idem2));

  // ── Les causes de refus de la décision, atteintes de bout en bout.
  lignes.push("── les causes de refus, de bout en bout");
  // Fixtures pour les causes qui exigent un existant.
  await c.query(`INSERT INTO "CaseFileClaim" ("casefileRef","claimId",title,"evidenceRefs","rowNature",version,"contentHash") VALUES ($1,'C-CASSE','t','["SRC-001"]'::jsonb,'PRIMARY_OBSERVATION',1,$2)`, [REF, "0".repeat(64)]);
  await c.query(`INSERT INTO "CaseFileSource" ("casefileRef","sourceId","sourceType",caption,"sourceUrl") VALUES ($1,'SRC-NUE','thread',NULL,'https://x.com/e/9')`, [REF]);
  const CAUSES: ReadonlyArray<readonly [string, FoundationIntent, string]> = [
    ["MALFORMED_INPUT · titre vide", intent({ claim: { claimId: "C-M", title: "  " } }), "MALFORMED_INPUT"],
    ["DOSSIER_MIX · snapshot d'un autre mint", intent({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-X", snapshotId: SNAP_AUTRE, sourceType: "screenshot" }], claim: { claimId: "C-DM", evidenceRefs: ["SRC-X"] } }), "DOSSIER_MIX"],
    ["SNAPSHOT_MISSING · snapshotId inconnu", intent({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-X", snapshotId: "spine00-exec-test-nexiste-pas", sourceType: "screenshot" }], claim: { claimId: "C-SM", evidenceRefs: ["SRC-X"] } }), "SNAPSHOT_MISSING"],
    ["SNAPSHOT_NOT_ADMISSIBLE · snapshot sans sha256", intent({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-X", snapshotId: SNAP_NU, sourceType: "screenshot" }], claim: { claimId: "C-SNA", evidenceRefs: ["SRC-X"] } }), "SNAPSHOT_NOT_ADMISSIBLE"],
    ["CLAIM_UNCLASSIFIED · rowNature UNCLASSIFIED", intent({ sources: [], claim: { claimId: "C-CU", rowNature: "UNCLASSIFIED" } }), "CLAIM_UNCLASSIFIED"],
    ["EVIDENCE_REFS_EMPTY", intent({ sources: [], claim: { claimId: "C-ER", evidenceRefs: [] } }), "EVIDENCE_REFS_EMPTY"],
    ["EVIDENCE_REF_UNRESOLVED · ref inconnue du registre", intent({ sources: [], claim: { claimId: "C-EU", evidenceRefs: ["SRC-404"] } }), "EVIDENCE_REF_UNRESOLVED"],
    ["SOURCE_PROVENANCE_INCOMPLETE · pièce existante sans sha256", intent({ sources: [], claim: { claimId: "C-SP", evidenceRefs: ["SRC-NUE"] } }), "SOURCE_PROVENANCE_INCOMPLETE"],
    ["ESTIMATE_NOT_AUDITABLE", intent({ sources: [], claim: { claimId: "C-EN", rowNature: "ESTIMATE" } }), "ESTIMATE_NOT_AUDITABLE"],
    ["PUBLICATION_IN_FOUNDATION · state dans la charge", intent({ sources: [], claim: { claimId: "C-PF", state: "PUBLIC" } }), "PUBLICATION_IN_FOUNDATION"],
    ["VERSIONING_SUPPLIED · version dans la charge", intent({ sources: [], claim: { claimId: "C-VS", version: 1 } }), "VERSIONING_SUPPLIED"],
    ["SILENT_REWRITE · C1 existe, contenu différent, pas de supplantation", intent({ sources: [], claim: { title: "Autre texte" } }), "SILENT_REWRITE"],
    ["STALE_SUPERSEDE · C1 est en v2, supplantation de v1", intent({ sources: [], claim: { title: "Troisième texte", supersedesVersion: 1 } }), "STALE_SUPERSEDE"],
    ["SUPERSEDES_NOTHING · claim inexistant, supplantation déclarée", intent({ sources: [], claim: { claimId: "C-SN", supersedesVersion: 1 } }), "SUPERSEDES_NOTHING"],
    ["SEAL_BROKEN · dernière version au sceau cassé", intent({ sources: [], claim: { claimId: "C-CASSE", title: "Corrigé", supersedesVersion: 1 } }), "SEAL_BROKEN"],
    ["CONTENT_UNCHANGED · supplantation au contenu identique (C1 v2)", intent({ sources: [], claim: { title: "Coordinated posting (reformulé)", supersedesVersion: 2 } }), "CONTENT_UNCHANGED"],
  ];
  const atteintes = new Set<string>();
  for (const [nom, it, cause] of CAUSES) {
    const avant = await etat(c);
    const r = await executeFoundation(tx, it);
    const apres = await etat(c);
    const ok = (r.outcome === "REFUSED" || r.outcome === "ALREADY_EXECUTED") && r.outcome === "REFUSED" && r.refusal.cause === cause && j(avant) === j(apres);
    if (ok) atteintes.add(cause);
    check(`${nom} → REFUSED/${cause}, rien d'écrit`, ok, r.outcome === "REFUSED" ? `${r.refusal.cause} @ ${r.refusal.at}` : j(r));
  }
  const manquantes = FOUNDATION_REFUSAL_CAUSES.filter((cz) => !atteintes.has(cz));
  check(`toutes les causes de FOUNDATION_REFUSAL_CAUSES (${FOUNDATION_REFUSAL_CAUSES.length}) atteintes de bout en bout`, manquantes.length === 0, manquantes.length ? `manquantes : ${manquantes.join(", ")}` : `${atteintes.size}/${FOUNDATION_REFUSAL_CAUSES.length}`);

  // ── Les causes propres à l'exécution.
  lignes.push("── les causes propres à l'exécution");
  const abs = await executeFoundation(tx, intent({ dossier: { ref: "IL-SPINE00-NEXISTE-PAS", canonicalMint: MINT }, claim: { casefileRef: "IL-SPINE00-NEXISTE-PAS", claimId: "C-DA" } }));
  check("DOSSIER_ABSENT · ref inconnu de token_casefiles → ABORTED", abs.outcome === "ABORTED" && abs.refusal.cause === "DOSSIER_ABSENT", j(abs));
  const col = await executeFoundation(tx, intent({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: SNAP_AUTRE, sourceType: "screenshot" }], claim: { claimId: "C-COL" } }));
  check("SOURCE_COLLISION · SRC-001 existe avec un autre contenu → ABORTED", col.outcome === "ABORTED" && col.refusal.cause === "SOURCE_COLLISION", j(col));

  // ── ATOMICITÉ : panne injectée entre la pièce et le claim.
  lignes.push("── atomicité");
  const avantAtom = await etat(c);
  const sabote = saboteur(tx, (sql) => (/INSERT INTO "CaseFileClaim"/.test(sql) ? "THROW" : null));
  let panne: string | null = null;
  try {
    await executeFoundation(sabote, intent({ sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-ATOM", snapshotId: SNAP, sourceType: "screenshot" }], claim: { claimId: "C-ATOM", evidenceRefs: ["SRC-ATOM"] } }));
  } catch (e) { panne = (e as Error).message; }
  const apresAtom = await etat(c);
  const orpheline = (await c.query(`SELECT count(*)::int AS n FROM "CaseFileSource" WHERE "casefileRef"=$1 AND "sourceId"='SRC-ATOM'`, [REF])).rows[0].n;
  check("ATOMICITÉ · panne entre la pièce et le claim → l'erreur remonte, aucune pièce orpheline, aucun claim", panne === "PANNE INJECTÉE" && Number(orpheline) === 0 && j(avantAtom) === j(apresAtom), `panne=${panne} orpheline=${orpheline} ${j(avantAtom)} → ${j(apresAtom)}`);

  // ═══ (II) LIBÉRATION ═══
  lignes.push("── (II) LIBÉRATION");
  const v2 = versions[1] as { contentHash: string };
  const target = { casefileRef: REF, claimId: "C1", version: 2, expectedContentHash: v2.contentHash, audience: "PUBLIC" as const };
  const auth = { decidedBy: "verification-e2e", decidedAt: "2026-09-14T12:00:00Z" };

  // Les trois conditions FALSIFIÉES une par une, par saboteur sur la RELECTURE.
  const RELECTURE = /FROM casefile_claim_publication_decisions[\s\S]*ORDER BY id DESC/;
  const falsifs: ReadonlyArray<readonly [string, (p: readonly unknown[]) => Record<string, unknown>[], string]> = [
    ["décision ABSENTE à la relecture", () => [], "NO_PERSISTED_DECISION"],
    ["décision visant une AUTRE version", (p) => [{ id: "999999999", casefile_ref: p[0], claim_id: p[1], claim_version: Number(p[2]) + 1, audience: "PUBLIC", decision: "GRANT", decided_by: "x", decided_at: "2026-09-14T12:00:00Z" }], "DECISION_NOT_LATEST"],
    ["dernière décision = REVOKE", (p) => [{ id: "999999999", casefile_ref: p[0], claim_id: p[1], claim_version: Number(p[2]), audience: "PUBLIC", decision: "REVOKE", decided_by: "x", decided_at: "2026-09-14T12:00:00Z" }], "DECISION_NOT_LATEST"],
  ];
  for (const [nom, rows, causeAttendue] of falsifs) {
    const avant = await etat(c);
    const r = await executeRelease(saboteur(tx, (sql, p) => (RELECTURE.test(sql) ? rows(p) : null)), target, auth);
    const apres = await etat(c);
    const st = (await c.query(`SELECT state::text AS s FROM "CaseFileClaim" WHERE "casefileRef"=$1 AND "claimId"='C1' AND version=2`, [REF])).rows[0].s;
    check(`3d falsifiée · ${nom} → REFUSED, rien ne reste, état ATTACHED`, r.outcome === "REFUSED" && r.refusal.cause === causeAttendue && j(avant) === j(apres) && st === "ATTACHED", `${j(r)} · décisions ${avant.decisions}→${apres.decisions} · state=${st}`);
  }
  // Condition 3 seule : la dernière décision EST celle insérée (même id) mais
  // vaut REVOKE. L'INSERT est intercepté pour rendre un id connu ; rien n'est
  // écrit du tout.
  {
    const avant = await etat(c);
    const r = await executeRelease(saboteur(tx, (sql, p) => {
      if (/INSERT INTO casefile_claim_publication_decisions/.test(sql)) return [{ id: "777" }];
      if (RELECTURE.test(sql)) return [{ id: "777", casefile_ref: p[0], claim_id: p[1], claim_version: Number(p[2]), audience: "PUBLIC", decision: "REVOKE", decided_by: "x", decided_at: "2026-09-14T12:00:00Z" }];
      return null;
    }), target, auth);
    const apres = await etat(c);
    const st = (await c.query(`SELECT state::text AS s FROM "CaseFileClaim" WHERE "casefileRef"=$1 AND "claimId"='C1' AND version=2`, [REF])).rows[0].s;
    check("3d falsifiée · même id, decision = REVOKE → REFUSED/DECISION_NOT_GRANT, rien ne reste, état ATTACHED", r.outcome === "REFUSED" && r.refusal.cause === "DECISION_NOT_GRANT" && j(avant) === j(apres) && st === "ATTACHED", `${j(r)} · state=${st}`);
  }

  // Le contrat au moment de la promotion : une pièce citée perd son sha256.
  {
    await c.query(`SAVEPOINT contrat`);
    await c.query(`UPDATE "CaseFileSource" SET sha256 = NULL WHERE "casefileRef"=$1 AND "sourceId"='SRC-001'`, [REF]);
    const avant = await etat(c);
    const r = await executeRelease(tx, target, auth);
    const apres = await etat(c);
    check("contrat à la promotion · pièce citée sans sha256 → REFUSED/SOURCE_PROVENANCE_INCOMPLETE, décision annulée", r.outcome === "REFUSED" && r.refusal.cause === "SOURCE_PROVENANCE_INCOMPLETE" && j(avant) === j(apres), j(r));
    await c.query(`ROLLBACK TO SAVEPOINT contrat`);
  }
  // Les causes propres à l'exécution de la libération.
  const miss = await executeRelease(tx, { ...target, version: 9 }, auth);
  check("TARGET_MISSING · version 9 inexistante → ABORTED", miss.outcome === "ABORTED" && miss.refusal.cause === "TARGET_MISSING", j(miss));
  const mism = await executeRelease(tx, { ...target, expectedContentHash: "f".repeat(64) }, auth);
  check("SEAL_MISMATCH · sceau attendu ≠ sceau de la ligne → REFUSED", mism.outcome === "REFUSED" && mism.refusal.cause === "SEAL_MISMATCH", j(mism));
  {
    await c.query(`SAVEPOINT casse`);
    await c.query(`UPDATE "CaseFileClaim" SET title = 'modifié en place' WHERE "casefileRef"=$1 AND "claimId"='C1' AND version=2`, [REF]);
    const r = await executeRelease(tx, target, auth);
    check("SEAL_BROKEN · ligne modifiée en place → ABORTED, aucune décision écrite", r.outcome === "ABORTED" && r.refusal.cause === "SEAL_BROKEN" && (await etat(c)).decisions === 0, j(r));
    await c.query(`ROLLBACK TO SAVEPOINT casse`);
  }
  const noAuth = await executeRelease(tx, target, { decidedBy: " ", decidedAt: "2026-09-14T12:00:00Z" });
  check("autorité vide → REFUSED avant toute écriture", noAuth.outcome === "REFUSED" && (await etat(c)).decisions === 0, j(noAuth));

  // TÉMOIN POSITIF de la libération.
  const rel = await executeRelease(tx, target, auth);
  const stFinal = (await c.query(`SELECT state::text AS s FROM "CaseFileClaim" WHERE "casefileRef"=$1 AND "claimId"='C1' AND version=2`, [REF])).rows[0].s;
  const dec = (await c.query(`SELECT id::text AS id, decision, decided_by FROM casefile_claim_publication_decisions WHERE casefile_ref=$1 ORDER BY id DESC LIMIT 1`, [REF])).rows;
  check("TÉMOIN POSITIF · GRANT persisté, relu, promotion → RELEASED, state PUBLIC, 1 décision GRANT", rel.outcome === "RELEASED" && stFinal === "PUBLIC" && dec.length === 1 && dec[0].decision === "GRANT" && dec[0].id === rel.decisionId, `${j(rel)} · state=${stFinal} · ${j(dec)}`);
  const v1st = (await c.query(`SELECT state::text AS s FROM "CaseFileClaim" WHERE "casefileRef"=$1 AND "claimId"='C1' AND version=1`, [REF])).rows[0].s;
  check("  la v1 supplantée reste ATTACHED : la décision vise la version EXACTE", v1st === "ATTACHED");
  const again = await executeRelease(tx, target, auth);
  check("TARGET_NOT_ATTACHED · re-libérer une version déjà PUBLIC → REFUSED, décision annulée", again.outcome === "REFUSED" && again.refusal.cause === "TARGET_NOT_ATTACHED" && (await etat(c)).decisions === 1, j(again));
}

// ─── PGlite : le schéma tel que mesuré en production.
async function schemaPglite(c: Client): Promise<void> {
  await c.query(`CREATE TYPE "DataNature" AS ENUM ('PRIMARY_OBSERVATION','THIRD_PARTY_DATA','INFERENCE','ESTIMATE','EDITORIAL_ASSERTION','UNCLASSIFIED')`);
  await c.query(`CREATE TYPE "ArtifactState" AS ENUM ('ATTACHED','ADMISSIBLE','PUBLIC')`);
  await c.query(`CREATE TYPE "ExclusionReason" AS ENUM ('EXCLUDED_FROM_PUBLICATION','INSUFFICIENT_PROVENANCE')`);
  await c.query(`CREATE TABLE token_casefiles (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, ref text NOT NULL UNIQUE, codename text NOT NULL, ticker text NOT NULL, title text NOT NULL, family text NOT NULL, subtype text NOT NULL, verdict text NOT NULL, status text NOT NULL, "primaryChain" text NOT NULL)`);
  await c.query(`CREATE TABLE "EvidenceSnapshot" (id text PRIMARY KEY, "relationType" text NOT NULL, "relationKey" text NOT NULL, "snapshotType" text NOT NULL, title text NOT NULL, caption text NOT NULL, "sourceUrl" text, "observedAt" timestamptz, sha256 text, "canonicalMint" text)`);
  await c.query(`CREATE UNIQUE INDEX "EvidenceSnapshot_sha256_key" ON "EvidenceSnapshot" (sha256)`);
  await c.query(`CREATE TABLE "CaseFileSource" (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, "casefileRef" text NOT NULL REFERENCES token_casefiles(ref) ON DELETE RESTRICT, "sourceId" text NOT NULL, "sourceType" text NOT NULL, filename text, caption text, "capturedAt" timestamptz, "sourceUrl" text, sha256 text, "snapshotId" text REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "CaseFileSource_ref_sourceid_key" UNIQUE ("casefileRef","sourceId"))`);
  await c.query(`CREATE TABLE "CaseFileClaim" (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "casefileRef" text NOT NULL REFERENCES token_casefiles(ref) ON DELETE RESTRICT,
    "claimId" text NOT NULL, title text NOT NULL, "titleFr" text, description text, "descriptionFr" text,
    category text, severity text, status text, "claimDate" date, actors jsonb, "threadUrl" text,
    "evidenceRefs" jsonb NOT NULL DEFAULT '[]'::jsonb, "rowNature" "DataNature", "natureBasis" jsonb, "methodRef" text,
    state "ArtifactState" NOT NULL DEFAULT 'ATTACHED', "exclusionReason" "ExclusionReason", "excludedField" text,
    version integer NOT NULL DEFAULT 1, supersedes text REFERENCES "CaseFileClaim"(id) ON DELETE SET NULL, "contentHash" text,
    "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "CaseFileClaim_ref_claimid_version_key" UNIQUE ("casefileRef","claimId",version),
    CONSTRAINT "CaseFileClaim_estimate_auditable" CHECK (("rowNature" IS DISTINCT FROM 'ESTIMATE') OR ("methodRef" IS NOT NULL) OR (("natureBasis" IS NOT NULL) AND ("natureBasis" <> '{}'::jsonb))),
    CONSTRAINT "CaseFileClaim_exclusion_names_field" CHECK (("exclusionReason" IS NULL) OR (("excludedField" IS NOT NULL) AND ("excludedField" !~ '[0-9]{3,}'))),
    CONSTRAINT "CaseFileClaim_public_requires_provenance" CHECK ((state <> 'PUBLIC') OR (("rowNature" IS NOT NULL) AND ("rowNature" <> 'UNCLASSIFIED') AND (jsonb_array_length("evidenceRefs") > 0)))
  )`);
  if (!c.exec) throw new Error("le DDL exige exec()");
  await c.exec(DDL);
}

async function main(): Promise<number> {
  if (MODE_PG17) {
    const env = readFileSync(path.join(REPO, ".env.local"), "utf8");
    const m = env.match(/^DATABASE_URL="?([^"\n]+)"?$/m);
    if (!m) { console.error("DATABASE_URL absente de .env.local"); return 1; }
    // `pg` est présent dans node_modules sans déclaration de types : spécificateur
    // calculé pour que tsc ne tente pas de le résoudre.
    const pgSpec = "pg";
    const pg = (await import(pgSpec)).default as { Client: new (o: { connectionString: string }) => { connect(): Promise<void>; end(): Promise<void>; query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> } };
    const client = new pg.Client({ connectionString: m[1] });
    await client.connect();
    const c: Client = { query: (sql, params) => client.query(sql, params as unknown[]) };
    const empreinte = async () => ({
      claims: (await c.query(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileClaim" t`)).rows[0],
      sources: (await c.query(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileSource" t`)).rows[0],
      decisions: (await c.query(`SELECT count(*)::int AS n FROM casefile_claim_publication_decisions`)).rows[0].n,
      dossiers: (await c.query(`SELECT count(*)::int AS n FROM token_casefiles`)).rows[0].n,
    });
    try {
      const v = (await c.query("SELECT version()")).rows[0].version;
      console.log(`MODE PG17 RÉEL, TRANSACTION ANNULÉE · ${String(v).split(",")[0]}`);
      const avant = await empreinte();
      console.log("AVANT  ", j(avant));
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      try {
        await fixture(c);
        await scenarios(c);
      } finally {
        await c.query("ROLLBACK");
      }
      const apres = await empreinte();
      console.log("APRÈS  ", j(apres));
      const intact = j(avant) === j(apres);
      check("NON-DESTRUCTION · CaseFileClaim, CaseFileSource, décisions, dossiers : comptes et md5 IDENTIQUES après ROLLBACK", intact);
      const seq = (await c.query(`SELECT last_value FROM pg_sequences WHERE schemaname='public' AND sequencename='casefile_claim_publication_decisions_id_seq'`)).rows[0];
      console.log(`séquence id de la table de décisions : last_value=${seq.last_value} (trous consommés par les essais annulés : normal)`);
    } finally {
      await client.end();
    }
  } else {
    const modPath = process.env.PGLITE_PATH ?? "@electric-sql/pglite";
    const { PGlite } = await import(modPath);
    const db = new PGlite();
    const v = (await db.query("select version()")).rows[0].version;
    console.log(`MODE POSTGRES JETABLE (PGlite) · ${String(v).split(",")[0]}`);
    const c: Client = { query: (sql, params) => db.query(sql, params as unknown[]), exec: (sql) => db.exec(sql) };
    await schemaPglite(c);
    await c.query("BEGIN");
    await fixture(c);
    await scenarios(c);
    await c.query("COMMIT");
    const final = await etat(c);
    console.log("état final du dossier synthétique (commité dans le jetable) :", j(final));
    await db.close();
  }
  console.log("\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko}`);
  return ko === 0 ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { console.error(e); process.exitCode = 1; });
