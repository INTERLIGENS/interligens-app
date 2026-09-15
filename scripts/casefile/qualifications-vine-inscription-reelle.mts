// ─── T1-INSCRIPTION-REELLE-VINE — L'ÉCRITURE IRRÉVERSIBLE ─────────────────
//
// ██  Ce script INSCRIT. Ce qu'il écrit ne pourra JAMAIS être retiré ni     ██
// ██  corrigé : `evidence_provenance_journal` est append-only par deux      ██
// ██  triggers, 23001 sur UPDATE, DELETE et TRUNCATE.                       ██
//
//   npx tsx scripts/casefile/qualifications-vine-inscription-reelle.mts \
//     --je-confirme-inscription-irreversible --receipt=<chemin.json>
//
// SANS le drapeau de confirmation, le script REFUSE et n'ouvre aucune
// transaction : un `npx tsx` distrait ne doit pas pouvoir poser deux lignes
// permanentes dans un journal append-only.
//
// ─── LE MÊME CHEMIN QUE LA RÉPÉTITION, AU MOT PRÈS ────────────────────────
//
// La répétition à blanc (`qualifications-vine-rehearsal-rollback.mts`, mergée
// en d42a6dc) a joué EXACTEMENT ces deux intentions et les a annulées. Ici, un
// SEUL comportement change : le COMMIT au lieu du ROLLBACK, et `declared_at`
// qui porte l'instant réel du geste.
//
// Tout le reste est REVÉRIFIÉ, pas supposé :
//   · les quatre constantes (les 2 snapshotId, le localisateur lu, la forme
//     canonique, le déclarant) sont RELUES DANS LE FICHIER DE LA RÉPÉTITION et
//     comparées caractère par caractère. Si la moindre diverge, le script
//     s'arrête : ce serait le signe que la répétition n'a pas prouvé ce qu'on
//     croit.
//   · le journal est relu à 0 ligne, les 2 EvidenceSnapshot relus sous leurs
//     ids, les 2 `sourceUrl` relues à l'OCTET (hex), les sha256 relus — jamais
//     recopiés.
//   · l'empreinte md5 des trois tables voisines est prise AVANT, et déposée
//     dans le reçu : la gate d'après-coup la compare, elle ne la reconstruit
//     pas.
//
// ─── ATOMICITÉ ────────────────────────────────────────────────────────────
//
// UNE transaction REPEATABLE READ pour les DEUX lignes, un SAVEPOINT par appel
// (la forme exacte de la répétition). Toute la vérification dans la
// transaction ; le COMMIT n'est atteint que si elle est intégralement verte.
// Au moindre KO : ROLLBACK, et rien n'a existé. Deux lignes, ou aucune.
//
// ⛔ AUCUNE ligne pour BOTIFY ni pour aucune autre pièce.
// ⛔ CaseFileSource et EvidenceSnapshot ne sont ni écrits, ni corrigés.
// ⛔ Aucun appel réseau hors la base, aucune variable TSA_*, aucun déploiement.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordQualification, type JournalSqlTransactor, type QualificationDeclaree } from "@/lib/casefile/journalWriter";
import type { JournalSqlRunner } from "@/lib/casefile/journalProvenance";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPETITION = path.join(REPO, "scripts/casefile/qualifications-vine-rehearsal-rollback.mts");

// ─── LES DEUX LIGNES, ET RIEN D'AUTRE ─────────────────────────────────────
const CIBLES = [
  { sourceId: "SRC-0xS-09", snapshotId: "34f4068a-57d8-45c5-9c8a-47b29b931e1b" },
  { sourceId: "SRC-0xS-18", snapshotId: "f24e3252-7d16-41a3-8253-eb0c1be67654" },
] as const;

/** La valeur LUE en production. Revérifiée à l'octet ci-dessous. */
const LU_ATTENDU = "https://x.com/search?q=from:0xSweep VINE";
/** La forme canonique inscrite : le blanc encodé, et RIEN d'autre. */
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

/** Un SAVEPOINT par appel, DANS la transaction externe. Le SQL émis est journalisé. */
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

/** L'empreinte des tables VOISINES — celles qui ne doivent pas bouger. */
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

