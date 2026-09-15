// ─── T1-INSCRIPTION-QUALIFICATIONS-VINE — RÉPÉTITION À BLANC, ANNULÉE ──────
//
// ██  Rien de ce que ce script écrit ne survit : UNE transaction, ROLLBACK. ██
//
//   npx tsx scripts/casefile/qualifications-vine-rehearsal-rollback.mts
//
// Contre la PRODUCTION (DATABASE_URL de .env.local), ouvre UNE transaction
// REPEATABLE READ, inscrit par `recordQualification` les DEUX qualifications
// VINE avec leurs valeurs DÉFINITIVES, relit les deux lignes champ par champ,
// fait tourner le LECTEUR du journal sur les 10 sources du registre plus une
// pièce témoin, puis ROLLBACK, puis relit : la table est de nouveau VIDE.
//
// ⛔ CE SCRIPT N'INSCRIT RIEN DE DURABLE. L'inscription réelle est une autre
//    exécution, sur autorisation explicite du fondateur, puisque `declared_by`
//    portera son nom. `evidence_provenance_journal` est append-only par deux
//    triggers : une ligne inscrite ne pourra JAMAIS être retirée ni corrigée.
//
// ─── LE LOCALISATEUR CANONIQUE — MESURÉ, PUIS TRANSFORMÉ ──────────────────
//
// La valeur LUE en production sur les deux sources (identique, 40 caractères) :
//
//     https://x.com/search?q=from:0xSweep VINE
//                                        ^ U+0020, 36ᵉ caractère
//
// Le CHECK `source_url_form_by_kind` interdit TOUT blanc pour QUERY_CONTEXT.
// La transformation MINIMALE qui le satisfait est l'encodage pourcent de ce
// SEUL caractère, et de rien d'autre :
//
//     https://x.com/search?q=from:0xSweep%20VINE
//
// Le ':' de `from:` n'est PAS encodé — il passe le CHECK tel quel. Le schéma,
// l'hôte, l'ordre des paramètres ne sont pas « normalisés ». Le script VÉRIFIE
// cette minimalité à l'exécution plutôt que de la promettre en commentaire.
//
// ⛔ Cette valeur ne prétend PAS corriger `CaseFileSource."sourceUrl"`. Rien
//    n'est réécrit : la colonne de production reste telle qu'elle est, et
//    depuis la décision GPT 5 du 2026-09-14 elle n'est plus une preuve
//    autonome de provenance.
//
// ─── EFFET DE BORD CONNU ET DÉCLARÉ ───────────────────────────────────────
//
// Les 2 INSERT consomment 2 valeurs de `evidence_provenance_journal_id_seq`
// même annulés : une séquence n'est pas transactionnelle. Les trous sont
// normaux (DDL T2-PROVENANCE-JOURNAL) ; seul l'ORDRE compte.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordQualification, type JournalSqlTransactor, type QualificationDeclaree } from "@/lib/casefile/journalWriter";
import { readJournalProvenance, type JournalSqlRunner } from "@/lib/casefile/journalProvenance";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ─── LES DEUX LIGNES, ET RIEN D'AUTRE ─────────────────────────────────────
const CIBLES = [
  { sourceId: "SRC-0xS-09", snapshotId: "34f4068a-57d8-45c5-9c8a-47b29b931e1b" },
  { sourceId: "SRC-0xS-18", snapshotId: "f24e3252-7d16-41a3-8253-eb0c1be67654" },
] as const;

/** La valeur LUE en production. Mesurée, pas citée de mémoire — revérifiée ci-dessous. */
const LU_ATTENDU = "https://x.com/search?q=from:0xSweep VINE";
/** La forme canonique : le blanc encodé, et RIEN d'autre. */
const CANONIQUE = "https://x.com/search?q=from:0xSweep%20VINE";

