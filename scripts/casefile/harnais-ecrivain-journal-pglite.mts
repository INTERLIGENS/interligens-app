// ─── T1-INSCRIPTION-QUALIFICATIONS-VINE — LE HARNAIS DE L'ÉCRIVAIN ─────────
//
// ██  Le TYPE est la règle, le CHECK est le filet. On prouve LES DEUX, et  ██
// ██  on prouve qu'ils disent la même chose.                               ██
//
//   PGLITE_PATH=/chemin/vers/@electric-sql/pglite/dist/index.js \
//   npx tsx scripts/casefile/harnais-ecrivain-journal-pglite.mts
//
// Postgres JETABLE en WASM (PGlite), le DDL RÉEL du journal rejoué tel quel.
// RIEN ne touche la production. PGlite n'est pas une dépendance du dépôt :
// PGLITE_PATH doit pointer sur une installation locale.
//
// LES SEPT PREUVES, exercées là où elles veulent dire quelque chose :
//
//   a) une qualification OPERATOR_DECLARED valide s'inscrit et se relit
//      identique — par `recordQualification`, contre un vrai Postgres
//   b) VERIFIED sans les trois champs → REFUSÉ par le module AVANT la base,
//      et la table reste vide (aucune séquence consommée)
//   c) VERIFIED sur QUERY_CONTEXT → refusé par le module, cause nommée ; ET le
//      CHECK `verified_not_query_context` refuse le même couple en SQL brut
//   d) un evidence_snapshot_id inexistant → 23503, transaction annulée, table
//      inchangée
//   e) un source_url avec un blanc → refusé par le module ; ET le CHECK
//      `source_url_form_by_kind` refuse le même en SQL brut → 23514
//   f) les triggers append-only refusent UPDATE, DELETE et TRUNCATE (23001 /
//      restrict_violation) — c'est ce qui rend l'écriture IRRÉVERSIBLE, et donc
//      ce qui justifie qu'aucun chemin du module ne les porte
//   g) MUTANT : l'INSERT du module réécrit avec `now()` sur declared_at →
//      la relecture ABORTE (READBACK_MISMATCH). Le mutant est appliqué ICI,
//      sur une copie du gabarit, jamais dans src/.
//
// PLUS : l'ÉQUIVALENCE des deux moteurs de forme. Le motif TypeScript de
// `formeLocalisateurAdmise` et le CHECK SQL sont rejoués sur le MÊME corpus ;
// un désaccord rougit. Sans cela, « le type est la règle » ne serait qu'une
// intention.
//
// Sortie : 0 si chaque scénario a fait ce qu'on attendait de lui, 1 sinon.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  recordQualification,
  formeLocalisateurAdmise,
  type JournalSqlTransactor,
  type QualificationIntent,
} from "@/lib/casefile/journalWriter";
import { readJournalProvenance, type JournalSqlRunner } from "@/lib/casefile/journalProvenance";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DDL = readFileSync(path.join(REPO, "docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql"), "utf8");

const modPath = process.env.PGLITE_PATH;
if (!modPath) {
  console.error(
    "UNABLE : PGLITE_PATH absent. PGlite n'est pas une dépendance du dépôt ; pointer sur une installation locale (…/@electric-sql/pglite/dist/index.js).",
  );
  process.exit(1);
}
const { PGlite } = await import(modPath);

