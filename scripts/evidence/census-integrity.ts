#!/usr/bin/env tsx
/**
 * RECENSEMENT D'INTÉGRITÉ — runner. LECTURE SEULE.
 *
 * E-RC INTEGRITY. Logique pure : `src/lib/evidence-chain/integrityVerify.ts`
 * (aucun client S3, aucun accès base, aucune capacité d'écriture — voir son
 * en-tête). Ce fichier ne fait que le câblage.
 *
 * L'ORDRE EST IMPOSÉ, et il est la moitié de la conception :
 *
 *   ÉTAPE 1  --inventaire   ListObjectsV2 seul. Taille EXACTE du corpus, forme
 *                           des ETag, croisement avec le registre.
 *                           ZÉRO OCTET D'OBJET TÉLÉCHARGÉ.
 *   ÉTAPE 2  --recensement  GetObject par clé → SHA-256 recalculé → colonne →
 *                           TSA hors ligne quand il existe.
 *
 * On ne télécharge pas 1 103 objets pour découvrir ensuite combien ils pèsent.
 * L'étape 1 coûte 2 requêtes de classe A et ferme un trou d'un facteur 16
 * (fourchette déclarée : 0,2 à 3,2 Go). L'étape 2 refuse de partir sans elle.
 *
 * ⛔ AUCUNE CORRECTION D'OCTETS. Ce runner n'a ni PutObject, ni DeleteObject,
 *    ni CopyObject, ni $executeRaw. Il constate et il rend compte. La conduite
 *    à tenir sur une divergence est un acte de gouvernance, pas un effet de
 *    bord de la mesure — et elle appartient à la face AUTHORITY.
 *
 * USAGE
 *     npx tsx scripts/evidence/census-integrity.ts --inventaire [--env <chemin>]
 *     npx tsx scripts/evidence/census-integrity.ts --recensement [--limit N]
 *                                                  [--prefix reports/] [--out <fichier>]
 *
 * SORTIE : 0 uniquement si OK. INCIDENT et UNABLE sortent en 1.
 *
 * Aucune valeur de secret n'est imprimée : seuls les NOMS de variables
 * apparaissent, et toute sortie passe par `redact` — le SDK recopie l'hôte
 * appelé dans ses messages d'erreur, donc le compartiment et l'identifiant de
 * compte (mesuré le 2026-08-20, corrigé après fuite réelle).
 */
import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import {
  recenserIntegrite,
  formatCensus,
  exitCodeFor,
  type RegistryRow,
  type FetchedObject,
  type CensusReport,
} from "../../src/lib/evidence-chain/integrityVerify";
import { verifyTimestampOffline } from "../../src/lib/evidence-chain/tsa";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ─── Environnement ──────────────────────────────────────────────────────────

