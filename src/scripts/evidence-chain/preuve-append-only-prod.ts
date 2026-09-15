/**
 * preuve-append-only-prod.ts — LE VERROU, ESSAYÉ POUR DE VRAI, EN PRODUCTION.
 *
 * ██  « Un verrou qu'on n'a pas essayé de forcer n'est pas un verrou mesuré. » ██
 *
 * Le DDL est posé, le post-check est vert, les deux triggers sont `tgenabled = 'O'`.
 * Rien de tout cela ne PROUVE qu'un UPDATE est refusé : ça prouve qu'un mécanisme
 * est déclaré. On va donc le forcer — et constater le refus.
 *
 * ─── LA SEULE ÉCRITURE DE CETTE FENÊTRE, ET ELLE EST ANNULÉE ────────────────
 *
 *     BEGIN … (INSERT témoin, UPDATE, DELETE, TRUNCATE) … ROLLBACK
 *
 * ⛔ CE SCRIPT NE CONTIENT AUCUN `COMMIT`. C'est vérifiable à l'œil et un témoin
 *    structurel le vérifie aussi. Le `ROLLBACK` est dans un `finally`, donc il
 *    part même si tout échoue en route.
 *
 * ⛔ IL N'INSCRIT AUCUNE DES 31. La ligne témoin est ANNULÉE, et le script
 *    REFUSE de démarrer si la table n'est pas vide : s'il y avait des lignes
 *    réelles, un TRUNCATE tenté — même refusé, même annulé — prendrait un verrou
 *    ACCESS EXCLUSIVE sur une table qui porte des faits. On ne force pas un
 *    verrou sur des preuves.
 *
 * ─── POURQUOI DES SAVEPOINTS, ET NON QUATRE ORDRES À LA SUITE ───────────────
 *
 * En PostgreSQL, une erreur AVORTE la transaction : après le premier refus
 * (23001), tout ordre suivant échouerait en 25P02 « current transaction is
 * aborted » et on mesurerait l'avortement, pas le verrou. Chaque tentative vit
 * donc dans son SAVEPOINT, relâché après constat. Les trois refus sont alors
 * TROIS mesures indépendantes, et non une mesure suivie de deux échos.
 *
 * ─── LA SÉQUENCE N'EST PAS TRANSACTIONNELLE ────────────────────────────────
 *
 * L'INSERT témoin consomme une valeur d'IDENTITY que le ROLLBACK NE REND PAS.
 * C'est normal, documenté, et sans conséquence : la colonne `id` garantit un
 * ORDRE, jamais une continuité. Les trous sont attendus — le DDL le dit déjà.
 * Le script RELÈVE la valeur consommée pour que le premier INSERT réel ne
 * surprenne personne en commençant à 2.
 *
 *     npx tsx src/scripts/evidence-chain/preuve-append-only-prod.ts
 *
 * Sortie : 0 si les quatre attendus sont tenus, 1 sinon.
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";

const REPO = path.resolve(__dirname, "..", "..", "..");
config({ path: path.join(REPO, ".env.local"), quiet: true });

const TABLE = "evidence_storage_location_journal";
/** `restrict_violation` — le code que les deux triggers LÈVENT. */
const ATTENDU = "23001";

let echecs = 0;
const dit = (ok: boolean, quoi: string, detail = "") => {
  console.log(`  ${ok ? "✅" : "❌"} ${quoi}${detail ? ` — ${detail}` : ""}`);
  if (!ok) echecs++;
};

/** La forme minimale d'un exécuteur transactionnel. */
type Tx = Prisma.TransactionClient;

/** Le SQLSTATE d'un ordre, ou "OK". Jamais l'exception brute : on MESURE. */
async function etat(tx: Tx, sql: string, p: unknown[] = []): Promise<string> {
  try {
    await tx.$queryRawUnsafe(sql, ...p);
    return "OK";
  } catch (e) {
    const err = e as { code?: string; meta?: { code?: string } };
    // Prisma enveloppe : P2010 porte le vrai SQLSTATE dans `meta.code`.
    return err.meta?.code ?? err.code ?? "SANS-CODE";
  }
}

