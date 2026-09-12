#!/usr/bin/env tsx
/**
 * RÉCONCILIATION REGISTRE ↔ R2 — BIDIRECTIONNELLE.
 *
 * ██  On lit des CLÉS et des MÉTADONNÉES. Jamais un octet d'objet.        ██
 *
 * USAGE
 *     npx tsx scripts/casefile/reconcilier-registre-r2.ts [--json] [--appliquer]
 *
 * PAR DÉFAUT : LECTURE SEULE, et rien n'est écrit nulle part.
 *
 * `--appliquer` autorise UNIQUEMENT des transitions d'ÉTAT DE REGISTRE — donc
 * des UPDATE en base, sur la seule table `governed_objects`. JAMAIS une
 * écriture d'objet, jamais un Delete, jamais un Copy, jamais une métadonnée.
 * Un objet réécrit n'est plus celui qui a été produit : marquer la preuve
 * détruirait ce qu'elle prouve.
 *
 * CE QUE CE SCRIPT NE FAIT JAMAIS :
 *   · aucun `GetObject`      — le contenu d'un artefact ne sort pas de R2 ;
 *   · aucune URL signée      — rien d'émissible vers l'extérieur ;
 *   · aucun Put / Delete / Copy / lifecycle ;
 *   · aucune suppression de ligne.
 * Les seules commandes S3 employées sont `ListObjectsV2` et `HeadObject`.
 *
 * ─── POURQUOI LES DEUX DIRECTIONS, ET POURQUOI ENSEMBLE ──────────────────
 *
 * F1. Une réconciliation DB→R2 seule ne voit jamais les OBJETS SANS LIGNE —
 * donc jamais le témoin « avant ». Une R2→DB seule ne voit jamais les LIGNES
 * SANS OBJET — donc jamais une autorité enregistrée pour des octets absents.
 * Une seule direction est PIRE que rien : elle crée la confiance sans la
 * couverture.
 *
 * ─── LE TÉMOIN T2 N'A PAS À ÊTRE FABRIQUÉ ────────────────────────────────
 *
 * L'orphelin d'objet EXISTE : 169 014 octets, sujet wSOL, aucun dossier
 * gouverné. Il est réel, il est en production, et il est le cas de test de la
 * direction R2→DB. Aucune sonde n'a à être écrite dans un compartiment qui
 * n'a AUCUNE règle de cycle de vie — elle y resterait pour toujours.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import {
  classer,
  estIncident,
  type Classement,
  type ObjetObserve,
} from "../../src/lib/storage/registre/reconciliation";
import { PREFIXE_GOUVERNE } from "../../src/lib/storage/registre/identite";
import type { LigneDeRegistre } from "../../src/lib/storage/registre/contrat";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO_ROOT, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");
const APPLIQUER = process.argv.includes("--appliquer");

const REQUIS = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

const prisma = new PrismaClient();

interface LigneBrute {
  id: string; bucket: string; storage_key: string; object_nature: string;
  provenance: string; authority_state: string; invalidation_state: string;
  invalidation_reason: string | null; invalidated_at: Date | null;
  retention_class: string; subject: string; batch_id: string | null;
  sha256: string; size_bytes: number; content_type: string; producer: string;
  allocated_at: Date; registered_at: Date | null;
}

function hydrater(l: LigneBrute): LigneDeRegistre {
  return {
    id: l.id, bucket: l.bucket, cle: l.storage_key,
    natureObjet: l.object_nature as LigneDeRegistre["natureObjet"],
    provenance: l.provenance as LigneDeRegistre["provenance"],
    etatDAutorite: l.authority_state as LigneDeRegistre["etatDAutorite"],
    etatDInvalidation: l.invalidation_state as LigneDeRegistre["etatDInvalidation"],
    classeDeRetention: l.retention_class as LigneDeRegistre["classeDeRetention"],
    sujet: l.subject, lot: l.batch_id, sha256: l.sha256,
    tailleOctets: Number(l.size_bytes), typeContenu: l.content_type,
    producteur: l.producer, alloueLe: l.allocated_at, enregistreLe: l.registered_at,
    invalideLe: l.invalidated_at, motifInvalidation: l.invalidation_reason,
  };
}

async function main() {
  const manquantes = REQUIS.filter((v) => !process.env[v]);
  if (manquantes.length > 0) {
    console.error(`UNABLE : variables absentes : ${manquantes.join(", ")}`);
    process.exit(1);
  }

  const bucket = process.env.R2_BUCKET_NAME!;
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  // ── Direction DB→R2 : les lignes ────────────────────────────────────
  //
  // La table absente n'est PAS une panne : c'est une migration non appliquée
  // dans l'éditeur SQL Neon. On le dit nommément plutôt que de rendre une
  // trace de pile, parce que les deux n'appellent pas la même conduite.
  let lignes: LigneDeRegistre[];
  try {
    const brutes = await prisma.$queryRaw<LigneBrute[]>`
      SELECT * FROM governed_objects WHERE bucket = ${bucket}`;
    lignes = brutes.map(hydrater);
  } catch (err) {
    const texte = err instanceof Error ? err.message : String(err);
    if (texte.includes("42P01") || /relation .* does not exist/i.test(texte)) {
      console.error(
        "UNABLE : la table `governed_objects` n'existe pas.\n" +
        "         Le DDL vit dans docs/prep/MIGRATION_REGISTRE_OBJETS_GOUVERNES_2026-09-12.sql\n" +
        "         et se pose dans l'ÉDITEUR SQL NEON — jamais par `prisma db push`,\n" +
        "         jamais par `prisma migrate`.\n" +
        "         La direction R2→DB seule ne serait PAS une réconciliation : elle\n" +
        "         créerait la confiance sans la couverture. On s'arrête.",
      );
      process.exit(2);
    }
    throw err;
  }

  // ── Direction R2→DB : les objets ────────────────────────────────────
  const objets = new Map<string, ObjetObserve>();
  let suite: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIXE_GOUVERNE, ContinuationToken: suite }),
    );
    for (const o of page.Contents ?? []) {
      if (!o.Key) continue;
      // HeadObject : la métadonnée `sha256`, jamais l'ETag (qui n'est pas un
      // MD5 en multipart) et jamais le corps.
      const tete = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: o.Key }));
      objets.set(o.Key, {
        cle: o.Key,
        tailleOctets: o.Size ?? 0,
        derniereModification: o.LastModified ?? new Date(0),
        sha256Metadonnee: tete.Metadata?.sha256 ?? null,
      });
    }
    suite = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (suite);

  // ── Le classement, couple par couple ────────────────────────────────
  const maintenant = new Date();
  const classements: Classement[] = [];
  const vues = new Set<string>();

  for (const ligne of lignes) {
    vues.add(ligne.cle);
    classements.push(classer(ligne, objets.get(ligne.cle) ?? null, maintenant));
  }
  for (const [cle, objet] of objets) {
    if (vues.has(cle)) continue;
    classements.push(classer(null, objet, maintenant));
  }

  // ── Les transitions, si et seulement si --appliquer ─────────────────
  let appliquees = 0;
  if (APPLIQUER) {
    for (const c of classements) {
      if (!c.transitionProposee) continue;
      const touchees = await prisma.$executeRaw`
        UPDATE governed_objects
           SET authority_state = ${c.transitionProposee},
               last_reconciled_at = now(),
               reconcile_note = ${c.detail},
               updated_at = now()
         WHERE bucket = ${bucket} AND storage_key = ${c.cle}
           AND invalidation_state = 'NONE'`;
      appliquees += Number(touchees);
    }
    // Les orphelins et les objets legacy n'ont PAS de ligne : leur transition
    // proposée ne touche donc rien. C'est volontaire — créer une ligne pour un
    // objet dont on n'établit ni la provenance ni le sujet fabriquerait une
    // autorité. Leur enregistrement est une décision, pas une conséquence.
  }

  const parVerdict = new Map<string, number>();
  for (const c of classements) parVerdict.set(c.verdict, (parVerdict.get(c.verdict) ?? 0) + 1);
  const incidents = classements.filter((c) => estIncident(c.verdict));

  if (AS_JSON) {
    console.log(JSON.stringify({
      bucket, prefixe: PREFIXE_GOUVERNE, mode: APPLIQUER ? "APPLIQUER" : "LECTURE_SEULE",
      lignes: lignes.length, objets: objets.size,
      parVerdict: Object.fromEntries(parVerdict), transitionsAppliquees: appliquees,
      classements,
    }, null, 2));
  } else {
    console.log(`\nRÉCONCILIATION — ${bucket} / ${PREFIXE_GOUVERNE}`);
    console.log(`mode           : ${APPLIQUER ? "APPLIQUER (UPDATE d'état uniquement)" : "LECTURE SEULE"}`);
    console.log(`lignes         : ${lignes.length}`);
    console.log(`objets         : ${objets.size}`);
    console.log("");
    for (const [v, n] of [...parVerdict].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${v}`);
    }
    if (APPLIQUER) console.log(`\ntransitions appliquées : ${appliquees}`);
    if (incidents.length > 0) {
      console.log(`\nINCIDENTS — ${incidents.length}, ils appellent un humain :`);
      for (const c of incidents) {
        console.log(`  · ${c.verdict}${c.causeProbable ? ` [${c.causeProbable}]` : ""}`);
        console.log(`    ${c.cle}`);
        console.log(`    ${c.detail}`);
      }
    }
    console.log("");
  }

  await prisma.$disconnect();
  // Un code de sortie non nul sur incident : le réconciliateur n'est utile
  // qu'armé par un ordonnanceur, et un ordonnanceur ne lit pas la prose.
  process.exit(incidents.length > 0 ? 3 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