function argValue(nom: string): string | undefined {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Ce dépôt est utilisé en WORKTREE : `.env.local` ne vit que dans la copie
 * principale, et il ne doit JAMAIS être recopié ici (`.gitignore` couvre
 * `.env*`, mais un secret recopié reste un secret de plus sur le disque).
 * On accepte donc un chemin explicite, et on DIT où l'on a cherché.
 */
function chargerEnv(): string {
  const explicite = argValue("--env") ?? process.env.INTERLIGENS_ENV_FILE;
  const candidats = explicite ? [explicite] : [path.join(REPO_ROOT, ".env.local")];
  for (const c of candidats) {
    if (existsSync(c)) {
      config({ path: c, quiet: true });
      return c;
    }
  }
  console.error(`❌ UNABLE — aucun fichier d'environnement trouvé.\n   cherché : ${candidats.join(", ")}\n   passer --env <chemin> ou poser INTERLIGENS_ENV_FILE.`);
  process.exit(1);
}

const ENV_FILE = chargerEnv();

const REQUIRED = ["DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;

/** Une variable manquante ne fait pas « 0 problème ». Elle fait UNABLE. */
function manquantes(): string[] {
  return REQUIRED.filter((v) => !process.env[v]);
}

/** Rôles, jamais valeurs. Une sortie de recensement est faite pour être collée. */
function redact(text: string): string {
  let out = text;
  for (const [nom, valeur] of [
    ["R2_BUCKET_NAME", process.env.R2_BUCKET_NAME],
    ["R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ] as const) {
    if (valeur && valeur.length >= 4) out = out.split(valeur).join(`<${nom}>`);
  }
  return out;
}

function dire(s: string): void {
  console.log(redact(s));
}

// ─── Le registre ────────────────────────────────────────────────────────────

interface LigneSql {
  id: string;
  r2Key: string;
  sha256: string;
  byteSize: number | null;
  mimeType: string | null;
  ingestedAt: Date;
  evidentiaryStatus: string | null;
  tsa_token_b64: string | null;
  tsaCertChain: string | null;
}

async function lireRegistre(prisma: PrismaClient): Promise<RegistryRow[]> {
  // UN SEUL SELECT. Aucun $executeRaw dans ce fichier — aucune écriture
  // possible côté base, et c'est vérifiable à la lecture.
  const lignes = await prisma.$queryRaw<LigneSql[]>`
    SELECT id,
           "r2Key",
           sha256,
           "byteSize",
           "mimeType",
           "ingestedAt",
           "evidentiaryStatus",
           encode("tsaToken", 'base64') AS tsa_token_b64,
           "tsaCertChain"
      FROM "EvidenceItem"
     WHERE "r2Key" IS NOT NULL
     ORDER BY "r2Key"
  `;
  return lignes.map((l) => ({
    id: l.id,
    r2Key: l.r2Key,
    sha256: l.sha256,
    byteSize: l.byteSize === null ? null : Number(l.byteSize),
    mimeType: l.mimeType,
    ingestedAt: new Date(l.ingestedAt).toISOString(),
    evidentiaryStatus: l.evidentiaryStatus,
    // L'ARBITRE. Sans chaîne de certificats archivée, la vérification hors
    // ligne est impossible : on rend `null` plutôt qu'un ancrage qui échouerait
    // pour une raison qui n'est pas l'intégrité.
    tsa: l.tsa_token_b64 && l.tsaCertChain ? { tokenB64: l.tsa_token_b64, certChainPem: l.tsaCertChain } : null,
  }));
}

// ─── Le stockage ────────────────────────────────────────────────────────────

function construireS3(): { s3: S3Client; bucket: string } {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const endpoint = process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;
  return {
    s3: new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    }),
    bucket: process.env.R2_BUCKET_NAME!,
  };
}

interface ObjetListe {
  key: string;
  size: number;
  etag: string | null;
  lastModified: string | null;
}

/** ListObjectsV2 — Size et ETag pour chaque objet. ZÉRO octet d'objet lu. */
async function inventorier(s3: S3Client, bucket: string): Promise<{ objets: ObjetListe[]; requetes: number }> {
  const objets: ObjetListe[] = [];
  let token: string | undefined;
  let requetes = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }));
    requetes++;
    for (const o of r.Contents ?? []) {
      if (!o.Key) continue;
      objets.push({
        key: o.Key,
        size: o.Size ?? 0,
        etag: o.ETag ? o.ETag.replace(/"/g, "") : null,
        lastModified: o.LastModified ? o.LastModified.toISOString() : null,
      });
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return { objets, requetes };
}

async function corpsEnBuffer(body: unknown): Promise<Buffer> {
  const flux = body as AsyncIterable<Uint8Array>;
  const morceaux: Buffer[] = [];
  for await (const m of flux) morceaux.push(Buffer.from(m));
  return Buffer.concat(morceaux);
}

// ─── Rendu des tailles ──────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Kio`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mio`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} Gio`;
}

function prefixeDe(key: string): string {
  const i = key.indexOf("/");
  return i < 0 ? "(racine)" : key.slice(0, i) + "/";
}

// ─── ÉTAPE 1 — L'INVENTAIRE ─────────────────────────────────────────────────

