#!/usr/bin/env tsx
/**
 * CANARI D'INTÉGRITÉ — le témoin de niveau 3, sur le VRAI chemin R2.
 *
 * E-RC INTEGRITY, préalable (b). Les tests de `__tests__/security/
 * evidence-integrity-verify.test.ts` prouvent que le comparateur mord, et que
 * la chaîne complète mord sur un FAUX R2. Ils laissent dehors une seule chose,
 * et c'est la seule qu'aucune feinte ne donne : LE RÉSEAU RÉEL.
 *
 *   « Le témoin sans écriture prouve la logique, le canari prouve le vrai
 *     chemin R2. Nous avons besoin des deux. »
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE SCRIPT ÉCRIT, ET OÙ — la condition stricte de l'autorisation
 * ─────────────────────────────────────────────────────────────────────────
 * UNIQUEMENT sous le préfixe `integrity-canary/`. JAMAIS `evidence/`, JAMAIS
 * `reports/`. Trois barrières, et elles sont dans le code, pas dans ce
 * commentaire :
 *
 *   1. `assertPrefixeAutorise` refuse toute clé qui ne commence pas par
 *      `integrity-canary/` — appelée avant CHAQUE Put et CHAQUE Delete.
 *   2. Ce fichier n'importe PAS `PrismaClient`. Il est donc structurellement
 *      incapable de créer une ligne `EvidenceItem` : le canari ne peut pas
 *      entrer dans l'univers probatoire, même par erreur de câblage.
 *   3. Les objets portent une charge utile qui DIT ce qu'ils sont, en clair,
 *      dans leurs premiers octets. Un objet trouvé là ne peut pas être pris
 *      pour une pièce.
 *
 * La ligne de registre du canari est FABRIQUÉE ICI, en mémoire, et n'existe
 * nulle part ailleurs. C'est ce qui permet de fixer `ingestedAt` — donc de
 * démontrer le discriminant de la substitution, qui compare la date d'écriture
 * du stockage à celle de l'ingestion.
 *
 * ⛔ AUCUN objet probatoire n'est lu, écrit, muté ni supprimé par ce script.
 *
 * USAGE
 *     npx tsx scripts/evidence/integrity-canary.ts [--keep] [--env <chemin>]
 *
 * SORTIE : 0 seulement si LES CINQ morsures ont mordu. Un canari qui ne mord
 * pas sort en 1 — c'est le point : « aucune divergence trouvée » ne doit
 * jamais pouvoir être rendu par un mécanisme qui ne sait plus détecter.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  recenserIntegrite,
  type RegistryRow,
  type FetchedObject,
  type ItemVerdict,
} from "../../src/lib/evidence-chain/integrityVerify";
import { sha256Buffer } from "../../src/lib/evidence-chain/hash";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** LA BARRIÈRE. Aucune écriture n'existe ailleurs que sous ce préfixe. */
const PREFIXE_CANARI = "integrity-canary/";

function argValue(nom: string): string | undefined {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function chargerEnv(): string {
  const explicite = argValue("--env") ?? process.env.INTERLIGENS_ENV_FILE;
  const candidats = explicite ? [explicite] : [path.join(REPO_ROOT, ".env.local")];
  for (const c of candidats) {
    if (existsSync(c)) {
      config({ path: c, quiet: true });
      return c;
    }
  }
  console.error(`❌ UNABLE — aucun fichier d'environnement trouvé.\n   cherché : ${candidats.join(", ")}`);
  process.exit(1);
}

const ENV_FILE = chargerEnv();

function redact(text: string): string {
  let out = text;
  for (const [nom, valeur] of [
    ["R2_BUCKET_NAME", process.env.R2_BUCKET_NAME],
    ["R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY],
  ] as const) {
    if (valeur && valeur.length >= 4) out = out.split(valeur).join(`<${nom}>`);
  }
  return out;
}

function dire(s: string): void {
  console.log(redact(s));
}

/**
 * Appelée avant chaque mutation. Elle ne prévient pas : elle arrête le
 * processus. Une barrière qui se contente d'avertir n'est pas une barrière.
 */
function assertPrefixeAutorise(key: string, operation: string): void {
  if (!key.startsWith(PREFIXE_CANARI)) {
    console.error(`❌ REFUS — ${operation} sur « ${key} » : hors du préfixe ${PREFIXE_CANARI}.`);
    console.error("   Ce script n'écrit QUE dans l'infrastructure de contrôle. Jamais sur une pièce.");
    process.exit(1);
  }
}

/**
 * La charge utile DIT ce qu'elle est, dans ses premiers octets. Un objet
 * trouvé sous ce préfixe ne peut pas être pris pour une pièce de preuve, même
 * par quelqu'un qui ne connaîtrait pas ce script.
 */
function charge(variante: string, taille: number): Buffer {
  const entete = Buffer.from(
    `INTEGRITY-CANARY / NON PROBATOIRE / CONTROL INFRASTRUCTURE\n` +
      `Ceci n'est PAS une piece de preuve. Aucune ligne EvidenceItem ne le reference.\n` +
      `Genere par scripts/evidence/integrity-canary.ts le ${new Date().toISOString()}\n` +
      `variante=${variante}\n`,
    "utf8",
  );
  const reste = Math.max(0, taille - entete.length);
  return Buffer.concat([entete, randomBytes(reste)]);
}

// ─── Le câblage, identique à celui du recensement ───────────────────────────

function construireS3(): { s3: S3Client; bucket: string } {
  const accountId = process.env.R2_ACCOUNT_ID!;
  return {
    s3: new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    }),
    bucket: process.env.R2_BUCKET_NAME!,
  };
}

