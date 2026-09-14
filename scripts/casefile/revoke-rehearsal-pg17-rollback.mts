// ─── T1-REVOKE-ELIGIBILITY — RÉPÉTITION À BLANC DU REVOKE, EN PRODUCTION, ANNULÉE ──
//
// ██  Rien de ce que ce script écrit ne survit : UNE transaction, ROLLBACK.  ██
//
//   npx tsx scripts/casefile/revoke-rehearsal-pg17-rollback.mts
//
// Contre la PRODUCTION (DATABASE_URL de .env.local), ouvre UNE transaction
// REPEATABLE READ, exécute `executeRevoke` sur les trois claims
// VINE-0xS-01/02/03 v2 (cause INSUFFICIENT_SOURCE_PROVENANCE), vérifie DANS la
// transaction : 3 INSERT REVOKE, 3 UPDATE d'une ligne chacun, sceaux v2 et v1
// strictement inchangés, v1 toujours ATTACHED. Puis ROLLBACK, puis relecture :
// la table de décisions revenue à ses 3 GRANT (ids 16/17/18), les 3 v2 encore
// PUBLIC, empreintes md5 de CaseFileClaim / CaseFileSource identiques.
//
// `decided_by` est un MARQUEUR SYNTHÉTIQUE ici — jamais le nom du fondateur :
// le vrai REVOKE portera son nom, sur son autorisation, et pas dans ce script.
//
// Effet de bord CONNU et déclaré : les 3 INSERT consomment 3 valeurs de la
// séquence `casefile_claim_publication_decisions_id_seq` même annulés (une
// séquence n'est pas transactionnelle). Les trous sont normaux — seul l'ordre
// compte (DDL SPINE-00 · A).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeRevoke, type SqlRunner, type SqlTransactor } from "@/lib/casefile/governedExecutor";
import { decidePublicRelease, attestPersistedDecision, type ReleaseTargetRow } from "@/lib/casefile/governedWriter";
import { readProvenanceKind } from "@/lib/casefile/provenanceKind";
import { isSealIntact } from "@/lib/casefile/sealGuard";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF = "IL-SHILL-VINE-001";
const CLAIMS = ["VINE-0xS-01", "VINE-0xS-02", "VINE-0xS-03"] as const;
const SCEAUX_V2 = { "VINE-0xS-01": "9074c4c7", "VINE-0xS-02": "2f6f77bf", "VINE-0xS-03": "8ed3499d" } as const;
const SCEAUX_V1 = { "VINE-0xS-01": "7fef4ea0", "VINE-0xS-02": "10578c68", "VINE-0xS-03": "5f47e9f9" } as const;
const AUTH = { decidedBy: "repetition-a-blanc-T1", decidedAt: "2026-09-14T16:00:00Z" };

interface Client { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => { if (!ok) ko++; lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? " · " + detail : ""}`); };
const j = (x: unknown) => JSON.stringify(x);

/** Un SAVEPOINT par appel, dans la transaction externe que main() annule. Journalise les UPDATE et leur rowCount. */
let sp = 0;
const updates: Array<{ sql: string; rowCount: number | null }> = [];
const inserts: string[] = [];
function transactor(c: Client): SqlTransactor {
  return {
    async transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T> {
      const name = `sp_${++sp}`;
      await c.query(`SAVEPOINT ${name}`);
      const db: SqlRunner = {
        query: async (sql, params = []) => {
          const r = await c.query(sql, params as unknown[]);
          if (/^\s*UPDATE/.test(sql)) updates.push({ sql: sql.replace(/\s+/g, " ").trim(), rowCount: r.rowCount });
          if (/^\s*INSERT INTO casefile_claim_publication_decisions/.test(sql)) inserts.push(String(r.rows[0]?.id));
          return r.rows as never;
        },
      };
      try { const out = await fn(db); await c.query(`RELEASE SAVEPOINT ${name}`); return out; }
      catch (e) { await c.query(`ROLLBACK TO SAVEPOINT ${name}`); throw e; }
    },
  };
}

async function etatClaims(c: Client) {
  return (await c.query(
    `SELECT "claimId", version, state::text AS state, "contentHash", "updatedAt"::text AS "updatedAt", supersedes, title, "evidenceRefs"
       FROM "CaseFileClaim" WHERE "casefileRef" = $1 AND "claimId" = ANY($2) ORDER BY "claimId", version`,
    [REF, [...CLAIMS]],
  )).rows as Array<{ claimId: string; version: number; state: string; contentHash: string; updatedAt: string; supersedes: string | null; title: string }>;
}
async function empreinte(c: Client) {
  return {
    claims: (await c.query(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileClaim" t`)).rows[0],
    sources: (await c.query(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileSource" t`)).rows[0],
    decisions: (await c.query(`SELECT count(*)::int AS n, string_agg(id::text || ':' || decision, ',' ORDER BY id) AS ids FROM casefile_claim_publication_decisions`)).rows[0],
    seq: (await c.query(`SELECT last_value::text AS v FROM casefile_claim_publication_decisions_id_seq`)).rows[0].v,
  };
}

