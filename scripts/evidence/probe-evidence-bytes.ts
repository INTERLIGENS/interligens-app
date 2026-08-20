#!/usr/bin/env tsx
/**
 * SONDE D'EXISTENCE DES OCTETS — runner. LECTURE SEULE.
 *
 * Logique pure : src/lib/evidence-chain/bytesProbe.ts (aucun accès base,
 * aucun client S3 — voir l'en-tête de ce module pour le pourquoi C4).
 * Ce fichier ne fait que le câblage : registre → liste attendue, R2 → HeadObject.
 *
 * USAGE
 *     npx tsx scripts/evidence/probe-evidence-bytes.ts [--all] [--json]
 *
 *     (défaut)  périmètre = les clés de la chaîne sous `reports/%`
 *     --all     périmètre = TOUTES les lignes EvidenceItem portant un r2Key
 *     --json    rapport machine sur stdout
 *
 * SORTIE : 0 uniquement si OK. INCIDENT et UNABLE sortent en 1.
 *
 * N'ÉCRIT RIEN : `HeadObject` seul côté R2 — aucun Put, aucun Delete, aucun
 * Get. Côté base, un unique SELECT via `$queryRaw` — aucun `$executeRaw`,
 * donc aucune écriture possible. Aucune valeur de secret n'est imprimée :
 * seuls les NOMS de variables apparaissent.
 *
 * NON BRANCHÉE SUR UN CRON. On la mesure avant de la programmer.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import {
  probeEvidenceBytes,
  formatReport,
  exitCodeFor,
  DEFAULT_CANARY_KEY,
  type RawHead,
} from "../../src/lib/evidence-chain/bytesProbe";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO_ROOT, ".env.local"), quiet: true });

const ALL = process.argv.includes("--all");
const AS_JSON = process.argv.includes("--json");

// CLAUDE.md, bloc base de données : la production est DATABASE_URL, et elle
// seule. DATABASE_URL_UNPOOLED désigne un AUTRE projet Neon.
const REQUIRED = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

/**
 * Une variable manquante ne doit pas faire « 0 problème ». Elle fait UNABLE,
 * et on sort en 1 — même famille que le fail-closed du module.
 */
function missingEnv(): string[] {
  return REQUIRED.filter((v) => !process.env[v]);
}

/**
 * Les messages d'erreur du SDK recopient l'hôte appelé, donc le compartiment et
 * l'identifiant de compte. Mesuré : un endpoint invalide fait remonter
 * « getaddrinfo ENOTFOUND <compartiment>.<hôte> » jusque dans le rapport.
 * Une sortie de sonde est faite pour être collée dans un rapport : elle ne doit
 * porter que des RÔLES, jamais des valeurs. On caviarde donc à l'impression,
 * pas à la construction — le module pur, lui, ne voit jamais aucun secret.
 */
function redact(text: string): string {
  let out = text;
  for (const [name, value] of [
    ["R2_BUCKET_NAME", process.env.R2_BUCKET_NAME],
    ["R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ] as const) {
    if (value && value.length >= 4) out = out.split(value).join(`<${name}>`);
  }
  return out;
}

function emit(text: string): void {
  console.log(redact(text));
}

async function main(): Promise<number> {
  const absent = missingEnv();
  if (absent.length > 0) {
    const out = {
      verdict: "UNABLE",
      detail: `variables absentes : ${absent.join(", ")} (noms seuls, aucune valeur)`,
    };
    emit(AS_JSON ? JSON.stringify(out, null, 2) : `VERDICT : UNABLE\n${out.detail}`);
    return 1;
  }

  const bucket = process.env.R2_BUCKET_NAME!;
  const endpoint =
    process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // La sonde doit conclure, pas pendre. Un R2 qui ne répond pas est un
    // UNABLE ; un R2 qui répond en 30 s aussi.
    requestHandler: { requestTimeout: 15_000, connectionTimeout: 8_000 },
  });

  // ── Le registre dit ce qui DEVRAIT exister. R2 dira ce qui existe. ──────
  // Les deux rôles ne se confondent jamais : cette requête ne prouve rien sur
  // les octets, et n'est pas censée le faire. Elle est en LECTURE SEULE par
  // construction — `$queryRaw` sur un SELECT ne peut rien écrire, et aucun
  // `$executeRaw` n'apparaît dans ce fichier.
  const prisma = new PrismaClient();

  let expectedKeys: string[] = [];
  let notCovered: { count: number; reason: string } | null = null;
  try {
    const scoped = ALL
      ? await prisma.$queryRaw<{ r2Key: string }[]>`
          SELECT "r2Key" FROM "EvidenceItem" WHERE "r2Key" IS NOT NULL ORDER BY "r2Key"`
      : await prisma.$queryRaw<{ r2Key: string }[]>`
          SELECT "r2Key" FROM "EvidenceItem" WHERE "r2Key" LIKE 'reports/%' ORDER BY "r2Key"`;
    expectedKeys = scoped.map((r) => r.r2Key);

    const total = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "EvidenceItem" WHERE "r2Key" IS NOT NULL`;
    const uncovered = (total[0]?.n ?? 0) - expectedKeys.length;
    if (uncovered > 0) {
      // Aucun plafond silencieux : ce qui n'est pas regardé est nommé.
      notCovered = {
        count: uncovered,
        reason: "hors du préfixe reports/ — relancer avec --all pour les couvrir",
      };
    }
  } catch (err) {
    // Sans registre, on ne sait pas ce qu'on cherche. UNABLE, pas OK.
    const e = err as { name?: string; message?: string };
    const detail = `registre injoignable — ${e.name ?? "Error"}: ${e.message ?? String(err)}`;
    emit(AS_JSON ? JSON.stringify({ verdict: "UNABLE", detail }, null, 2) : `VERDICT : UNABLE\n${detail}`);
    await prisma.$disconnect().catch(() => {});
    return 1;
  }

  // L'unique capacité donnée à la sonde.
  const headObject = async (key: string): Promise<RawHead> => {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { ContentLength: r.ContentLength, LastModified: r.LastModified, Expiration: r.Expiration };
  };

  const report = await probeEvidenceBytes({
    expectedKeys,
    headObject,
    canaryKey: DEFAULT_CANARY_KEY,
    notCovered,
  });

  await prisma.$disconnect().catch(() => {});

  if (AS_JSON) {
    emit(JSON.stringify(report, null, 2));
  } else {
    emit(`# sonde d'existence des octets — ${new Date().toISOString()}`);
    emit(`# compartiment : variable R2_BUCKET_NAME · registre : variable DATABASE_URL`);
    emit(`# périmètre : ${ALL ? "toutes les lignes r2Key" : "chaîne reports/%"}`);
    emit("");
    emit(formatReport(report));
  }
  return exitCodeFor(report);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // Une exception non prévue est une non-observation, pas un succès.
    console.error(redact(`VERDICT : UNABLE — exception non rattrapée : ${(err as Error)?.message ?? err}`));
    process.exit(1);
  });