const SNAP_A = "34f4068a-57d8-45c5-9c8a-47b29b931e1b";
const SNAP_B = "f24e3252-7d16-41a3-8253-eb0c1be67654";
const SNAP_TEMOIN = "temoin-sans-journal";
const SHA_A = "8c55dd83065ced33dbfd17a71c65f37df2ce366e2d8d4688399a27b5de39ace3";
const LOCATEUR = "https://x.com/search?q=from:0xSweep%20VINE";
const LU_EN_BASE = "https://x.com/search?q=from:0xSweep VINE";

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => {
  if (!ok) ko++;
  lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? " · " + detail : ""}`);
};
const j = (x: unknown) => JSON.stringify(x);

interface Db {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

/** Un Postgres neuf, le DDL réel posé, trois pièces référençables. */
async function jetable(): Promise<Db> {
  const db = new PGlite();
  await db.exec(`CREATE TABLE "EvidenceSnapshot" (id text PRIMARY KEY, sha256 text, "sourceUrl" text)`);
  await db.exec(
    `INSERT INTO "EvidenceSnapshot" VALUES
       ('${SNAP_A}', '${SHA_A}', '${LU_EN_BASE}'),
       ('${SNAP_B}', '${"c".repeat(64)}', '${LU_EN_BASE}'),
       ('${SNAP_TEMOIN}', NULL, NULL)`,
  );
  await db.exec(DDL);
  return db as Db;
}

/** Le SQLSTATE d'une instruction, ou "OK". */
async function sqlstate(db: Db, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await db.query(sql, params);
    return "OK";
  } catch (e) {
    return String((e as { code?: string }).code ?? (e as Error).message);
  }
}

/**
 * Le transactor de test : UNE transaction réelle, COMMIT si `fn` rend,
 * ROLLBACK si elle lève. `gabarit` permet au MUTANT (g) de réécrire l'INSERT
 * SANS toucher à src/.
 */
function transactor(db: Db, gabarit?: (sql: string) => string): JournalSqlTransactor {
  return {
    async transaction<T>(fn: (d: JournalSqlRunner) => Promise<T>): Promise<T> {
      await db.query("BEGIN");
      const runner: JournalSqlRunner = {
        query: async <R extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) =>
          (await db.query(gabarit ? gabarit(sql) : sql, params as unknown[])).rows as R[],
      };
      try {
        const out = await fn(runner);
        await db.query("COMMIT");
        return out;
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
    },
  };
}

const compter = async (db: Db) =>
  Number(((await db.query(`SELECT count(*)::int AS n FROM evidence_provenance_journal`)).rows[0] as { n: number }).n);

const declaree = (o: Partial<QualificationIntent> = {}): QualificationIntent =>
  ({
    provenanceKind: "OPERATOR_DECLARED",
    evidenceSnapshotId: SNAP_A,
    referenceKind: "QUERY_CONTEXT",
    sourceLocator: LOCATEUR,
    sha256: SHA_A,
    declaredBy: "David Douville",
    declaredAt: "2026-09-15T07:30:00.000Z",
    ...o,
  }) as QualificationIntent;

// ═══ (a) L'INSCRIPTION, CONTRE UN VRAI POSTGRES ═════════════════════════════
{
  const db = await jetable();
  const tx = transactor(db);
  const out = await recordQualification(tx, declaree());
  check("(a) OPERATOR_DECLARED valide → RECORDED", out.outcome === "RECORDED", j(out));
  if (out.outcome === "RECORDED") {
    check("(a) la ligne relue porte EXACTEMENT ce qui a été déclaré",
      out.row.provenanceKind === "OPERATOR_DECLARED" &&
      out.row.referenceKind === "QUERY_CONTEXT" &&
      out.row.sourceLocator === LOCATEUR &&
      out.row.sha256 === SHA_A &&
      out.row.declaredBy === "David Douville" &&
      new Date(out.row.declaredAt).toISOString() === "2026-09-15T07:30:00.000Z" &&
      out.row.verifiedBy === null && out.row.verifiedAt === null && out.row.verificationMethod === null,
      j(out.row));
    check("(a) declared_at ≠ recorded_at : l'instant DÉCLARÉ n'est pas l'horloge de la base",
      new Date(out.row.declaredAt).getTime() !== new Date(out.row.recordedAt).getTime(),
      `déclaré ${out.row.declaredAt} · enregistré ${out.row.recordedAt}`);
  }
  check("(a) la table porte 1 ligne", (await compter(db)) === 1);

  // Le LECTEUR construit hier, sur la même base : il doit voir la qualification.
  const runner: JournalSqlRunner = { query: async (sql, p = []) => (await db.query(sql, p as unknown[])).rows as never };
  const lu = await readJournalProvenance(runner, [
    { sourceId: "SRC-0xS-09", snapshotId: SNAP_A, sha256: SHA_A },
    { sourceId: "TEMOIN", snapshotId: SNAP_TEMOIN, sha256: null },
    { sourceId: "SANS-PONT", snapshotId: null, sha256: SHA_A },
  ]);
  check("(a) le LECTEUR rend OPERATOR_DECLARED sur la pièce inscrite",
    lu.get("SRC-0xS-09")?.kind === "OPERATOR_DECLARED", j(lu.get("SRC-0xS-09")));
  check("(a) le LECTEUR rend UNKNOWN/NO_JOURNAL_ENTRY sur une pièce sans ligne",
    j(lu.get("TEMOIN")) === j({ kind: "UNKNOWN", derived: true, cause: "NO_JOURNAL_ENTRY", journalId: null }), j(lu.get("TEMOIN")));
  check("(a) le LECTEUR rend UNKNOWN/NO_SNAPSHOT_LINK sans pont, MALGRÉ un sha256 concordant",
    j(lu.get("SANS-PONT")) === j({ kind: "UNKNOWN", derived: true, cause: "NO_SNAPSHOT_LINK", journalId: null }), j(lu.get("SANS-PONT")));

  // La REQUALIFICATION : une nouvelle ligne, jamais un UPDATE.
  const encore = await recordQualification(tx, declaree({ declaredAt: "2026-09-15T08:00:00.000Z" }));
  check("(a) requalifier = une NOUVELLE ligne, d'id supérieur",
    encore.outcome === "RECORDED" && out.outcome === "RECORDED" && BigInt(encore.row.journalId) > BigInt(out.row.journalId),
    j(encore.outcome === "RECORDED" ? encore.row.journalId : encore));
  check("(a) la table porte 2 lignes : l'ancienne qualification reste LISIBLE", (await compter(db)) === 2);
  const relu = await readJournalProvenance(runner, [{ sourceId: "SRC-0xS-09", snapshotId: SNAP_A, sha256: SHA_A }]);
  const q = relu.get("SRC-0xS-09");
  check("(a) le lecteur rend la DERNIÈRE, par max(id)",
    q?.derived === false && encore.outcome === "RECORDED" && q.journalId === encore.row.journalId, j(q));
  await db.close();
}

// ═══ (b) VERIFIED SANS LES TROIS CHAMPS ═════════════════════════════════════
{
  const db = await jetable();
  const tx = transactor(db);
  const out = await recordQualification(tx, {
    provenanceKind: "VERIFIED",
    evidenceSnapshotId: SNAP_A,
    referenceKind: "PUBLICATION",
    sourceLocator: "https://x.com/0xSweep/status/1846000000000000000",
    sha256: SHA_A,
    declaredBy: "David Douville",
    declaredAt: "2026-09-15T07:30:00.000Z",
  } as unknown as QualificationIntent);
  check("(b) VERIFIED sans les trois champs → REFUSED/VERIFICATION_REQUIRED",
    out.outcome === "REFUSED" && out.refusal.cause === "VERIFICATION_REQUIRED", j(out));
  check("(b) la table est restée VIDE : la base n'a jamais été atteinte", (await compter(db)) === 0);
  const seq = (await db.query(`SELECT last_value::text AS v, is_called FROM evidence_provenance_journal_id_seq`)).rows[0];
  check("(b) AUCUNE valeur de séquence consommée — le refus est AVANT l'INSERT", j(seq) === j({ v: "1", is_called: false }), j(seq));

  // Le FILET : le même couple, posé en SQL brut, est refusé par le CHECK.
  const code = await sqlstate(db,
    `INSERT INTO evidence_provenance_journal (evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at)
     VALUES ($1, 'VERIFIED', 'PUBLICATION', 'https://x.com/a/status/1', 'D', now())`, [SNAP_A]);
  check("(b) FILET · le même INSERT en SQL brut est refusé par le CHECK verified_iff_verification → 23514", code === "23514", code);
  await db.close();
}

// ═══ (c) VERIFIED SUR QUERY_CONTEXT — LA RÈGLE, PUIS LE FILET ══════════════
{
  const db = await jetable();
  const tx = transactor(db);
  const out = await recordQualification(tx, {
    provenanceKind: "VERIFIED",
    evidenceSnapshotId: SNAP_A,
    referenceKind: "QUERY_CONTEXT",
    sourceLocator: LOCATEUR,
    sha256: SHA_A,
    declaredBy: "David Douville",
    declaredAt: "2026-09-15T07:30:00.000Z",
    verification: { by: "David Douville", at: "2026-09-15T08:00:00Z", method: "URL_MATCHES_CAPTURED_POST" },
  } as unknown as QualificationIntent);
  check("(c) VERIFIED + QUERY_CONTEXT → REFUSED/VERIFIED_QUERY_CONTEXT_FORBIDDEN",
    out.outcome === "REFUSED" && out.refusal.cause === "VERIFIED_QUERY_CONTEXT_FORBIDDEN", j(out));
  check("(c) la table est restée VIDE", (await compter(db)) === 0);

  const code = await sqlstate(db,
    `INSERT INTO evidence_provenance_journal
       (evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at,
        verified_by, verified_at, verification_method)
     VALUES ($1, 'VERIFIED', 'QUERY_CONTEXT', $2, 'D', now(), 'D', now(), 'URL_MATCHES_CAPTURED_POST')`,
    [SNAP_A, LOCATEUR]);
  check("(c) FILET · le CHECK verified_not_query_context refuse le même couple en SQL brut → 23514", code === "23514", code);
  check("(c) et la table est TOUJOURS vide", (await compter(db)) === 0);
  await db.close();
}

// ═══ (d) UNE PIÈCE INEXISTANTE → 23503, RIEN NE RESTE ══════════════════════
{
  const db = await jetable();
  const tx = transactor(db);
  let code = "AUCUNE ERREUR";
  try {
    await recordQualification(tx, declaree({ evidenceSnapshotId: "cette-piece-n-existe-pas" }));
  } catch (e) {
    code = String((e as { code?: string }).code ?? (e as Error).message);
  }
  check("(d) evidence_snapshot_id inexistant → 23503 REMONTE, non traduit en refus gouverné", code === "23503", code);
  check("(d) la transaction n'a rien laissé : table vide", (await compter(db)) === 0);
  const apres = await recordQualification(tx, declaree());
  check("(d) et la connexion reste utilisable : l'inscription suivante passe", apres.outcome === "RECORDED", j(apres.outcome));
  await db.close();
}

// ═══ (e) UN BLANC DANS LE LOCALISATEUR — LA RÈGLE, PUIS LE FILET ═══════════
{
  const db = await jetable();
  const tx = transactor(db);
  const out = await recordQualification(tx, declaree({ sourceLocator: LU_EN_BASE }));
  check("(e) la valeur RÉELLE lue en base (espace avant VINE) → REFUSED/MALFORMED_LOCATOR",
    out.outcome === "REFUSED" && out.refusal.cause === "MALFORMED_LOCATOR", j(out));
  check("(e) la table est restée VIDE", (await compter(db)) === 0);

  const code = await sqlstate(db,
    `INSERT INTO evidence_provenance_journal (evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at)
     VALUES ($1, 'OPERATOR_DECLARED', 'QUERY_CONTEXT', $2, 'D', now())`, [SNAP_A, LU_EN_BASE]);
  check("(e) FILET · le CHECK source_url_form_by_kind refuse le même en SQL brut → 23514", code === "23514", code);

  const bord = await sqlstate(db,
    `INSERT INTO evidence_provenance_journal (evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at)
     VALUES ($1, 'OPERATOR_DECLARED', 'QUERY_CONTEXT', $2, 'D', now())`, [SNAP_A, ` ${LOCATEUR} `]);
  check("(e) FILET · un localisateur bordé de blancs → 23514 aussi", bord === "23514", bord);

  const bon = await sqlstate(db,
    `INSERT INTO evidence_provenance_journal (evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at)
     VALUES ($1, 'OPERATOR_DECLARED', 'QUERY_CONTEXT', $2, 'D', now())`, [SNAP_A, LOCATEUR]);
  check("(e) la forme CANONIQUE (%20) passe le CHECK", bon === "OK", bon);
  await db.close();
}

// ═══ (f) L'APPEND-ONLY EN BASE — CE QUI REND L'ÉCRITURE IRRÉVERSIBLE ═══════
{
  const db = await jetable();
  const tx = transactor(db);
  const out = await recordQualification(tx, declaree());
  const id = out.outcome === "RECORDED" ? out.row.journalId : "0";
  const u = await sqlstate(db, `UPDATE evidence_provenance_journal SET declared_by = 'autre' WHERE id = $1::bigint`, [id]);
  const d = await sqlstate(db, `DELETE FROM evidence_provenance_journal WHERE id = $1::bigint`, [id]);
  const t = await sqlstate(db, `TRUNCATE evidence_provenance_journal`);
  check("(f) UPDATE sur une ligne inscrite → refusé (restrict_violation 2F004/23001-like)", u !== "OK", u);
  check("(f) DELETE sur une ligne inscrite → refusé", d !== "OK", d);
  check("(f) TRUNCATE de la table → refusé", t !== "OK", t);
  check("(f) la ligne est TOUJOURS là, inchangée",
    (await compter(db)) === 1 &&
      ((await db.query(`SELECT declared_by FROM evidence_provenance_journal WHERE id = $1::bigint`, [id])).rows[0] as { declared_by: string }).declared_by === "David Douville");
  await db.close();
}

// ═══ (g) LE MUTANT : declared_at PAR now() CÔTÉ SERVEUR ════════════════════
{
  const db = await jetable();
  // Le mutant NE TOUCHE PAS src/ : il réécrit le gabarit au vol, exactement
  // comme le ferait un développeur qui ajouterait un « défaut défensif » —
  // now() n'étant jamais NULL, il gagne TOUJOURS, et l'instant déclaré est
  // silencieusement remplacé par l'horloge du serveur. Le paramètre reste
  // référencé : la requête est parfaitement valide, et c'est ce qui rend ce
  // mutant crédible (une variante qui SUPPRIME $7 échoue en 42P18 avant même
  // d'atteindre la table — elle ne prouverait rien de la garde).
  const mutant = (sql: string) =>
    /^INSERT/.test(sql) ? sql.replace("$7::timestamptz", "coalesce(now(), $7::timestamptz)") : sql;
  const tx = transactor(db, mutant);
  const out = await recordQualification(tx, declaree({ declaredAt: "2019-01-02T03:04:05.000Z" }));
  check("(g) MUTANT declared_at = now() → la RELECTURE aborte, READBACK_MISMATCH",
    out.outcome === "ABORTED" && out.refusal.cause === "READBACK_MISMATCH" && out.refusal.at.includes("declaredAt"), j(out));
  check("(g) et la transaction a été ANNULÉE : rien n'a été inscrit", (await compter(db)) === 0);

  // Contre-épreuve : SANS le mutant, le même appel passe. Sinon le rouge du
  // mutant ne prouverait rien — il pourrait venir d'autre chose.
  const sain = await recordQualification(transactor(db), declaree({ declaredAt: "2019-01-02T03:04:05.000Z" }));
  check("(g) CONTRE-ÉPREUVE · sans le mutant, le MÊME appel est RECORDED",
    sain.outcome === "RECORDED" && new Date(sain.row.declaredAt).toISOString() === "2019-01-02T03:04:05.000Z", j(sain));
  await db.close();
}

// ═══ ÉQUIVALENCE DES DEUX MOTEURS DE FORME ═════════════════════════════════
{
  const db = await jetable();
  const CORPUS: Array<[string, string]> = [];
  for (const kind of ["QUERY_CONTEXT", "PUBLICATION", "PROFILE", "DOCUMENT", "OTHER"]) {
    for (const loc of [
      LOCATEUR,
      LU_EN_BASE,
      "https://x.com/0xSweep/status/1846000000000000000",
      "http://x.com/a",
      "HTTPS://x.com/a",
      "https://localhost/a",
      "https://x.com/a b",
      " https://x.com/a",
      "https://x.com/a ",
      "r2://interligens-evidence/vine/IMG_0001.png",
      "r2://X/a.png",
      "/Users/dood/captures/a.png",
      "urn:x:1",
      "mailto:a@b.co",
      "voir le dossier",
      "",
    ]) {
      CORPUS.push([kind, loc]);
    }
  }
  let desaccords = 0;
  const detail: string[] = [];
  for (const [kind, loc] of CORPUS) {
    const ts = formeLocalisateurAdmise(kind as never, loc);
    const code = await sqlstate(db,
      `INSERT INTO evidence_provenance_journal (evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at)
       VALUES ($1, 'OPERATOR_DECLARED', $2, $3, 'D', now())`, [SNAP_A, kind, loc]);
    const sql = code === "OK";
    if (ts !== sql) { desaccords++; detail.push(`${kind} · ${j(loc)} · TS=${ts} SQL=${sql} (${code})`); }
  }
  check(`ÉQUIVALENCE · le motif TypeScript et le CHECK SQL s'accordent sur les ${CORPUS.length} cas du corpus`,
    desaccords === 0, detail.join(" | "));
  await db.close();
}

console.log(lignes.join("\n"));
const total = lignes.filter((l) => /^(OK|KO) /.test(l)).length;
console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko} / ${total}`);
process.exitCode = ko === 0 ? 0 : 1;