async function etapeInventaire(prisma: PrismaClient): Promise<number> {
  const { s3, bucket } = construireS3();
  dire("ÉTAPE 1 — INVENTAIRE. ListObjectsV2 seul, ZÉRO octet d'objet téléchargé.\n");

  const [{ objets, requetes }, rows] = await Promise.all([inventorier(s3, bucket), lireRegistre(prisma)]);

  const parCle = new Map(objets.map((o) => [o.key, o]));
  const attendues = new Set(rows.map((r) => r.r2Key));

  const presents = rows.filter((r) => parCle.has(r.r2Key));
  const absents = rows.filter((r) => !parCle.has(r.r2Key));
  const sansLigne = objets.filter((o) => !attendues.has(o.key));

  // LA MESURE QUI FERME LE TROU : la taille exacte du corpus gouverné.
  const octetsGouvernes = presents.reduce((s, r) => s + (parCle.get(r.r2Key)?.size ?? 0), 0);
  const octetsTotal = objets.reduce((s, o) => s + o.size, 0);

  // Forme des ETag : `<hex>-<n>` = envoi multipart, l'ETag n'est PAS le MD5 de
  // l'objet et ne peut pas servir d'empreinte calculée par le stockage.
  const multipart = objets.filter((o) => o.etag && /-\d+$/.test(o.etag));
  const monopart = objets.filter((o) => o.etag && /^[0-9a-f]{32}$/.test(o.etag));
  const etagAutre = objets.filter((o) => !o.etag || (!/-\d+$/.test(o.etag) && !/^[0-9a-f]{32}$/.test(o.etag)));

  const prefixes = new Map<string, { n: number; octets: number }>();
  for (const o of objets) {
    const p = prefixeDe(o.key);
    const e = prefixes.get(p) ?? { n: 0, octets: 0 };
    e.n++;
    e.octets += o.size;
    prefixes.set(p, e);
  }

  dire(`requêtes de classe A (LIST) : ${requetes}   ·   objets dans le compartiment : ${objets.length}`);
  dire(`lignes EvidenceItem portant un r2Key : ${rows.length}\n`);

  dire("PAR PRÉFIXE");
  for (const [p, e] of [...prefixes.entries()].sort((a, b) => b[1].octets - a[1].octets)) {
    dire(`  ${p.padEnd(18)} ${String(e.n).padStart(6)} objets   ${fmt(e.octets).padStart(12)}`);
  }

  dire("\nCROISEMENT REGISTRE ↔ STOCKAGE");
  dire(`  lignes présentes  : ${presents.length}`);
  dire(`  lignes ABSENTES   : ${absents.length}`);
  for (const a of absents) {
    dire(`      ${a.r2Key}  →  evidentiaryStatus=${a.evidentiaryStatus ?? "NULL"}`);
  }
  dire(`  objets SANS ligne : ${sansLigne.length}  (hors périmètre d'intégrité — aucune empreinte à opposer)`);

  dire("\nLE BUDGET DU RECENSEMENT — mesuré, plus estimé");
  dire(`  corpus gouverné (lignes présentes) : ${fmt(octetsGouvernes)}  sur ${presents.length} objets`);
  dire(`  moyenne par objet                  : ${fmt(presents.length ? octetsGouvernes / presents.length : 0)}`);
  dire(`  compartiment entier                : ${fmt(octetsTotal)}`);

  dire("\nFORME DES ETag — une empreinte calculée par le STOCKAGE est-elle disponible ?");
  dire(`  mono-part (32 hex, = MD5 de l'objet) : ${monopart.length}`);
  dire(`  multipart (<hex>-<n>, PAS un MD5)    : ${multipart.length}`);
  dire(`  autre forme                          : ${etagAutre.length}`);
  if (monopart.length === objets.length) {
    dire("  → l'ETag est exploitable comme empreinte tierce sur TOUT le compartiment.");
  } else if (multipart.length > 0) {
    dire("  → ⚠️  les objets multipart ne portent PAS de MD5 : l'épinglage d'ETag ne");
    dire("       couvre pas ces clés. À déclarer, jamais à moyenner.");
  }

  dire("\n⛔ aucun octet d'objet n'a été téléchargé. Aucune écriture.");
  return 0;
}

// ─── ÉTAPE 2 — LE RECENSEMENT ───────────────────────────────────────────────