async function corpsEnBuffer(body: unknown): Promise<Buffer> {
  const morceaux: Buffer[] = [];
  for await (const m of body as AsyncIterable<Uint8Array>) morceaux.push(Buffer.from(m));
  return Buffer.concat(morceaux);
}

interface Morsure {
  nom: string;
  attendu: ItemVerdict;
  obtenu?: ItemVerdict;
  detail?: string;
}

async function main(): Promise<void> {
  const requis = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;
  const absentes = requis.filter((v) => !process.env[v]);
  if (absentes.length > 0) {
    console.error(`❌ UNABLE — variables absentes : ${absentes.join(", ")} (source : ${path.basename(ENV_FILE)})`);
    process.exit(1);
  }

  const { s3, bucket } = construireS3();
  const garder = process.argv.includes("--keep");
  const course = new Date().toISOString().replace(/[:.]/g, "-");
  const cle = `${PREFIXE_CANARI}${course}/objet-de-controle.bin`;
  const cleJamaisEcrite = `${PREFIXE_CANARI}${course}/objet-qui-ne-sera-jamais-ecrit.bin`;

  dire("CANARI D'INTÉGRITÉ — le vrai chemin R2, sur un objet NON PROBATOIRE.\n");
  dire(`préfixe autorisé : ${PREFIXE_CANARI}  (toute autre clé fait REFUS)`);
  dire(`clé de contrôle  : ${cle}`);
  dire("");

  const fetchBytes = async (key: string): Promise<FetchedObject> => {
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await corpsEnBuffer(r.Body);
    return {
      bytes,
      contentLength: r.ContentLength ?? null,
      lastModified: r.LastModified ? r.LastModified.toISOString() : null,
      etag: r.ETag ? r.ETag.replace(/"/g, "") : null,
    };
  };
  // Le canari n'a pas d'ancrage tiers : on ne demande pas un horodatage à une
  // autorité pour un objet qui n'est pas une preuve.
  const verifyTsa = async (): Promise<boolean> => false;

  /** Fabrique la ligne de registre EN MÉMOIRE. Elle n'existe nulle part ailleurs. */
  function ligne(over: Partial<RegistryRow> & { sha256: string }): RegistryRow {
    return {
      id: `canari-${course}`,
      r2Key: cle,
      byteSize: null,
      mimeType: "application/octet-stream",
      ingestedAt: new Date().toISOString(),
      evidentiaryStatus: null,
      tsa: null,
      ...over,
    };
  }

  /**
   * Rend `obtenu`, et NON `verdict` : le spread d'un objet plus large dans un
   * littéral n'active pas le contrôle de propriétés excédentaires de
   * TypeScript. Une première version rendait `{ verdict, detail }`, le champ
   * `obtenu` restait `undefined`, et les six morsures étaient annoncées EN
   * ÉCHEC alors que les six classifications étaient justes. Le tableau de bord
   * mentait dans le sens prudent — mais il mentait.
   */
  async function verdictPour(row: RegistryRow): Promise<{ obtenu: ItemVerdict; detail: string }> {
    const rapport = await recenserIntegrite({ rows: [row], fetchBytes, verifyTsa });
    const it = rapport.items[0];
    return { obtenu: it.verdict, detail: it.detail };
  }

  const morsures: Morsure[] = [];
  let ecrit = false;

  try {
    // ── 0. ÉCRITURE, puis RELECTURE — la démonstration de L-c en miniature ──
    const origine = charge("origine", 4096);
    const empreinteOrigine = sha256Buffer(origine);
    assertPrefixeAutorise(cle, "PutObject");
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: cle, Body: origine, ContentType: "application/octet-stream" }));
    ecrit = true;
    dire(`écrit : ${origine.length} octets, sha256 ${empreinteOrigine.slice(0, 16)}…\n`);

    // MORSURE 0 — le contrôle NÉGATIF. Si le mécanisme criait toujours, les
    // quatre suivantes seraient vertes pour la mauvaise raison.
    morsures.push({
      nom: "0. objet INTACT relu depuis R2 → doit être VÉRIFIÉ",
      attendu: "VERIFIED_UNANCHORED",
      ...(await verdictPour(ligne({ sha256: empreinteOrigine, byteSize: origine.length }))),
    });

    // MORSURE 1 — UN OCTET. Le même geste que T1 sur le guard, mais à travers
    // le réseau : on écrase l'objet par une variante d'un seul octet d'écart.
    const unOctet = Buffer.from(origine);
    unOctet[unOctet.length - 1] = unOctet[unOctet.length - 1] ^ 0x01;
    assertPrefixeAutorise(cle, "PutObject");
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: cle, Body: unOctet, ContentType: "application/octet-stream" }));
    morsures.push({
      nom: "1. UN SEUL octet muté, longueur identique → DIVERGENCE",
      attendu: "DIVERGENT_CORRUPTED",
      ...(await verdictPour(ligne({ sha256: empreinteOrigine, byteSize: origine.length }))),
    });

    // MORSURE 2 — la même mutation, mais la ligne déclare une ingestion
    // ANCIENNE : l'écriture est alors trop tardive pour être celle de
    // l'ingestion, et le discriminant de la SUBSTITUTION doit s'armer.
    const ingestionAncienne = new Date(Date.now() - 6 * 3600_000).toISOString();
    morsures.push({
      nom: "2. même objet, ingestion d'il y a 6 h → SUBSTITUTION (écriture postérieure)",
      attendu: "DIVERGENT_SUBSTITUTED",
      ...(await verdictPour(ligne({ sha256: empreinteOrigine, byteSize: origine.length, ingestedAt: ingestionAncienne }))),
    });

    // MORSURE 3 — TRONCATURE : l'objet devient plus court que le registre ne
    // le déclare.
    const court = origine.subarray(0, 512);
    assertPrefixeAutorise(cle, "PutObject");
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: cle, Body: court, ContentType: "application/octet-stream" }));
    morsures.push({
      nom: "3. objet TRONQUÉ (512 o contre 4096 déclarés) → TRONCATURE",
      attendu: "DIVERGENT_TRUNCATED",
      ...(await verdictPour(ligne({ sha256: empreinteOrigine, byteSize: origine.length }))),
    });

    // MORSURE 4 — L'ABSENCE, sur le vrai chemin : une clé jamais écrite. C'est
    // le 404 de R2 qui est éprouvé ici, pas une feinte.
    morsures.push({
      nom: "4. clé JAMAIS écrite, ligne non étiquetée → ABSENCE NON DÉCLARÉE",
      attendu: "ABSENT_UNDECLARED",
      ...(await verdictPour(ligne({ sha256: "0".repeat(64), r2Key: cleJamaisEcrite }))),
    });

    // MORSURE 5 — la même clé absente, mais étiquetée : l'absence est ATTENDUE
    // et ne doit PAS être comptée comme une divergence (ruling (d)).
    morsures.push({
      nom: "5. même clé absente, ligne BYTES_LOST → ABSENCE CONNUE, pas une divergence",
      attendu: "ABSENT_KNOWN",
      ...(await verdictPour(ligne({ sha256: "0".repeat(64), r2Key: cleJamaisEcrite, evidentiaryStatus: "BYTES_LOST" }))),
    });
  } finally {
    if (ecrit && !garder) {
      assertPrefixeAutorise(cle, "DeleteObject");
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: cle }));
      dire(`\nnettoyé : ${cle} supprimé (préfixe de contrôle, hors univers probatoire).`);
    } else if (ecrit) {
      dire(`\n--keep : ${cle} laissé en place.`);
    }
  }

  dire("\n─── LES MORSURES, SUR LE VRAI CHEMIN ───────────────────────────────\n");
  let echecs = 0;
  for (const m of morsures) {
    const ok = m.obtenu === m.attendu;
    if (!ok) echecs++;
    dire(`${ok ? "✅" : "❌"} ${m.nom}`);
    dire(`   attendu ${m.attendu} · obtenu ${m.obtenu}`);
    if (!ok) dire(`   détail : ${m.detail}`);
  }

  dire("");
  if (echecs === 0) {
    dire(`LE CANARI MORD. ${morsures.length} morsures, ${morsures.length} cris attendus, sur le réseau réel.`);
    dire("Le témoin est POSITIF : une altération d'octets EST détectée par le chemin");
    dire("qui sera utilisé sur le corpus. « Aucune divergence » cesse d'être vacant.");
  } else {
    dire(`❌ ${echecs} morsure(s) sur ${morsures.length} n'ont PAS mordu.`);
    dire("Un mécanisme qui ne détecte pas une altération qu'on vient de poser n'atteste RIEN.");
  }
  process.exitCode = echecs === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(redact(`❌ UNABLE — ${(e as Error).stack ?? String(e)}`));
  process.exit(1);
});
