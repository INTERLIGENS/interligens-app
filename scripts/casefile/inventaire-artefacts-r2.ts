#!/usr/bin/env tsx
/**
 * INVENTAIRE DES ARTEFACTS CASEFILE EN R2 — LECTURE SEULE.
 *
 * ██  On inventorie des CLÉS et des MÉTADONNÉES. Jamais un octet d'objet.  ██
 *
 * USAGE
 *     npx tsx scripts/casefile/inventaire-artefacts-r2.ts [--json]
 *
 * CE QUE CE SCRIPT NE FAIT PAS, ET NE DOIT JAMAIS FAIRE :
 *   · aucun `GetObject`      — le contenu d'un artefact ne sort pas de R2 ;
 *   · aucune URL signée      — rien d'émissible vers l'extérieur ;
 *   · aucun Put / Delete / Copy — aucune remédiation, aucune réécriture ;
 *   · aucune écriture en base — lecture seule.
 * Les seules commandes S3 employées sont `ListObjectsV2` et `HeadObject`.
 *
 * LE CRITÈRE DE GOUVERNANCE EST CELUI DE LA ROUTE, IMPORTÉ, PAS RÉÉCRIT.
 * `canonicalRefForMint` puis `loadCanonicalCaseFile` — les deux étapes, dans
 * cet ordre, exactement comme `src/app/api/pdf/casefile/route.ts` les applique
 * avant de rendre 404 `no_governed_casefile`. Un critère parallèle inventé
 * pour l'occasion mesurerait autre chose.
 *
 * Le mint EXACT vient de la métadonnée `subject` posée par `uploadPdf`, jamais
 * du `slug` de la clé : `slugify` met en minuscules, et un mint base58 est
 * sensible à la casse. Lire le slug pour en déduire le mint fabriquerait des
 * correspondances fausses.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { canonicalRefForMint } from "../../src/lib/casefile/publicProjection";
import { loadCanonicalCaseFile } from "../../src/lib/casefile/canonicalReader";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO_ROOT, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");
const PREFIXE = "reports/";

const REQUIS = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

interface Objet {
  key: string;
  taille: number;
  modifie: string;
  lot: string | null;
  horodatage: number | null;
  slug: string | null;
  suffixe: string | null;
  subject?: string | null;
  metaSha256?: string | null;
  metaUploade?: string | null;
  gouverne?: boolean;
  ref?: string | null;
}

function decomposer(key: string): Pick<Objet, "lot" | "horodatage" | "slug" | "suffixe"> {
  const nom = key.split("/").pop() ?? "";
  const m = nom.match(/^(.*?-)(\d{13})-(.*)-([0-9a-f]{8})\.pdf$/);
  if (!m) return { lot: null, horodatage: null, slug: null, suffixe: null };
  return { lot: m[1], horodatage: Number(m[2]), slug: m[3], suffixe: m[4] };
}

async function main() {
  const manquantes = REQUIS.filter((v) => !process.env[v]);
  if (manquantes.length > 0) {
    console.error(`UNABLE : variables absentes : ${manquantes.join(", ")}`);
    process.exit(1);
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const Bucket = process.env.R2_BUCKET_NAME!;

  const objets: Objet[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: PREFIXE, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) {
      if (!o.Key) continue;
      objets.push({
        key: o.Key,
        taille: o.Size ?? 0,
        modifie: (o.LastModified ?? new Date(0)).toISOString(),
        ...decomposer(o.Key),
      });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  const production = objets.filter((o) => o.key.startsWith("reports/production/"));
  const casefiles = production.filter((o) => o.lot === "casefile-");

  for (const o of casefiles) {
    const h = await s3.send(new HeadObjectCommand({ Bucket, Key: o.key }));
    o.subject = h.Metadata?.subject ?? null;
    o.metaSha256 = h.Metadata?.sha256 ?? null;
    o.metaUploade = h.Metadata?.uploadedat ?? h.Metadata?.uploadedAt ?? null;
  }

  const cache = new Map<string, { gouverne: boolean; ref: string | null }>();
  for (const o of casefiles) {
    const sujet = o.subject ?? "";
    if (!cache.has(sujet)) {
      const ref = canonicalRefForMint(sujet);
      const dossier = ref ? await loadCanonicalCaseFile(ref) : null;
      cache.set(sujet, { gouverne: dossier !== null, ref });
    }
    const r = cache.get(sujet)!;
    o.gouverne = r.gouverne;
    o.ref = r.ref;
  }

  const parMois = new Map<string, { n: number; octets: number }>();
  for (const o of production) {
    const mois = o.key.split("/").slice(2, 4).join("-");
    const e = parMois.get(mois) ?? { n: 0, octets: 0 };
    e.n++;
    e.octets += o.taille;
    parMois.set(mois, e);
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ production, casefiles, parMois: [...parMois] }, null, 2));
    return;
  }

  console.log("# INVENTAIRE : reports/ (lecture seule)\n");
  console.log(`objets sous reports/           : ${objets.length}`);
  console.log(`objets sous reports/production : ${production.length}`);
  console.log(`dont lot casefile-             : ${casefiles.length}\n`);

  console.log("## Repartition de TOUT reports/ par seconde composante");
  const parFamille = new Map<string, { n: number; octets: number; min: string; max: string }>();
  for (const o of objets) {
    const seg = o.key.split("/")[1] ?? "(racine)";
    const famille = ["production", "preview", "development"].includes(seg) ? `env:${seg}` : "handle:<archive de veille>";
    const e = parFamille.get(famille) ?? { n: 0, octets: 0, min: o.modifie, max: o.modifie };
    e.n++;
    e.octets += o.taille;
    if (o.modifie < e.min) e.min = o.modifie;
    if (o.modifie > e.max) e.max = o.modifie;
    parFamille.set(famille, e);
  }
  for (const [f, e] of [...parFamille].sort()) {
    console.log(`  ${f.padEnd(30)} : ${String(e.n).padStart(4)} objets, ${e.octets} octets, ${e.min} -> ${e.max}`);
  }

  console.log("\n## Cardinal par mois (reports/production)");
  for (const [mois, e] of [...parMois].sort()) {
    console.log(`  ${mois} : ${String(e.n).padStart(4)} objets, ${e.octets} octets`);
  }

  const tries = [...production].sort((a, b) => a.modifie.localeCompare(b.modifie));
  if (tries.length > 0) {
    console.log("\n## Fenetre temporelle (reports/production)");
    console.log(`  premiere : ${tries[0].modifie}  ${tries[0].key}`);
    console.log(`  derniere : ${tries[tries.length - 1].modifie}  ${tries[tries.length - 1].key}`);
  }

  const orphelins = casefiles.filter((o) => o.gouverne === false);
  const gouvernes = casefiles.filter((o) => o.gouverne === true);
  console.log("\n## Artefacts CaseFile : critere de la route");
  console.log(`  dossier gouverne O : ${gouvernes.length}`);
  console.log(`  dossier gouverne N : ${orphelins.length}`);

  console.log("\n## Table des cles casefile-");
  console.log("| cle | octets | modifie | sujet (metadonnee) | gouverne | ref |");
  console.log("|---|---|---|---|---|---|");
  for (const o of casefiles.sort((a, b) => a.modifie.localeCompare(b.modifie))) {
    console.log(
      `| ${o.key} | ${o.taille} | ${o.modifie} | ${o.subject ?? "-"} | ${
        o.gouverne ? "O" : "N"
      } | ${o.ref ?? "-"} |`,
    );
  }

  // ── RECOUPEMENT AVEC LE REGISTRE DE PREUVE ───────────────────────────────
  //
  // La question : ces artefacts CaseFile sont-ils une famille DISTINCTE, ou
  // recoupent-ils les pieces deja inventoriees en aout ? On lit, on ne juge pas.
  const prisma = new PrismaClient();
  try {
    const lignes = await prisma.$queryRaw<Array<{ r2key: string | null; statut: string | null }>>`
      SELECT "r2Key" AS r2key, "evidentiaryStatus" AS statut
        FROM "EvidenceItem" WHERE "r2Key" IS NOT NULL`;
    const connues = new Set(lignes.map((l) => l.r2key!).filter(Boolean));
    const exclues = lignes.filter((l) => l.statut === "EXCLUDED").length;
    const sansLigne = objets.filter((o) => !connues.has(o.key));

    console.log("\n## Recoupement avec EvidenceItem");
    console.log(`  lignes EvidenceItem portant un r2Key   : ${lignes.length}`);
    console.log(`  dont evidentiaryStatus = EXCLUDED      : ${exclues}`);
    console.log(`  objets R2 sous reports/ SANS ligne     : ${sansLigne.length}`);
    for (const o of sansLigne.sort((a, b) => a.modifie.localeCompare(b.modifie))) {
      console.log(`    ${o.modifie}  ${o.key}`);
    }
    const casefilesConnus = casefiles.filter((o) => connues.has(o.key)).length;
    console.log(`  artefacts casefile- portes par une ligne : ${casefilesConnus} / ${casefiles.length}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n## Enumerabilite du suffixe");
  console.log("  suffixe = sha256(octets du PDF).slice(0, 8) : DERIVE, non aleatoire.");
  for (const o of casefiles) {
    const coherent = !!o.metaSha256 && o.metaSha256.startsWith(o.suffixe ?? " ");
    console.log(`  ${coherent ? "OK " : "NON"} ${o.suffixe} prefixe de ${o.metaSha256?.slice(0, 16)}`);
  }
}

main()
  .catch((e) => {
    console.error("UNABLE :", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .then(() => process.exit(0));
