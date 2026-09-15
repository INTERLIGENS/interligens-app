/**
 * sonde-capacite-r2.ts — LA SONDE DE CAPACITÉ. BORNÉE, NON PROBATOIRE, NETTOYÉE.
 *
 * ██  CE N'EST PAS UNE PIÈCE EVIDENCE. CE N'EN SERA JAMAIS UNE.              ██
 *
 * Elle établit ce que le credential du compartiment de NAISSANCE peut
 * réellement faire, et RIEN d'autre. Trois faits distincts, qu'elle refuse de
 * fondre en un seul :
 *
 *     WRITE   established
 *     READ    established
 *     DELETE  observed because probe cleanup required
 *
 * ⚠️ LA TROISIÈME LIGNE N'EST PAS UNE CAPACITÉ CONSACRÉE. Le pipeline Evidence
 * normal n'a AUCUN besoin de DELETE. Si la sonde établit que le credential le
 * possède, c'est un fait de BLAST RADIUS à documenter — jamais une exigence
 * produit. Transformer « observé » en « requis » ferait entrer la suppression
 * dans le contrat d'un chemin probatoire, et c'est exactement l'inverse de ce
 * qu'on veut.
 *
 * ─── LES INTERDITS, ET ILS SONT STRUCTURELS ─────────────────────────────────
 *
 *   ⛔ AUCUNE clé `evidence/<sha>`. Le namespace est `_capability-probes/<UUID>`,
 *      et il est explicitement NON PROBATOIRE.
 *   ⛔ AUCUN EvidenceItem, AUCUNE ligne de journal, AUCUN appel TSA. Ce script
 *      n'ouvre même pas de connexion base.
 *   ⛔ AUCUN secret, AUCUNE donnée nominative dans la charge utile.
 *   ⛔ LE DELETE NE PORTE QUE SUR L'OBJET QUE CETTE EXÉCUTION A CRÉÉ. Son
 *      identité (compartiment + clé + ETag rendu par le PUT) est conservée EN
 *      MÉMOIRE par le processus et RECONFRONTÉE avant la suppression. Si le PUT
 *      répond « déjà présent », ou si l'identité cesse d'être certaine à un
 *      quelconque moment : on ne supprime RIEN, on s'arrête, on rapporte.
 *
 * ─── ET ELLE OBSERVE L'ATOMICITÉ, PLUTÔT QUE DE LA CITER ────────────────────
 *
 * La documentation dit que `If-None-Match: *` est supporté par R2 et rend 412.
 * Elle ne dit pas qu'un serveur qui l'IGNORERAIT se signalerait — un serveur
 * qui l'ignore écrase en rendant 200. La sonde rejoue donc un SECOND PUT
 * conditionnel sur SA PROPRE clé, déjà occupée, et regarde ce qui revient.
 * C'est la seule façon de distinguer « garanti » de « documenté ».
 *
 *     npx tsx src/scripts/evidence-chain/sonde-capacite-r2.ts
 */
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import {
  ouvrirCompartimentGouverne,
  exigerCapaciteDEcriture,
  rendreRefusDeCompartiment,
} from "../../lib/evidence-chain/compartment";
import { putEvidenceObjectIfAbsent, getEvidenceObject, deleteEvidenceObject } from "../../lib/evidence-chain/r2";

const REPO = path.resolve(__dirname, "..", "..", "..");
config({ path: path.join(REPO, ".env.local"), quiet: true });

/** Le namespace NON PROBATOIRE. Jamais `evidence/`, jamais une clé de contenu. */
const NAMESPACE = "_capability-probes";
const PAYLOAD_V1 = "INTERLIGENS_R2_CAPABILITY_PROBE_V1";

type Etat = "established" | "refused" | "not attempted";
const rapport: Record<string, { etat: Etat; detail: string }> = {};
const dire = (quoi: string, etat: Etat, detail: string) => { rapport[quoi] = { etat, detail }; };

async function head(s3: never, bucket: string, key: string): Promise<{ present: true; etag: string | null } | { present: false; statut: number | null }> {
  try {
    const r = await (s3 as unknown as { send: (c: unknown) => Promise<{ ETag?: string }> })
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { present: true, etag: r.ETag ?? null };
  } catch (e) {
    const statut = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode ?? null;
    if (statut === 404) return { present: false, statut };
    // ⚠️ Un 403 n'est PAS une absence. Chercher sans droit de regarder et ne rien
    // voir n'est pas constater qu'il n'y a rien.
    throw e;
  }
}

