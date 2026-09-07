// ─── BUILD 9 / ÉTAPE 6 — RENDRE LE SQL DE SCELLEMENT ───────────────────────
//
// ██  Ce script ÉCRIT DU SQL SUR LA SORTIE STANDARD. Il n'écrit RIEN en base. ██
//
//   npx tsx scripts/casefile/seal-claims.ts IL-SHILL-BOTIFY-001 > seal.sql
//
// Puis relecture humaine, puis exécution dans l'éditeur SQL Neon. Le premier
// write en production reste une décision, pas un effet de bord de script.
//
// ─── Pourquoi l'empreinte n'est PAS calculée en SQL ───────────────────────
//
// Un `sha256()` côté Postgres exigerait de reproduire en SQL la sérialisation
// canonique de `claimContentHash` — l'ordre des champs, la marque d'absence,
// le tri des listes, les séparateurs. Deux implémentations d'un même sceau
// qui doivent s'accorder à l'octet près : la première divergence rendrait
// TOUS les sceaux faux, et le rapport d'intégrité crierait à l'altération sur
// des lignes que personne n'a touchées.
//
// Une seule implémentation, donc. Le SQL ne porte que des littéraux calculés
// ici, et `WHERE "contentHash" IS NULL` garantit qu'un rejeu ne réécrit
// jamais un sceau déjà posé — sceller deux fois n'est pas sceller.
//
// ─── Ce que le scellement N'EST PAS ───────────────────────────────────────
//
// Poser un sceau ne dit rien de la VÉRITÉ de l'assertion, ni de sa
// publiabilité. Il dit une seule chose : à partir de maintenant, une
// modification en place se verra.

import { prisma } from "@/lib/prisma";
import { claimContentHash } from "@/lib/casefile/versioning";

/**
 * La ligne telle que Postgres la rend. Elle n'étend PAS `SealableClaim` :
 * `claimDate` y est une `Date`, `actors` et `evidenceRefs` du jsonb brut. La
 * conversion vers la forme scellable est explicite, au moment du calcul —
 * c'est là qu'elle doit être visible, pas cachée dans un type.
 */
interface Row {
  claimId: string;
  version: number;
  contentHash: string | null;
  title: string;
  titleFr: string | null;
  description: string | null;
  descriptionFr: string | null;
  category: string | null;
  severity: string | null;
  status: string | null;
  claimDate: Date | null;
  actors: unknown;
  threadUrl: string | null;
  evidenceRefs: unknown;
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const q = (s: string): string => "'" + s.replace(/'/g, "''") + "'";

async function main(): Promise<void> {
  const ref = process.argv[2];
  if (!ref) {
    console.error("usage: tsx scripts/casefile/seal-claims.ts <casefileRef>");
    process.exit(2);
  }

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT "claimId", version, "contentHash", title, "titleFr", description,
            "descriptionFr", category, severity, status, "claimDate", actors,
            "threadUrl", "evidenceRefs"
       FROM "CaseFileClaim" WHERE "casefileRef" = $1
      ORDER BY "claimId" ASC, version ASC`,
    ref,
  );

  const aSceller = rows.filter((r) => r.contentHash == null || r.contentHash === "");

  const p = (s: string): void => console.log(s);
  p(`-- BUILD 9 / ÉTAPE 6 — scellement des claims de ${ref}`);
  p("-- RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.");
  p(`-- révisions lues : ${rows.length} · déjà scellées : ${rows.length - aSceller.length}`);
  p(`-- à sceller       : ${aSceller.length}`);
  p("--");
  p("-- Le sceau couvre le CONTENU seul : ni state, ni version, ni horodatage.");
  p("-- Promouvoir un claim ne doit jamais casser son empreinte.");
  p("");

  if (aSceller.length === 0) {
    p("-- Rien à sceller. Aucun UPDATE n'est rendu — un script qui rendrait un");
    p("-- UPDATE sans cible ne se signalerait pas.");
    return;
  }

  p("BEGIN;");
  for (const r of aSceller) {
    const h = claimContentHash({
      claimId: r.claimId,
      title: r.title,
      titleFr: r.titleFr,
      description: r.description,
      descriptionFr: r.descriptionFr,
      category: r.category,
      severity: r.severity,
      status: r.status,
      claimDate: r.claimDate ? r.claimDate.toISOString().slice(0, 10) : null,
      actors: asStrings(r.actors),
      threadUrl: r.threadUrl,
      evidenceRefs: asStrings(r.evidenceRefs),
    });
    p(`UPDATE "CaseFileClaim" SET "contentHash" = ${q(h)}, "updatedAt" = now()`);
    p(` WHERE "casefileRef" = ${q(ref)} AND "claimId" = ${q(r.claimId)}`);
    p(`   AND version = ${r.version} AND "contentHash" IS NULL;`);
  }
  p("COMMIT;");
  p("");
  p("-- ─── POST-CHECKS ────────────────────────────────────────────────────");
  p(`-- 6.1 · plus aucun claim non scellé. ATTENDU : 0`);
  p(`SELECT count(*) AS non_scelles FROM "CaseFileClaim"`);
  p(` WHERE "casefileRef" = ${q(ref)} AND "contentHash" IS NULL;`);
  p("");
  p(`-- 6.2 · aucune VERSION qui ne change rien.`);
  p(`--       Deux empreintes identiques ne sont pas une collision : le claimId`);
  p(`--       est scellé, donc seules deux versions du MÊME claim peuvent`);
  p(`--       coïncider — et cela veut dire qu'une révision a été créée sans`);
  p(`--       modifier quoi que ce soit. ATTENDU : 0`);
  p(`SELECT count(*) AS versions_sans_changement FROM (`);
  p(`  SELECT "claimId" FROM "CaseFileClaim" WHERE "casefileRef" = ${q(ref)}`);
  p(`   GROUP BY "claimId", "contentHash" HAVING count(*) > 1) x;`);
  p("");
  p("-- 6.3 · relancer l'audit applicatif : CONTENT_MUTATED doit valoir 0.");
  p("--       auditCaseFileIntegrity(ref) — src/lib/casefile/integrityAudit.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