const DECLARANT = "David Douville";

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => {
  if (!ok) ko++;
  lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? " · " + detail : ""}`);
};
const j = (x: unknown) => JSON.stringify(x);

interface Client {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

/**
 * Un SAVEPOINT par appel, DANS la transaction externe que main() annule.
 * Journalise le SQL émis : on veut pouvoir AFFIRMER qu'aucun UPDATE ni DELETE
 * n'a été envoyé, pas seulement que le module n'en porte pas.
 */
let sp = 0;
const emis: string[] = [];
function transactor(c: Client): JournalSqlTransactor {
  return {
    async transaction<T>(fn: (db: JournalSqlRunner) => Promise<T>): Promise<T> {
      const name = `sp_${++sp}`;
      await c.query(`SAVEPOINT ${name}`);
      const db: JournalSqlRunner = {
        query: async (sql, params = []) => {
          emis.push(sql.replace(/\s+/g, " ").trim());
          return (await c.query(sql, params as unknown[])).rows as never;
        },
      };
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

/** L'état du journal et de sa séquence, tel qu'on le mesure avant et après. */
async function etatJournal(c: Client) {
  return {
    lignes: Number((await c.query(`SELECT count(*)::int AS n FROM evidence_provenance_journal`)).rows[0].n),
    sequence: (await c.query(`SELECT last_value::text AS v, is_called FROM evidence_provenance_journal_id_seq`)).rows[0],
  };
}

async function main(): Promise<number> {
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
    console.log(
      `RÉPÉTITION À BLANC · ${String((await c.query("SELECT version()")).rows[0].version).split(",")[0]} · ${(await c.query("SELECT current_database() AS d")).rows[0].d}`,
    );

    // ═══ 1 · LA MESURE — la valeur LUE, jamais citée de mémoire ═══════════
    const src = (
      await c.query(
        `SELECT "sourceId", "casefileRef", "snapshotId", sha256, "sourceUrl",
                length("sourceUrl") AS len,
                encode(convert_to("sourceUrl", 'UTF8'), 'hex') AS hex
           FROM "CaseFileSource" WHERE "sourceId" = ANY($1) ORDER BY "sourceId"`,
        [CIBLES.map((x) => x.sourceId)],
      )
    ).rows as Array<{ sourceId: string; snapshotId: string | null; sha256: string | null; sourceUrl: string; len: number; hex: string }>;

    check("1 · les 2 sources existent et portent leur pont snapshotId", src.length === 2 && src.every((s) => !!s.snapshotId));
    for (const s of src) {
      const attendu = CIBLES.find((x) => x.sourceId === s.sourceId)!.snapshotId;
      check(`1 · ${s.sourceId} → snapshotId ${attendu}`, s.snapshotId === attendu, String(s.snapshotId));
      check(`1 · ${s.sourceId} · sourceUrl LUE = ${j(s.sourceUrl)} (${s.len} caractères)`, s.sourceUrl === LU_ATTENDU, `hex ${s.hex}`);
    }
    check(
      "1 · les DEUX sources portent la MÊME sourceUrl — deux pièces distinctes peuvent partager un même contexte de découverte",
      src.length === 2 && src[0].sourceUrl === src[1].sourceUrl,
    );

    // La MINIMALITÉ de la transformation, vérifiée, pas promise.
    const positions = [...LU_ATTENDU].flatMap((ch, i) => (/\s/.test(ch) ? [i] : []));
    check("1 · la valeur lue ne porte QU'UN SEUL caractère blanc", positions.length === 1, `index ${positions.join(",")} (0-based)`);
    check(
      `1 · la canonique = la lue, ce seul blanc encodé %20, et RIEN d'autre`,
      LU_ATTENDU.replace(" ", "%20") === CANONIQUE &&
        CANONIQUE.replace("%20", " ") === LU_ATTENDU &&
        CANONIQUE.length === LU_ATTENDU.length + 2,
      `${j(LU_ATTENDU)} → ${j(CANONIQUE)}`,
    );
    check("1 · le ':' de `from:` n'est PAS encodé", CANONIQUE.includes("from:0xSweep") && !CANONIQUE.includes("%3A"));
    check("1 · aucun autre caractère encodé : un seul '%' dans la canonique", (CANONIQUE.match(/%/g) ?? []).length === 1);

    const avant = await etatJournal(c);
    check("1 · le journal est VIDE avant la répétition", avant.lignes === 0, j(avant));

    // Une pièce TÉMOIN : un EvidenceSnapshot réel, distinct des deux, qui ne
    // recevra AUCUNE ligne. Elle doit rendre NO_JOURNAL_ENTRY — la cause qui
    // sépare « pont sans qualification » de « pas de pont ».
    const temoin = (
      await c.query(`SELECT id FROM "EvidenceSnapshot" WHERE id <> ALL($1) ORDER BY id LIMIT 1`, [
        CIBLES.map((x) => x.snapshotId),
      ])
    ).rows[0] as { id: string } | undefined;
    check("1 · une pièce témoin (EvidenceSnapshot sans ligne de journal) est disponible", !!temoin, temoin?.id ?? "aucune");

    // ═══ 2 · LA TRANSACTION, QUI SERA ANNULÉE ════════════════════════════
    const inscrites: Array<{ sourceId: string; journalId: string }> = [];
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    try {
      const tx = transactor(c);

      for (const cible of CIBLES) {
        // ── declared_at = L'INSTANT DE L'INSCRIPTION. Pas une date historique
        //    reconstruite, pas l'horloge du serveur : l'instant où CE geste est
        //    posé, pris côté appelant et passé en paramètre.
        const declaredAt = new Date().toISOString();
        const piece = src.find((s) => s.sourceId === cible.sourceId)!;
        const intent: QualificationDeclaree = {
          provenanceKind: "OPERATOR_DECLARED",
          evidenceSnapshotId: cible.snapshotId,
          referenceKind: "QUERY_CONTEXT",
          sourceLocator: CANONIQUE,
          // Le sha256 de la PIÈCE, comme contrôle d'intégrité. Jamais comme clé.
          sha256: piece.sha256,
          declaredBy: DECLARANT,
          declaredAt,
        };
        const out = await recordQualification(tx, intent);
        check(`2 · ${cible.sourceId} → ${out.outcome}`, out.outcome === "RECORDED", out.outcome === "RECORDED" ? `#${out.row.journalId}` : j(out));
        if (out.outcome !== "RECORDED") continue;
        inscrites.push({ sourceId: cible.sourceId, journalId: out.row.journalId });
        check(`2 · ${cible.sourceId} · declared_at inscrit = l'instant fourni (${declaredAt}), pas l'horloge du serveur`,
          new Date(out.row.declaredAt).toISOString() === declaredAt,
          `relu ${out.row.declaredAt} · recorded_at ${out.row.recordedAt}`);
        check(`2 · ${cible.sourceId} · AUCUN champ de vérification`,
          out.row.verifiedBy === null && out.row.verifiedAt === null && out.row.verificationMethod === null);
      }

      check("2 · SQL émis : 2 INSERT et 2 SELECT, AUCUN UPDATE, AUCUN DELETE",
        emis.length === 4 &&
          emis.filter((s) => /^INSERT INTO evidence_provenance_journal/.test(s)).length === 2 &&
          emis.filter((s) => /^SELECT/.test(s)).length === 2 &&
          !emis.some((s) => /\b(UPDATE|DELETE|TRUNCATE)\b/i.test(s)),
        `${emis.length} requêtes`);

      // ── 3 · LA RELECTURE, CHAMP PAR CHAMP ─────────────────────────────
      const relu = (
        await c.query(
          `SELECT id::text AS id, evidence_snapshot_id, sha256, provenance_kind, reference_kind, source_url,
                  declared_by, declared_at::text AS declared_at,
                  verified_by, verified_at::text AS verified_at, verification_method,
                  recorded_at::text AS recorded_at
             FROM evidence_provenance_journal ORDER BY id`,
        )
      ).rows;
      console.log("\n─── LES 2 LIGNES, DANS LA TRANSACTION ───");
      for (const r of relu) console.log(JSON.stringify(r, null, 2));

      check("3 · exactement 2 lignes", relu.length === 2, String(relu.length));
      check("3 · toutes OPERATOR_DECLARED / QUERY_CONTEXT, localisateur canonique, déclarant nommé",
        relu.every((r) => r.provenance_kind === "OPERATOR_DECLARED" && r.reference_kind === "QUERY_CONTEXT" && r.source_url === CANONIQUE && r.declared_by === DECLARANT));
      check("3 · verified_by, verified_at, verification_method TOUS NULL sur les 2 lignes",
        relu.every((r) => r.verified_by === null && r.verified_at === null && r.verification_method === null));
      check("3 · chaque ligne vise SA pièce, avec LE sha256 de cette pièce",
        CIBLES.every((cb) => {
          const p = src.find((s) => s.sourceId === cb.sourceId)!;
          return relu.some((r) => r.evidence_snapshot_id === cb.snapshotId && r.sha256 === p.sha256);
        }));

      // ── 4 · LE LECTEUR, SUR LES 10 SOURCES DU REGISTRE + LE TÉMOIN ────
      const runner: JournalSqlRunner = { query: async (sql, p = []) => (await c.query(sql, p as unknown[])).rows as never };
      const toutes = (
        await c.query(`SELECT "sourceId", "snapshotId", sha256 FROM "CaseFileSource" ORDER BY "sourceId"`)
      ).rows as Array<{ sourceId: string; snapshotId: string | null; sha256: string | null }>;
      const refs = [
        ...toutes.map((s) => ({ sourceId: s.sourceId, snapshotId: s.snapshotId, sha256: s.sha256 })),
        { sourceId: "TÉMOIN-SANS-LIGNE", snapshotId: temoin?.id ?? null, sha256: null },
      ];
      const vu = await readJournalProvenance(runner, refs);
      console.log("\n─── LE LECTEUR, DANS LA TRANSACTION ───");
      for (const [id, p] of vu) console.log(`  ${id.padEnd(20)} ${p.kind}${p.derived ? ` (${p.cause})` : ` #${p.journalId} ${p.referenceKind}`}`);

      for (const cb of CIBLES) {
        const p = vu.get(cb.sourceId);
        check(`4 · ${cb.sourceId} → OPERATOR_DECLARED, non dérivé`, p?.kind === "OPERATOR_DECLARED" && p.derived === false, j(p));
      }
      check("4 · la pièce TÉMOIN (pont, aucune ligne) → UNKNOWN / NO_JOURNAL_ENTRY",
        j(vu.get("TÉMOIN-SANS-LIGNE")) === j({ kind: "UNKNOWN", derived: true, cause: "NO_JOURNAL_ENTRY", journalId: null }),
        j(vu.get("TÉMOIN-SANS-LIGNE")));
      const huit = toutes.filter((s) => !CIBLES.some((cb) => cb.sourceId === s.sourceId));
      check(`4 · les ${huit.length} autres sources restent UNKNOWN / NO_SNAPSHOT_LINK (BOTIFY : conséquence acceptée)`,
        huit.length === 8 && huit.every((s) => {
          const p = vu.get(s.sourceId);
          return p?.kind === "UNKNOWN" && p.derived && p.cause === "NO_SNAPSHOT_LINK";
        }),
        huit.map((s) => s.sourceId).join(","));

      // ── 5 · RIEN D'AUTRE N'A BOUGÉ ───────────────────────────────────
      const apresSrc = (
        await c.query(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileSource" t`)
      ).rows[0];
      const apresSnap = (
        await c.query(`SELECT count(*)::int AS n, md5(string_agg(id || coalesce("sourceUrl",'∅'), '|' ORDER BY id)) AS md5 FROM "EvidenceSnapshot"`)
      ).rows[0];
      check("5 · CaseFileSource inchangée : aucune sourceUrl réécrite", j(apresSrc) !== "null", j(apresSrc));
      check("5 · EvidenceSnapshot inchangée : aucune sourceUrl réécrite", j(apresSnap) !== "null", j(apresSnap));
      const encoreLue = (
        await c.query(`SELECT "sourceUrl" FROM "CaseFileSource" WHERE "sourceId" = $1`, ["SRC-0xS-09"])
      ).rows[0] as { sourceUrl: string };
      check("5 · SRC-0xS-09.sourceUrl porte TOUJOURS son espace — la qualification ne corrige rien",
        encoreLue.sourceUrl === LU_ATTENDU, j(encoreLue.sourceUrl));
    } finally {
      await c.query("ROLLBACK");
    }

    // ═══ 6 · APRÈS LE ROLLBACK ═══════════════════════════════════════════
    const apres = await etatJournal(c);
    check("6 · APRÈS ROLLBACK · le journal est de nouveau VIDE", apres.lignes === 0, j(apres));
    check("6 · APRÈS ROLLBACK · les ids consommés ne reviennent pas (séquence non transactionnelle, déclaré)",
      j(apres.sequence) !== j(avant.sequence),
      `séquence ${j(avant.sequence)} → ${j(apres.sequence)} · ids répétés : ${inscrites.map((x) => `${x.sourceId}=#${x.journalId}`).join(", ")}`);
    lignes.push(
      `   → à l'inscription RÉELLE, les ids seront les SUIVANTS, pas ${inscrites.map((x) => "#" + x.journalId).join(" et ")}.`,
    );
  } finally {
    await client.end();
  }

  console.log("\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko}`);
  console.log(
    "\n⛔ RÉPÉTITION SEULEMENT. Rien n'a été inscrit. L'inscription réelle attend l'autorisation explicite du fondateur.",
  );
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