/** L'état gouverné global, tel qu'il doit rester. */
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

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (!argv.includes("--je-confirme-inscription-irreversible")) {
    console.error(
      "⛔ REFUS. L'inscription est IRRÉVERSIBLE (journal append-only).\n" +
        "   Relancer avec --je-confirme-inscription-irreversible pour l'autoriser.",
    );
    return 2;
  }
  const recu = argv.find((a) => a.startsWith("--receipt="))?.slice("--receipt=".length);
  if (!recu) {
    console.error("⛔ REFUS. --receipt=<chemin.json> est obligatoire : l'empreinte AVANT doit survivre au processus.");
    return 2;
  }

  // ═══ 0 · LES VALEURS SONT CELLES DE LA RÉPÉTITION, RELUES DANS SON FICHIER
  const rep = readFileSync(REPETITION, "utf8");
  const litteral = (nom: string) => rep.match(new RegExp(`const ${nom} = "([^"]*)"`))?.[1];
  check("0 · LU_ATTENDU identique à la répétition", litteral("LU_ATTENDU") === LU_ATTENDU, j(litteral("LU_ATTENDU")));
  check("0 · CANONIQUE identique à la répétition", litteral("CANONIQUE") === CANONIQUE, j(litteral("CANONIQUE")));
  check("0 · DECLARANT identique à la répétition", litteral("DECLARANT") === DECLARANT, j(litteral("DECLARANT")));
  for (const cb of CIBLES) {
    check(
      `0 · ${cb.sourceId} → ${cb.snapshotId} : le couple figure tel quel dans la répétition`,
      rep.includes(`{ sourceId: "${cb.sourceId}", snapshotId: "${cb.snapshotId}" }`),
    );
  }
  check(
    "0 · la répétition ne vise que ces DEUX pièces",
    (rep.match(/sourceId: "SRC-/g) ?? []).length === 2,
  );
  if (ko > 0) {
    console.log(lignes.join("\n"));
    console.error("\n⛔ ARRÊT AVANT TOUTE CONNEXION : divergence avec la répétition.");
    return 1;
  }

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

  let commit = false;
  const inscrites: Array<{ sourceId: string; journalId: string; declaredAt: string; recordedAt: string }> = [];
  let avantEmpreintes: Record<string, string> = {};
  let avantEtat: Record<string, unknown> = {};

  try {
    const hote = String(m[1]).match(/@([^/]+)\//)?.[1] ?? "?";
    console.log(`INSCRIPTION RÉELLE · ${(await c.query("SELECT current_database() AS d")).rows[0].d} · ${hote}`);
    check("0 · la base visée est bien ep-square-band", hote.startsWith("ep-square-band"), hote);

    // ═══ 1 · RELECTURE AVANT ÉCRITURE ════════════════════════════════════
    const n0 = Number((await c.query(`SELECT count(*)::int AS n FROM evidence_provenance_journal`)).rows[0].n);
    check("1 · le journal est à 0 ligne", n0 === 0, `count = ${n0}`);

    const snaps = (
      await c.query(`SELECT id, sha256 FROM "EvidenceSnapshot" WHERE id = ANY($1) ORDER BY id`, [
        CIBLES.map((x) => x.snapshotId),
      ])
    ).rows as Array<{ id: string; sha256: string | null }>;
    check("1 · les 2 EvidenceSnapshot existent sous ces ids", snaps.length === 2, snaps.map((s) => s.id).join(", "));

    const src = (
      await c.query(
        `SELECT "sourceId", "snapshotId", sha256, "sourceUrl", length("sourceUrl") AS len,
                encode(convert_to("sourceUrl", 'UTF8'), 'hex') AS hex
           FROM "CaseFileSource" WHERE "sourceId" = ANY($1) ORDER BY "sourceId"`,
        [CIBLES.map((x) => x.sourceId)],
      )
    ).rows as Array<{ sourceId: string; snapshotId: string | null; sha256: string | null; sourceUrl: string; len: number; hex: string }>;
    check("1 · les 2 CaseFileSource existent", src.length === 2, String(src.length));

    const hexAttendu = Buffer.from(LU_ATTENDU, "utf8").toString("hex");
    for (const s of src) {
      const cb = CIBLES.find((x) => x.sourceId === s.sourceId)!;
      check(`1 · ${s.sourceId} · snapshotId inchangé`, s.snapshotId === cb.snapshotId, String(s.snapshotId));
      check(`1 · ${s.sourceId} · sourceUrl à l'OCTET (${s.len} car.)`, s.hex === hexAttendu, `hex ${s.hex}`);
      const sn = snaps.find((x) => x.id === cb.snapshotId);
      check(`1 · ${s.sourceId} · sha256 RELU, concordant source ↔ snapshot`, !!sn && sn.sha256 === s.sha256 && /^[0-9a-f]{64}$/.test(String(s.sha256)), String(s.sha256));
    }

    // La minimalité de la transformation, VÉRIFIÉE.
    check("1 · la valeur lue ne porte QU'UN seul blanc", [...LU_ATTENDU].filter((ch) => /\s/.test(ch)).length === 1);
    check(
      "1 · la canonique = la lue, ce seul blanc encodé %20, et RIEN d'autre",
      LU_ATTENDU.replace(" ", "%20") === CANONIQUE &&
        CANONIQUE.replace("%20", " ") === LU_ATTENDU &&
        (CANONIQUE.match(/%/g) ?? []).length === 1 &&
        !CANONIQUE.includes("%3A"),
      j(CANONIQUE),
    );

    avantEmpreintes = await empreintes(c);
    avantEtat = await etatGlobal(c);
    const seqAvant = (await c.query(`SELECT last_value::text AS v, is_called FROM evidence_provenance_journal_id_seq`)).rows[0];
    lignes.push(`   empreintes AVANT : ${j(avantEmpreintes)}`);
    lignes.push(`   état AVANT       : ${j(avantEtat)} · séquence ${j(seqAvant)}`);

    if (ko > 0) {
      console.log(lignes.join("\n"));
      console.error("\n⛔ ARRÊT AVANT ÉCRITURE : la relecture diverge. RIEN n'a été inscrit.");
      return 1;
    }

    // ═══ 2 · L'INSCRIPTION ═══════════════════════════════════════════════
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    try {
      const tx = transactor(c);

      for (const cible of CIBLES) {
        // declared_at = L'INSTANT RÉEL du geste, pris côté appelant.
        const declaredAt = new Date().toISOString();
        const piece = src.find((s) => s.sourceId === cible.sourceId)!;
        const intent: QualificationDeclaree = {
          provenanceKind: "OPERATOR_DECLARED",
          evidenceSnapshotId: cible.snapshotId,
          referenceKind: "QUERY_CONTEXT",
          sourceLocator: CANONIQUE,
          sha256: piece.sha256,
          declaredBy: DECLARANT,
          declaredAt,
        };
        const out = await recordQualification(tx, intent);
        check(`2 · ${cible.sourceId} → ${out.outcome}`, out.outcome === "RECORDED", out.outcome === "RECORDED" ? `#${out.row.journalId}` : j(out));
        if (out.outcome !== "RECORDED") continue;
        check(
          `2 · ${cible.sourceId} · declared_at = l'instant fourni, pas l'horloge du serveur`,
          new Date(out.row.declaredAt).toISOString() === declaredAt,
          `déclaré ${declaredAt} · relu ${out.row.declaredAt} · recorded_at ${out.row.recordedAt}`,
        );
        check(
          `2 · ${cible.sourceId} · AUCUN champ de vérification`,
          out.row.verifiedBy === null && out.row.verifiedAt === null && out.row.verificationMethod === null,
        );
        inscrites.push({ sourceId: cible.sourceId, journalId: out.row.journalId, declaredAt: out.row.declaredAt, recordedAt: out.row.recordedAt });
      }

      check(
        "2 · SQL émis : 2 INSERT, 2 SELECT, AUCUN UPDATE, AUCUN DELETE, AUCUN TRUNCATE",
        emis.length === 4 &&
          emis.filter((s) => /^INSERT INTO evidence_provenance_journal/.test(s)).length === 2 &&
          emis.filter((s) => /^SELECT/.test(s)).length === 2 &&
          !emis.some((s) => /\b(UPDATE|DELETE|TRUNCATE)\b/i.test(s)),
        `${emis.length} requêtes`,
      );

      // ── 3 · LA RELECTURE, DANS LA TRANSACTION, AVANT DE VALIDER ───────
      const relu = (
        await c.query(
          `SELECT id::text AS id, evidence_snapshot_id, sha256, provenance_kind, reference_kind, source_url,
                  declared_by, declared_at::text AS declared_at,
                  verified_by, verified_at::text AS verified_at, verification_method,
                  recorded_at::text AS recorded_at
             FROM evidence_provenance_journal ORDER BY id`,
        )
      ).rows;
      console.log("\n─── LES 2 LIGNES, AVANT LE COMMIT ───");
      for (const r of relu) console.log(JSON.stringify(r, null, 2));

      check("3 · exactement 2 lignes", relu.length === 2, String(relu.length));
      check(
        "3 · OPERATOR_DECLARED / QUERY_CONTEXT / localisateur canonique / déclarant nommé, sur les 2",
        relu.length === 2 &&
          relu.every(
            (r) =>
              r.provenance_kind === "OPERATOR_DECLARED" &&
              r.reference_kind === "QUERY_CONTEXT" &&
              r.source_url === CANONIQUE &&
              r.declared_by === DECLARANT,
          ),
      );
      check(
        "3 · verified_by / verified_at / verification_method TOUS NULL sur les 2",
        relu.every((r) => r.verified_by === null && r.verified_at === null && r.verification_method === null),
      );
      check(
        "3 · chaque ligne vise SA pièce, avec LE sha256 de cette pièce",
        CIBLES.every((cb) => {
          const p = src.find((s) => s.sourceId === cb.sourceId)!;
          return relu.some((r) => r.evidence_snapshot_id === cb.snapshotId && r.sha256 === p.sha256);
        }),
      );
      check("3 · aucune ligne pour une autre pièce", relu.every((r) => CIBLES.some((cb) => cb.snapshotId === r.evidence_snapshot_id)));

      // ── 4 · RIEN D'AUTRE N'A BOUGÉ, DANS LA MÊME TRANSACTION ─────────
      const apresEmpreintes = await empreintes(c);
      check("4 · empreintes md5 des 3 tables voisines inchangées", j(apresEmpreintes) === j(avantEmpreintes), j(apresEmpreintes));
      const apresEtat = await etatGlobal(c);
      check("4 · état gouverné inchangé", j(apresEtat) === j(avantEtat), j(apresEtat));

      if (ko > 0) throw new Error("GATE_PRE_COMMIT_KO");
      commit = true;
    } catch (e) {
      await c.query("ROLLBACK");
      console.log("\n" + lignes.join("\n"));
      console.error(`\n⛔ ROLLBACK. RIEN N'A ÉTÉ INSCRIT. Cause : ${e instanceof Error ? e.message : String(e)}`);
      return 1;
    }

    // ═══ LE POINT DE NON-RETOUR ══════════════════════════════════════════
    await c.query("COMMIT");
    lignes.push(`   → COMMIT. Les ids ${inscrites.map((x) => "#" + x.journalId).join(" et ")} sont PERMANENTS.`);

    const apresCommit = Number((await c.query(`SELECT count(*)::int AS n FROM evidence_provenance_journal`)).rows[0].n);
    check("5 · APRÈS COMMIT · le journal porte exactement 2 lignes", apresCommit === 2, `count = ${apresCommit}`);

    writeFileSync(
      recu,
      JSON.stringify(
        {
          fenetre: "T1-INSCRIPTION-REELLE-VINE",
          base: hote,
          commit: true,
          empreintesAvant: avantEmpreintes,
          etatAvant: avantEtat,
          sequenceAvant: seqAvant,
          inscrites,
          canonique: CANONIQUE,
          declarant: DECLARANT,
          cibles: CIBLES,
        },
        null,
        2,
      ) + "\n",
    );
    lignes.push(`   reçu déposé : ${recu}`);
  } finally {
    await client.end();
  }

  console.log("\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko}`);
  console.log(
    commit
      ? `\n⚠️  INSCRIT ET VALIDÉ. ${inscrites.map((x) => `${x.sourceId} = #${x.journalId}`).join(" · ")}\n` +
          "   Ces lignes ne peuvent JAMAIS être retirées ni corrigées."
      : "\n⛔ Rien n'a été inscrit.",
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