async function main(): Promise<number> {
  const env = readFileSync(path.join(REPO, ".env.local"), "utf8");
  const m = env.match(/^DATABASE_URL="?([^"\n]+)"?$/m);
  if (!m) { console.error("DATABASE_URL absente de .env.local"); return 1; }
  const pgSpec = "pg";
  const pg = (await import(pgSpec)).default as { Client: new (o: { connectionString: string }) => { connect(): Promise<void>; end(): Promise<void>; query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> } };
  const client = new pg.Client({ connectionString: m[1] });
  await client.connect();
  const c: Client = { query: (sql, params) => client.query(sql, params as unknown[]) };
  try {
    console.log(`RÉPÉTITION À BLANC · ${String((await c.query("SELECT version()")).rows[0].version).split(",")[0]} · ${(await c.query("SELECT current_database() AS d")).rows[0].d}`);
    const avant = await empreinte(c);
    console.log("AVANT  ", j(avant));

    // ── Le point de départ, mesuré.
    const depart = await etatClaims(c);
    for (const id of CLAIMS) {
      const v2 = depart.find((r) => r.claimId === id && r.version === 2);
      const v1 = depart.find((r) => r.claimId === id && r.version === 1);
      check(`${id} v2 est PUBLIC, sceau ${SCEAUX_V2[id]}…`, !!v2 && v2.state === "PUBLIC" && v2.contentHash.startsWith(SCEAUX_V2[id]), v2 ? `${v2.state} ${v2.contentHash.slice(0, 8)}` : "absent");
      check(`${id} v1 est ATTACHED, sceau ${SCEAUX_V1[id]}…`, !!v1 && v1.state === "ATTACHED" && v1.contentHash.startsWith(SCEAUX_V1[id]), v1 ? `${v1.state} ${v1.contentHash.slice(0, 8)}` : "absent");
    }
    // ── L'éligibilité de publication, telle que le code la lit AUJOURD'HUI sur ces pièces.
    const pieces = (await c.query(`SELECT "sourceId", "sourceType", caption, "capturedAt"::text AS "capturedAt", "sourceUrl", sha256, ("snapshotId" IS NOT NULL) AS "evidenceLinked" FROM "CaseFileSource" WHERE "casefileRef" = $1`, [REF])).rows as Array<Record<string, unknown> & { sourceId: string; sha256: string | null }>;
    const registre = new Map(pieces.map((s) => [s.sourceId, { ...s, provenanceKind: readProvenanceKind({ sourceId: s.sourceId, sha256: s.sha256 }) }] as const));
    for (const [id, s] of registre) lignes.push(`   pièce ${id} · provenanceKind lue = ${s.provenanceKind}`);
    for (const id of CLAIMS) {
      const v2 = depart.find((r) => r.claimId === id && r.version === 2)!;
      const row: ReleaseTargetRow = { casefileRef: REF, claimId: id, version: 2, state: "ATTACHED", contentHash: v2.contentHash, rowNature: "PRIMARY_OBSERVATION", evidenceRefs: (v2 as unknown as { evidenceRefs: unknown }).evidenceRefs };
      const grantFictif = attestPersistedDecision({ id: "0", casefileRef: REF, claimId: id, claimVersion: 2, audience: "PUBLIC", decision: "GRANT", decidedBy: "x", decidedAt: "2026-09-14T00:00:00Z" });
      const d = decidePublicRelease({ casefileRef: REF, claimId: id, version: 2, expectedContentHash: v2.contentHash, audience: "PUBLIC" }, row, registre as never, grantFictif, "0");
      check(`(b) ${id} v2 ne serait PLUS libérable aujourd'hui → ${d.decision === "REFUSED" ? d.refusal.cause + " @ " + d.refusal.at : d.decision}`, d.decision === "REFUSED" && d.refusal.cause === "SOURCE_PROVENANCE_NOT_VERIFIED");
    }

    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    try {
      const tx = transactor(c);
      // ── e) d'abord : révoquer une v1 ATTACHED refuse, zéro ligne.
      const v1 = depart.find((r) => r.claimId === "VINE-0xS-01" && r.version === 1)!;
      const e = await executeRevoke(tx, { casefileRef: REF, claimId: "VINE-0xS-01", version: 1, expectedContentHash: v1.contentHash, audience: "PUBLIC", cause: "INSUFFICIENT_SOURCE_PROVENANCE" }, AUTH);
      const decApresE = (await c.query(`SELECT count(*)::int AS n FROM casefile_claim_publication_decisions`)).rows[0].n;
      check("(e) REVOKE sur VINE-0xS-01 v1 (ATTACHED) → REFUSED/TARGET_NOT_PUBLIC, décision annulée, table à 3", e.outcome === "REFUSED" && e.refusal.cause === "TARGET_NOT_PUBLIC" && Number(decApresE) === 3, `${j(e)} · décisions=${decApresE}`);
      updates.length = 0; inserts.length = 0;

      // ── Les trois REVOKE.
      const resultats = [] as unknown[];
      for (const id of CLAIMS) {
        const v2 = depart.find((r) => r.claimId === id && r.version === 2)!;
        const r = await executeRevoke(tx, { casefileRef: REF, claimId: id, version: 2, expectedContentHash: v2.contentHash, audience: "PUBLIC", cause: "INSUFFICIENT_SOURCE_PROVENANCE" }, AUTH);
        resultats.push(r);
        check(`REVOKE ${id} v2 → ${r.outcome}${r.outcome === "REVOKED" ? " décision #" + r.decisionId + " cause " + r.cause : " " + j(r)}`, r.outcome === "REVOKED" && r.cause === "INSUFFICIENT_SOURCE_PROVENANCE");
      }
      check("3 INSERT REVOKE, 3 ids distincts et croissants", inserts.length === 3 && new Set(inserts).size === 3 && inserts.every((x, i) => i === 0 || BigInt(x) > BigInt(inserts[i - 1])), inserts.join(","));
      check("3 UPDATE, 1 ligne affectée chacun, SET limité à state + updatedAt", updates.length === 3 && updates.every((u) => u.rowCount === 1 && /SET state = 'ATTACHED'::"ArtifactState", "updatedAt" = now\(\) WHERE/.test(u.sql)), updates.map((u) => u.rowCount).join(","));

      // ── L'état DANS la transaction.
      const dedans = await etatClaims(c);
      const decisions = (await c.query(`SELECT id::text AS id, claim_id, claim_version, decision, decided_by FROM casefile_claim_publication_decisions WHERE casefile_ref = $1 ORDER BY id`, [REF])).rows;
      check("dans la transaction : 6 décisions (3 GRANT 16/17/18 puis 3 REVOKE), les GRANT intacts", decisions.length === 6 && decisions.slice(0, 3).every((d, i) => d.id === String(16 + i) && d.decision === "GRANT" && d.decided_by === "David Douville") && decisions.slice(3).every((d) => d.decision === "REVOKE" && d.decided_by === AUTH.decidedBy), j(decisions.map((d) => `${d.id}:${d.claim_id}v${d.claim_version}:${d.decision}`)));
      for (const id of CLAIMS) {
        const v2a = depart.find((r) => r.claimId === id && r.version === 2)!;
        const v2 = dedans.find((r) => r.claimId === id && r.version === 2)!;
        const v1a = depart.find((r) => r.claimId === id && r.version === 1)!;
        const v1 = dedans.find((r) => r.claimId === id && r.version === 1)!;
        check(`  ${id} v2 → ATTACHED, sceau ${SCEAUX_V2[id]}… inchangé, intact, contenu identique`, v2.state === "ATTACHED" && v2.contentHash === v2a.contentHash && v2.title === v2a.title && v2.supersedes === v2a.supersedes && isSealIntact({ ...(v2 as unknown as Record<string, unknown>), claimDate: null } as never) === isSealIntact({ ...(v2a as unknown as Record<string, unknown>), claimDate: null } as never), `${v2.state} ${v2.contentHash.slice(0, 8)}`);
        check(`  ${id} v1 intacte : ATTACHED, sceau ${SCEAUX_V1[id]}…, updatedAt inchangé`, v1.state === "ATTACHED" && v1.contentHash === v1a.contentHash && v1.updatedAt === v1a.updatedAt, `${v1.state} ${v1.contentHash.slice(0, 8)}`);
      }
      // ── Idempotence négative : re-révoquer une ligne déjà ATTACHED refuse.
      const again = await executeRevoke(tx, { casefileRef: REF, claimId: "VINE-0xS-01", version: 2, expectedContentHash: depart.find((r) => r.claimId === "VINE-0xS-01" && r.version === 2)!.contentHash, audience: "PUBLIC", cause: "INSUFFICIENT_SOURCE_PROVENANCE" }, AUTH);
      check("re-REVOKE de VINE-0xS-01 v2 (déjà ATTACHED) → REFUSED/TARGET_NOT_PUBLIC, rien de plus écrit", again.outcome === "REFUSED" && again.refusal.cause === "TARGET_NOT_PUBLIC" && (await c.query(`SELECT count(*)::int AS n FROM casefile_claim_publication_decisions`)).rows[0].n === 6);
    } finally {
      await c.query("ROLLBACK");
    }

    // ── Après ROLLBACK : rien n'a survécu.
    const apres = await empreinte(c);
    console.log("APRÈS  ", j(apres));
    const final = await etatClaims(c);
    check("APRÈS ROLLBACK · les 3 v2 sont toujours PUBLIC, les 3 v1 ATTACHED, sceaux identiques", CLAIMS.every((id) => final.find((r) => r.claimId === id && r.version === 2)!.state === "PUBLIC" && final.find((r) => r.claimId === id && r.version === 1)!.state === "ATTACHED") && j(final) === j(depart));
    check("APRÈS ROLLBACK · table de décisions : 3 lignes, 16:GRANT,17:GRANT,18:GRANT", apres.decisions.n === 3 && apres.decisions.ids === "16:GRANT,17:GRANT,18:GRANT", j(apres.decisions));
    check("APRÈS ROLLBACK · CaseFileClaim et CaseFileSource : comptes et md5 IDENTIQUES", j(avant.claims) === j(apres.claims) && j(avant.sources) === j(apres.sources));
    lignes.push(`   séquence id : ${avant.seq} → ${apres.seq} (valeurs consommées par les INSERT annulés — non transactionnel, déclaré)`);
  } finally {
    await client.end();
  }
  console.log("\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko}`);
  return ko === 0 ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { console.error(e); process.exitCode = 1; });
