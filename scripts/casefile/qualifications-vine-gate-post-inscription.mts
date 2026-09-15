// ─── T1-INSCRIPTION-REELLE-VINE — LA GATE, DIX POINTS, CHACUN PROUVÉ ──────
//
//   npx tsx scripts/casefile/qualifications-vine-gate-post-inscription.mts \
//     --receipt=<le reçu déposé par l'inscription>
//
// Après le COMMIT. Chaque point est une REQUÊTE et son résultat, pas une
// affirmation. Le point 7 va plus loin que les neuf autres : il ESSAIE de
// forcer le verrou. Un verrou qu'on n'a pas essayé de forcer n'est pas un
// verrou mesuré — il est tenté DANS une transaction qui sera annulée, sur les
// deux lignes réelles, et le refus attendu est `23001`.
//
// ⛔ Ce script n'inscrit RIEN. Le seul BEGIN qu'il ouvre finit en ROLLBACK, et
//    l'état est relu après coup pour le prouver.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJournalProvenance, type JournalSqlRunner } from "@/lib/casefile/journalProvenance";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CIBLES = [
  { sourceId: "SRC-0xS-09", snapshotId: "34f4068a-57d8-45c5-9c8a-47b29b931e1b" },
  { sourceId: "SRC-0xS-18", snapshotId: "f24e3252-7d16-41a3-8253-eb0c1be67654" },
] as const;
const CANONIQUE = "https://x.com/search?q=from:0xSweep%20VINE";
const DECLARANT = "David Douville";

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => {
  if (!ok) ko++;
  lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? "\n        " + detail : ""}`);
};
const j = (x: unknown) => JSON.stringify(x);

interface Client {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

async function empreintes(c: Client) {
  const un = async (table: string) =>
    String(
      (await c.query(`SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) AS md5 FROM "${table}" t`)).rows[0]
        .md5,
    );
  return {
    CaseFileClaim: await un("CaseFileClaim"),
    CaseFileSource: await un("CaseFileSource"),
    EvidenceSnapshot: await un("EvidenceSnapshot"),
  };
}

async function etatGlobal(c: Client) {
  return (
    await c.query(`SELECT
      (SELECT count(*)::int FROM "CaseFileClaim")                                                 AS claims,
      (SELECT count(*)::int FROM "CaseFileSource")                                                AS sources,
      (SELECT count(*)::int FROM casefile_claim_publication_decisions)                            AS decisions,
      (SELECT count(*)::int FROM casefile_claim_publication_decisions WHERE decision = 'GRANT')   AS grants,
      (SELECT last_value::text FROM casefile_claim_publication_decisions_id_seq)                  AS seq_decisions,
      (SELECT count(*)::int FROM token_casefiles WHERE "publishStatus" <> 'draft')                AS casefiles_non_draft`)
  ).rows[0];
}

/** Le code SQLSTATE d'un refus, ou `null` si la requête a RÉUSSI (ce qui serait la faute). */
async function codeDuRefus(c: Client, sql: string): Promise<string | null> {
  try {
    await c.query(sql);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "SANS_CODE";
  }
}

async function main(): Promise<number> {
  const recu = process.argv.slice(2).find((a) => a.startsWith("--receipt="))?.slice("--receipt=".length);
  if (!recu) {
    console.error("⛔ --receipt=<chemin.json> est obligatoire : l'empreinte AVANT ne se reconstruit pas après coup.");
    return 2;
  }
  const reçu = JSON.parse(readFileSync(recu, "utf8")) as {
    empreintesAvant: Record<string, string>;
    etatAvant: Record<string, unknown>;
    inscrites: Array<{ sourceId: string; journalId: string; declaredAt: string; recordedAt: string }>;
  };

  const env = readFileSync(path.join(REPO, ".env.local"), "utf8");
  const m = env.match(/^DATABASE_URL="?([^"\n]+)"?$/m);
  if (!m) {
    console.error("DATABASE_URL absente de .env.local");
    return 1;
  }
  const pgSpec = "pg";
  const pg = (await import(pgSpec)).default as {
    Client: new (o: { connectionString: string }) => Client & { connect(): Promise<void>; end(): Promise<void> };
  };
  const client = new pg.Client({ connectionString: m[1] });
  await client.connect();
  const c: Client = { query: (sql, params) => client.query(sql, params as unknown[]) };

  try {
    const hote = String(m[1]).match(/@([^/]+)\//)?.[1] ?? "?";
    console.log(`GATE POST-INSCRIPTION · ${(await c.query("SELECT current_database() AS d")).rows[0].d} · ${hote}`);

    const rows = (
      await c.query(
        `SELECT id::text AS id, evidence_snapshot_id, sha256, provenance_kind, reference_kind, source_url,
                encode(convert_to(source_url, 'UTF8'), 'hex')                       AS source_url_hex,
                length(source_url)                                                  AS source_url_len,
                declared_by, declared_at::text AS declared_at, recorded_at::text AS recorded_at,
                (declared_at IS DISTINCT FROM recorded_at)                          AS declared_distinct_recorded,
                verified_by, verified_at::text AS verified_at, verification_method
           FROM evidence_provenance_journal ORDER BY id`,
      )
    ).rows as Array<Record<string, unknown>>;
    console.log("\n─── LE JOURNAL, TEL QU'IL EST ───");
    for (const r of rows) console.log(JSON.stringify(r, null, 2));

    // ── 1 ────────────────────────────────────────────────────────────────
    check(
      "1 · exactement 2 lignes dans le journal",
      rows.length === 2,
      `SELECT count(*) FROM evidence_provenance_journal → ${rows.length} · ids ${rows.map((r) => "#" + r.id).join(", ")}`,
    );

    // ── 2 ────────────────────────────────────────────────────────────────
    check(
      "2 · provenance_kind = OPERATOR_DECLARED sur les deux",
      rows.length === 2 && rows.every((r) => r.provenance_kind === "OPERATOR_DECLARED"),
      rows.map((r) => `#${r.id} → ${r.provenance_kind}`).join(" · "),
    );

    // ── 3 ────────────────────────────────────────────────────────────────
    check(
      "3 · reference_kind = QUERY_CONTEXT sur les deux",
      rows.length === 2 && rows.every((r) => r.reference_kind === "QUERY_CONTEXT"),
      rows.map((r) => `#${r.id} → ${r.reference_kind}`).join(" · "),
    );

    // ── 4 · à l'OCTET, pas à la chaîne ───────────────────────────────────
    const hexCanonique = Buffer.from(CANONIQUE, "utf8").toString("hex");
    check(
      "4 · source_url strictement égale à la canonique, comparée à l'OCTET",
      rows.length === 2 && rows.every((r) => r.source_url_hex === hexCanonique && r.source_url_len === CANONIQUE.length),
      `attendu ${hexCanonique}\n        relu    ${rows.map((r) => r.source_url_hex).join("\n        relu    ")}`,
    );

    // ── 5 ────────────────────────────────────────────────────────────────
    check(
      "5 · declared_by = David Douville, et declared_at DISTINCT de recorded_at sur chaque ligne",
      rows.length === 2 && rows.every((r) => r.declared_by === DECLARANT && r.declared_distinct_recorded === true),
      rows.map((r) => `#${r.id} · ${r.declared_by} · declared_at ${r.declared_at} ≠ recorded_at ${r.recorded_at}`).join("\n        "),
    );

    // ── 6 ────────────────────────────────────────────────────────────────
    check(
      "6 · verified_by, verified_at, verification_method à NULL sur les deux",
      rows.length === 2 && rows.every((r) => r.verified_by === null && r.verified_at === null && r.verification_method === null),
      rows.map((r) => `#${r.id} → ${j([r.verified_by, r.verified_at, r.verification_method])}`).join(" · "),
    );

    // ── 7 · LE VERROU, ESSAYÉ POUR DE VRAI ───────────────────────────────
    const cible = String(rows[0]?.id ?? "0");
    await c.query("BEGIN");
    const codeUpdate = await codeDuRefus(c, `UPDATE evidence_provenance_journal SET declared_by = 'FORCE' WHERE id = ${cible}`);
    await c.query("ROLLBACK");
    await c.query("BEGIN");
    const codeDelete = await codeDuRefus(c, `DELETE FROM evidence_provenance_journal WHERE id = ${cible}`);
    await c.query("ROLLBACK");
    check(
      `7 · APPEND-ONLY PROUVÉ EN VIF sur la ligne réelle #${cible} : UPDATE → 23001, DELETE → 23001, puis ROLLBACK`,
      codeUpdate === "23001" && codeDelete === "23001",
      `UPDATE … SET declared_by='FORCE' WHERE id=${cible} → ${codeUpdate ?? "AUCUN REFUS (FAUTE)"}\n        ` +
        `DELETE FROM … WHERE id=${cible} → ${codeDelete ?? "AUCUN REFUS (FAUTE)"}`,
    );
    const apresTentative = (
      await c.query(
        `SELECT count(*)::int AS n, count(*) FILTER (WHERE declared_by = 'FORCE')::int AS forces
           FROM evidence_provenance_journal`,
      )
    ).rows[0];
    check(
      "7 bis · après les deux tentatives annulées : 2 lignes, 0 ligne altérée",
      Number(apresTentative.n) === 2 && Number(apresTentative.forces) === 0,
      j(apresTentative),
    );

    // ── 8 & 9 · LE LECTEUR, SUR LES 10 SOURCES DU REGISTRE ───────────────
    const runner: JournalSqlRunner = { query: async (sql, p = []) => (await c.query(sql, p as unknown[])).rows as never };
    const toutes = (
      await c.query(`SELECT "sourceId", "snapshotId", sha256 FROM "CaseFileSource" ORDER BY "sourceId"`)
    ).rows as Array<{ sourceId: string; snapshotId: string | null; sha256: string | null }>;
    const vu = await readJournalProvenance(runner, toutes);
    console.log("\n─── LE LECTEUR, SUR LES 10 SOURCES ───");
    for (const [id, p] of vu) console.log(`  ${id.padEnd(14)} ${p.kind}${p.derived ? ` (${p.cause})` : ` #${p.journalId} ${p.referenceKind}`}`);

    check(
      "8 · le lecteur rend OPERATOR_DECLARED, NON DÉRIVÉ, sur les 2 sources VINE",
      CIBLES.every((cb) => {
        const p = vu.get(cb.sourceId);
        return p?.kind === "OPERATOR_DECLARED" && p.derived === false;
      }),
      CIBLES.map((cb) => `${cb.sourceId} → ${j(vu.get(cb.sourceId))}`).join("\n        "),
    );

    const huit = toutes.filter((s) => !CIBLES.some((cb) => cb.sourceId === s.sourceId));
    check(
      `9 · le lecteur rend UNKNOWN / NO_SNAPSHOT_LINK sur les ${huit.length} sources BOTIFY — inchangé`,
      huit.length === 8 &&
        huit.every((s) => {
          const p = vu.get(s.sourceId);
          return p?.kind === "UNKNOWN" && p.derived === true && p.cause === "NO_SNAPSHOT_LINK";
        }),
      huit.map((s) => `${s.sourceId} → ${j(vu.get(s.sourceId))}`).join("\n        "),
    );

    // ── 10 · RIEN D'AUTRE N'A BOUGÉ ──────────────────────────────────────
    const apresEmpreintes = await empreintes(c);
    check(
      "10.a · md5 de CaseFileClaim, CaseFileSource et EvidenceSnapshot identiques AVANT/APRÈS",
      j(apresEmpreintes) === j(reçu.empreintesAvant),
      `avant ${j(reçu.empreintesAvant)}\n        après ${j(apresEmpreintes)}`,
    );
    const apresEtat = await etatGlobal(c);
    check(
      "10.b · 22 claims · 10 sources · 6 décisions · séquence 39 · état identique AVANT/APRÈS",
      j(apresEtat) === j(reçu.etatAvant) &&
        Number(apresEtat.claims) === 22 &&
        Number(apresEtat.sources) === 10 &&
        Number(apresEtat.decisions) === 6,
      `avant ${j(reçu.etatAvant)}\n        après ${j(apresEtat)}`,
    );
    const publics = (
      await c.query(
        `SELECT count(*)::int AS n FROM casefile_claim_publication_decisions d
          WHERE d.decision = 'GRANT'
            AND NOT EXISTS (SELECT 1 FROM casefile_claim_publication_decisions r
                             WHERE r.decision = 'REVOKE' AND r.claim_id = d.claim_id
                               AND r.claim_version = d.claim_version AND r.audience = d.audience
                               AND r.id > d.id)`,
      )
    ).rows[0];
    check("10.c · 0 claim PUBLIC : chaque GRANT est suivi de son REVOKE", Number(publics.n) === 0, `GRANT non révoqués = ${publics.n}`);
    // ⚠ MESURÉ, PAS PRÉSUMÉ. La consigne dit « token_casefiles.publishStatus
    //   toujours draft ». C'est vrai des dossiers SOUS GOUVERNANCE — ceux qui
    //   portent des claims et des sources : VINE et BOTIFY. Ça ne l'est PAS de
    //   la table entière : `IL-PND-LAB-001` (LAB) était `published` AVANT cette
    //   fenêtre, et ne porte NI claim NI source — il est hors du registre
    //   gouverné. On énonce donc ce qu'on mesure : les dossiers porteurs sont
    //   draft, et le décompte des non-draft est IDENTIQUE à l'avant (10.b).
    const dossiers = (
      await c.query(`SELECT t.ref, t."publishStatus",
                            (SELECT count(*)::int FROM "CaseFileClaim"  c WHERE c."casefileRef" = t.ref) AS claims,
                            (SELECT count(*)::int FROM "CaseFileSource" s WHERE s."casefileRef" = t.ref) AS sources
                       FROM token_casefiles t ORDER BY t.ref`)
    ).rows as Array<{ ref: string; publishStatus: string; claims: number; sources: number }>;
    const porteurs = dossiers.filter((d) => Number(d.claims) > 0 || Number(d.sources) > 0);
    check(
      "10.d · les dossiers PORTEURS de claims/sources (VINE, BOTIFY) sont toujours draft",
      porteurs.length === 2 &&
        porteurs.every((d) => d.publishStatus === "draft") &&
        porteurs.map((d) => d.ref).sort().join(",") === "IL-SHILL-BOTIFY-001,IL-SHILL-VINE-001",
      dossiers.map((d) => `${d.ref}=${d.publishStatus} (${d.claims} claims, ${d.sources} sources)`).join("\n        "),
    );
    check(
      "10.e · le seul dossier non-draft est LAB, hors registre gouverné, et il l'était DÉJÀ avant la fenêtre",
      dossiers.filter((d) => d.publishStatus !== "draft").every((d) => d.ref === "IL-PND-LAB-001" && Number(d.claims) === 0 && Number(d.sources) === 0) &&
        Number(apresEtat.casefiles_non_draft) === Number(reçu.etatAvant.casefiles_non_draft),
      `non-draft = ${dossiers.filter((d) => d.publishStatus !== "draft").map((d) => d.ref).join(", ") || "aucun"} · ` +
        `avant ${reçu.etatAvant.casefiles_non_draft} / après ${apresEtat.casefiles_non_draft}`,
    );
  } finally {
    await client.end();
  }

  console.log("\n─── LA GATE ───\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅ GATE VERTE" : "❌ GATE ROUGE"} · KO = ${ko}`);
  return ko === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