async function main() {
  // ── LA PORTE. Celle de la NAISSANCE : c'est SA capacité qu'on mesure.
  const porte = ouvrirCompartimentGouverne();
  if (!porte.ok) {
    console.error(`[sonde] ${rendreRefusDeCompartiment(porte)}`);
    process.exit(1);
  }
  const ecriture = exigerCapaciteDEcriture(porte);
  if ("ok" in ecriture) {
    console.error(`[sonde] ${rendreRefusDeCompartiment(ecriture)}`);
    process.exit(1);
  }
  const { s3, bucket } = ecriture;

  // ── L'IDENTITÉ DE LA SONDE. Aléatoire, tenue en mémoire, jamais recalculée.
  const uuid = randomUUID();
  const key = `${NAMESPACE}/${uuid}`;
  const nonce = randomBytes(16).toString("hex");
  const body = Buffer.from(`${PAYLOAD_V1} ${nonce}\n`, "utf8");

  console.log(`[sonde] compartiment : ${bucket}`);
  console.log(`[sonde] clé          : ${key}`);
  console.log(`[sonde] charge       : ${PAYLOAD_V1} + nonce (${body.length} o, aucun secret, aucune donnée nominative)`);
  console.log("");

  let creeParCetteExecution = false;
  let etagDuPut: string | null = null;

  try {
    // ══ 1 · WRITE ═════════════════════════════════════════════════════════
    const ecrit = await putEvidenceObjectIfAbsent(s3 as never, bucket, key, body, "text/plain");
    if (!ecrit.ok) {
      // Une clé UUID déjà occupée : l'identité de l'objet n'est PAS la nôtre.
      dire("WRITE", "refused", `${ecrit.cause} — ${ecrit.detail}`);
      dire("READ", "not attempted", "l'écriture n'a pas établi d'objet à relire.");
      dire("DELETE", "not attempted",
        "⛔ RIEN N'EST SUPPRIMÉ : le PUT répond « déjà présent », donc cet objet n'a pas été créé " +
        "par cette exécution. Supprimer ce qu'on n'a pas créé serait exactement l'inverse d'un nettoyage.");
      return;
    }
    creeParCetteExecution = true;
    etagDuPut = ecrit.etag;
    dire("WRITE", "established", `PutObject conditionnel accepté (ETag ${etagDuPut ?? "(non rendu)"}), ${body.length} o.`);

    // ══ 1bis · L'ATOMICITÉ, OBSERVÉE ═══════════════════════════════════════
    // Second PUT conditionnel sur LA MÊME clé, désormais occupée par nous.
    const rejoue = await putEvidenceObjectIfAbsent(s3 as never, bucket, key, body, "text/plain");
    dire("CONDITIONAL-WRITE",
      rejoue.ok ? "refused" : "established",
      rejoue.ok
        ? "⛔ LE SERVEUR A ACCEPTÉ un second PUT conditionnel sur une clé OCCUPÉE : `If-None-Match: *` " +
          "est IGNORÉ ici. L'écriture conditionnelle n'est PAS une garantie sur ce stockage."
        : `un second PUT conditionnel sur la clé occupée est REFUSÉ (${rejoue.cause}) : la condition est ` +
          "bien évaluée côté serveur, dans la même opération que l'écriture.");

    // ══ 2 · READ ══════════════════════════════════════════════════════════
    const vu = await head(s3 as never, bucket, key);
    if (!vu.present) {
      dire("READ", "refused", "HeadObject ne voit pas l'objet que le PUT vient d'accepter.");
    } else {
      const relu = await getEvidenceObject(s3 as never, bucket, key);
      const identique = relu.equals(body);
      dire("READ", identique ? "established" : "refused",
        identique
          ? `GetObject rend ${relu.length} o, identiques aux octets écrits (ETag ${vu.etag ?? "(aucun)"}).`
          : `GetObject rend ${relu.length} o DIFFÉRENTS des ${body.length} o écrits.`);
      if (!identique) {
        dire("DELETE", "not attempted",
          "⛔ RIEN N'EST SUPPRIMÉ : les octets relus ne sont pas ceux écrits, donc l'identité de " +
          "l'objet sous cette clé n'est plus certaine.");
        return;
      }
      // L'ETag doit être celui que le PUT a rendu. S'il a changé, quelqu'un
      // d'autre est passé par là, et cet objet n'est plus le nôtre.
      if (etagDuPut && vu.etag && etagDuPut !== vu.etag) {
        dire("DELETE", "not attempted",
          `⛔ RIEN N'EST SUPPRIMÉ : l'ETag observé (${vu.etag}) diffère de celui rendu par le PUT ` +
          `(${etagDuPut}). L'identité de l'objet n'est plus certaine.`);
        return;
      }
    }

    // ══ 3 · DELETE — UNIQUEMENT LA CLÉ QUE CETTE EXÉCUTION A CRÉÉE ════════
    if (!creeParCetteExecution) {
      dire("DELETE", "not attempted", "⛔ l'objet n'a pas été créé par cette exécution.");
      return;
    }
    try {
      await deleteEvidenceObject(s3 as never, bucket, key);
      const apres = await head(s3 as never, bucket, key);
      dire("DELETE",
        apres.present ? "refused" : "established",
        apres.present
          ? "DeleteObject n'a pas levé, mais l'objet est TOUJOURS là."
          : "DeleteObject accepté, HeadObject rend 404 ensuite — le namespace de sonde est vide.");
    } catch (e) {
      dire("DELETE", "refused",
        `DeleteObject REFUSÉ : ${(e as Error).name}. ⚠️ L'objet de sonde RESTE en place sous ${key} — ` +
        "il n'est pas probatoire, et il est nommément identifiable.");
    }
  } finally {
    console.log("═══ CE QUE LA SONDE ÉTABLIT — TROIS FAITS, JAMAIS FONDUS ═══\n");
    for (const [quoi, r] of Object.entries(rapport)) {
      console.log(`  ${quoi.padEnd(18)} ${r.etat}`);
      console.log(`  ${" ".repeat(18)} ${r.detail}\n`);
    }
    console.log("⚠️ DELETE est OBSERVÉ parce que le nettoyage de la sonde l'exige. Ce n'est PAS une");
    console.log("   capacité consacrée : le pipeline Evidence n'en a aucun besoin. Si le credential");
    console.log("   la possède, c'est un fait de BLAST RADIUS à documenter, pas une exigence produit.");
  }
}

main().catch((e) => { console.error("[sonde] FATAL", e); process.exit(1); });