async function etapeRecensement(prisma: PrismaClient): Promise<number> {
  const { s3, bucket } = construireS3();
  const limite = argValue("--limit") ? Number(argValue("--limit")) : undefined;
  const prefixe = argValue("--prefix");

  let rows = await lireRegistre(prisma);
  const total = rows.length;
  let horsPerimetre: { count: number; reason: string } | null = null;

  if (prefixe) {
    const gardees = rows.filter((r) => r.r2Key.startsWith(prefixe));
    horsPerimetre = { count: rows.length - gardees.length, reason: `hors du préfixe demandé (${prefixe}) — NON observées, pas saines` };
    rows = gardees;
  }
  if (limite !== undefined && limite < rows.length) {
    const ecartees = rows.length - limite;
    rows = rows.slice(0, limite);
    horsPerimetre = {
      count: (horsPerimetre?.count ?? 0) + ecartees,
      reason: `${horsPerimetre ? horsPerimetre.reason + " ; " : ""}--limit ${limite} — RECENSEMENT PARTIEL, il n'atteste rien du reste`,
    };
  }

  dire(`ÉTAPE 2 — RECENSEMENT. ${rows.length} clé(s) sur ${total} lignes portant un r2Key.`);
  if (horsPerimetre) dire(`⚠️  PARTIEL : ${horsPerimetre.count} ligne(s) hors périmètre — ${horsPerimetre.reason}`);
  dire("");

  const debut = Date.now();
  let dernier = 0;

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

  const rapport = await recenserIntegrite({
    rows,
    fetchBytes,
    // L'ARBITRE, HORS LIGNE. Aucune requête réseau : seule la chaîne de
    // certificats archivée dans la ligne au moment du stamping est utilisée.
    verifyTsa: async (digest, tokenB64, certChainPem) =>
      (await verifyTimestampOffline(digest, Buffer.from(tokenB64, "base64"), certChainPem)).ok,
    horsPerimetre,
    onProgress: (fait, sur) => {
      const maintenant = Date.now();
      if (maintenant - dernier > 5000 || fait === sur) {
        dernier = maintenant;
        const pct = ((fait / sur) * 100).toFixed(1);
        process.stderr.write(`\r  … ${fait}/${sur} (${pct} %) — ${((maintenant - debut) / 1000).toFixed(0)} s`);
      }
    },
  });
  process.stderr.write("\n\n");

  dire(formatCensus(rapport));
  dire(`\ndurée : ${((Date.now() - debut) / 1000).toFixed(1)} s`);

  ecrireRapport(rapport, rows.length, total);
  return exitCodeFor(rapport);
}

/**
 * Le recensement jour 0 est une ATTESTATION DATÉE : elle se conserve, sinon
 * l'énoncé « inchangé depuis la date où il a été vérifié » n'a pas de date.
 * Hors du dépôt par défaut — ce n'est pas du code, et il porte des clés.
 */
function ecrireRapport(rapport: CensusReport, examinees: number, totalRegistre: number): void {
  const sortie = argValue("--out") ?? path.join(process.env.TMPDIR ?? "/tmp", "interligens-integrity", `census-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  mkdirSync(path.dirname(sortie), { recursive: true });
  writeFileSync(
    sortie,
    JSON.stringify(
      {
        genereLe: new Date().toISOString(),
        outil: "scripts/evidence/census-integrity.ts",
        envFile: path.basename(ENV_FILE),
        totalLignesAvecR2Key: totalRegistre,
        lignesExaminees: examinees,
        rapport,
      },
      null,
      2,
    ),
    "utf8",
  );
  dire(`\nattestation écrite : ${sortie}`);
}

// ─── Entrée ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const absentes = manquantes();
  if (absentes.length > 0) {
    console.error(`❌ UNABLE — variables absentes : ${absentes.join(", ")}  (source : ${path.basename(ENV_FILE)})`);
    process.exit(1);
  }

  const inventaire = process.argv.includes("--inventaire");
  const recensement = process.argv.includes("--recensement");
  if (inventaire === recensement) {
    console.error("usage : --inventaire | --recensement [--limit N] [--prefix p] [--out f] [--env chemin]");
    console.error("L'ORDRE EST IMPOSÉ : l'inventaire ferme la taille du corpus AVANT tout téléchargement.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const code = inventaire ? await etapeInventaire(prisma) : await etapeRecensement(prisma);
    process.exitCode = code;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(redact(`❌ UNABLE — ${(e as Error).stack ?? String(e)}`));
  process.exit(1);
});