const un = <T,>(rows: unknown): T => (rows as T[])[0];

/**
 * Le sentinelle qui fait ROLLBACK. Sortir de `$transaction` par une exception
 * est la SEULE façon d'annuler — et c'est justement ce qu'on veut : le chemin
 * de sortie normal de ce script est une exception, jamais un COMMIT.
 */
class RollbackVoulu extends Error {
  constructor(readonly rapport: string[]) { super("ROLLBACK voulu"); }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("UNABLE : DATABASE_URL absente. Aucune mesure possible.");
    process.exit(1);
  }
  const prisma = new PrismaClient();

  try {
    // ── GARDE 0 · la table doit être VIDE. Sinon on ne force rien du tout.
    const { n } = un<{ n: string }>(await prisma.$queryRawUnsafe(`SELECT count(*)::text AS n FROM ${TABLE}`));
    console.log(`\n═══ ÉTAT AVANT : ${n} ligne(s) dans ${TABLE} ═══`);
    if (n !== "0") {
      console.error(
        `\n⛔ REFUS : la table porte ${n} ligne(s). Ce script tente un TRUNCATE, qui prend un\n` +
          "   verrou ACCESS EXCLUSIVE avant même que le trigger ne refuse. On ne force pas un\n" +
          "   verrou sur une table qui porte des faits probatoires.",
      );
      process.exit(1);
    }

    // ── La pièce témoin : une VRAIE, prise dans l'univers d'horodatage. La FK
    // l'exige, et c'est aussi ce qui rend la mesure représentative.
    const piece = un<{ id: string; r2Key: string }>(await prisma.$queryRawUnsafe(
      `SELECT "id", "r2Key" FROM "EvidenceItem"
        WHERE "tsaToken" IS NULL AND "evidentiaryStatus" IS NULL AND "r2Key" IS NOT NULL
        ORDER BY "ingestedAt" ASC LIMIT 1`,
    ));
    if (!piece) { console.error("UNABLE : aucune pièce éligible pour servir de témoin."); process.exit(1); }
    console.log(`  pièce témoin : ${piece.id}`);

    const seqSql = `SELECT last_value::text AS last_value FROM pg_sequences
                     WHERE schemaname = 'public' AND sequencename LIKE '${TABLE}%'`;
    const seqAvant = un<{ last_value: string | null }>(await prisma.$queryRawUnsafe(seqSql));

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ Transaction INTERACTIVE : Prisma épingle UNE connexion pour toute sa
    // durée — indispensable derrière pgbouncer, où un pool rendrait le BEGIN et
    // le ROLLBACK potentiellement étrangers l'un à l'autre.
    // Et surtout : on en sort TOUJOURS par une exception. Il n'y a aucun chemin
    // de code qui aboutisse à un COMMIT.
    console.log("\n═══ BEGIN — tout ce qui suit sera ANNULÉ ═══");
    try {
      await prisma.$transaction(async (tx) => {
        // ── 1 · L'INSERT témoin. DECLARED_AT_WRITE, valeurs plausibles, aucune
        //        observation (le CHECK l'exige pour ce mode).
        const insert = await etat(tx,
          `INSERT INTO ${TABLE}
             (evidence_item_id, bucket, storage_key, establishment_mode, declared_by, declared_at)
           VALUES ($1, $2, $3, 'DECLARED_AT_WRITE', $4, now())`,
          [piece.id, "interligens-reports", piece.r2Key, "T1/preuve-append-only (ANNULEE)"],
        );
        dit(insert === "OK", "INSERT d'une ligne témoin ACCEPTÉ", `état ${insert}`);
        if (insert !== "OK") console.error("  ⛔ sans ligne témoin, les trois refus ne mesureraient rien.");

        const { n: posee } = un<{ n: string }>(await tx.$queryRawUnsafe(`SELECT count(*)::text AS n FROM ${TABLE}`));
        dit(posee === "1", "la ligne témoin est bien présente DANS la transaction", `${posee} ligne(s)`);

        // ── 2/3/4 · Chaque tentative vit dans son SAVEPOINT : sinon la première
        //        erreur avorte la transaction et on mesurerait 25P02 — l'écho de
        //        l'avortement — au lieu du verrou.
        for (const [nom, point, sql] of [
          ["UPDATE", "s_update", `UPDATE ${TABLE} SET bucket = 'interligens-evidence'`],
          ["DELETE", "s_delete", `DELETE FROM ${TABLE}`],
          // TRUNCATE ne passe PAS par les triggers de ligne : c'est le second
          // trigger, FOR EACH STATEMENT, qui le refuse. Sans lui, le verrou
          // serait contournable par un seul ordre.
          ["TRUNCATE", "s_truncate", `TRUNCATE ${TABLE}`],
        ] as const) {
          await tx.$executeRawUnsafe(`SAVEPOINT ${point}`);
          const code = await etat(tx, sql);
          dit(code === ATTENDU,
              `${nom} REFUSÉ (${ATTENDU} restrict_violation)` +
              (nom === "TRUNCATE" ? " — il ne passe pas par les triggers de ligne" : ""),
              `état ${code}`);
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${point}`);
        }

        // ── 5 · Après les trois refus, la ligne est TOUJOURS là. Un refus qui
        //        aurait « à moitié » agi ne serait pas un refus.
        const { n: apres3 } = un<{ n: string }>(await tx.$queryRawUnsafe(`SELECT count(*)::text AS n FROM ${TABLE}`));
        dit(apres3 === "1", "après les trois refus, la ligne témoin est INTACTE", `${apres3} ligne(s)`);

        // LA SORTIE. Toujours celle-ci.
        throw new RollbackVoulu([]);
      }, { timeout: 30_000 });
      // Inatteignable : le bloc ci-dessus lève toujours.
      dit(false, "la transaction a abouti sans lever — le ROLLBACK n'a PAS eu lieu");
    } catch (e) {
      if (!(e instanceof RollbackVoulu)) throw e;
      console.log("\n═══ ROLLBACK — la transaction est annulée ═══");
    }

    // ── 6 · RELECTURE APRÈS ROLLBACK. C'est ce constat, et lui seul, qui
    //        établit que la production n'a pas bougé.
    const { n: apres } = un<{ n: string }>(await prisma.$queryRawUnsafe(`SELECT count(*)::text AS n FROM ${TABLE}`));
    dit(apres === "0", "la table est de nouveau VIDE — aucune des 31 n'est inscrite", `${apres} ligne(s)`);

    const seqApres = un<{ last_value: string | null }>(await prisma.$queryRawUnsafe(seqSql));
    console.log(
      `\n  SÉQUENCE : avant = ${seqAvant?.last_value ?? "jamais appelée"} · après = ${seqApres?.last_value ?? "jamais appelée"}`,
    );
    console.log(
      "  ⚠️ La séquence n'est PAS transactionnelle : le ROLLBACK ne rend pas la valeur\n" +
        "     consommée. C'est attendu — `id` garantit un ORDRE, jamais une continuité, et le\n" +
        "     DDL le dit déjà (« les TROUS sont normaux ; seul l'ORDRE compte »). Le premier\n" +
        "     INSERT réel ne commencera donc pas à 1, et ce n'est pas une anomalie.",
    );

    // ── 7 · Les triggers sont TOUJOURS armés. Un verrou qu'on force ne doit
    //        pas s'être désarmé en chemin.
    const trg = (await prisma.$queryRawUnsafe(
      `SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger t
         JOIN pg_class cl ON cl.oid = t.tgrelid
        WHERE cl.relname = '${TABLE}' AND NOT t.tgisinternal ORDER BY tgname`,
    )) as Array<{ tgname: string; tgenabled: string }>;
    dit(trg.length === 2 && trg.every((x) => x.tgenabled === "O"),
        "les deux triggers sont TOUJOURS armés après l'épreuve",
        trg.map((x) => `${x.tgname}=${x.tgenabled}`).join(" · "));
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n═══ ${echecs === 0 ? "LES QUATRE ATTENDUS SONT TENUS" : `${echecs} ÉCHEC(S)`} ═══`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => { console.error("[preuve-append-only-prod] FATAL", e); process.exit(1); });
