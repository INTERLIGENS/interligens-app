// ─── BUILD 10 — LA FRAÎCHEUR D'UNE SOURCE SE MESURE SUR SON EXÉCUTION ──────
//
// ██  Une mesure n'est valide que si le champ mesuré représente réellement   ██
// ██  le phénomène annoncé.                                                  ██
//
// ─── Le faux positif que ce module ferme ──────────────────────────────────
//
// La sonde `intel_stale` lisait `max(intel_source_observations."ingestedAt")`
// et en tirait « la source a N jours ». Mesuré le 2026-09-08 :
//
//     source        ingestedAt (sonde)   dernier batch réussi (réalité)
//     ofac          2026-08-25  → 14 j   2026-09-08 01:00:51  → 0 j
//     scamsniffer   2026-09-08  →  0 j   2026-09-08 01:31:13  → 0 j
//
// OFAC était déclaré « SOURCE RÉGLEMENTAIRE PÉRIMÉE » en `crit` alors que son
// collecteur avait tourné sept heures plus tôt et récupéré 874 enregistrements.
//
// La cause est sémantique, pas arithmétique. `ingestedAt` date l'INSERTION
// d'une observation. Une liste de sanctions stable n'insère rien : ses lignes
// existent déjà. Depuis la garde `IS DISTINCT FROM` de `bulkUpsert`, les lignes
// inchangées ne sont plus réécrites — `ingestedAt`, `lastVerifiedAt` et
// `lastSeenAt` datent donc le dernier CHANGEMENT, pas la dernière observation.
// `src/lib/intelligence/ingest.ts` le déclare explicitement, et demande qu'aucune
// sonde ne s'y adosse. C'était exactement cette sonde.
//
// La garde `IS DISTINCT FROM` est CORRECTE et n'est pas touchée : elle supprime
// ~340 000 UPDATE inutiles par cycle. C'est la sonde qui était fausse.
//
// ─── Le champ retenu, et pourquoi il mesure le phénomène ──────────────────
//
// `intel_ingestion_batches` est un journal d'exécution en APPEND : une ligne
// par run, écrite par le collecteur lui-même, portant `startedAt`,
// `completedAt` et `status`. Trois propriétés le rendent valide là où les
// horodatages d'observation ne le sont pas :
//
//   1. il est écrit à CHAQUE run, que la source ait changé ou non — la garde
//      `IS DISTINCT FROM` ne s'applique pas à lui, elle porte sur l'upsert des
//      entités et des observations ;
//   2. il porte un `status`, donc « a tourné » et « a réussi » se distinguent ;
//   3. une source jamais exécutée n'y a AUCUNE ligne — c'est un état à part
//      entière, et non un âge infini.
//
// ─── Le contrat, et sa règle de dégradation ───────────────────────────────
//
// La dégradation voyage À CÔTÉ du nombre, jamais dedans. Pas de `-1`, pas de
// `NaN`, pas d'âge sentinelle : `ageDays` vaut `null` quand il n'est pas
// mesurable, et c'est `state` qui qualifie le champ.

/** Ce qu'un journal de batch rend, par source. Forme minimale et suffisante. */
export interface SourceRunRow {
  readonly sourceSlug: string;
  /** Dernier run démarré, quel qu'en soit l'issue. `null` si aucun. */
  readonly lastStartedAt: Date | null;
  /** Dernier run TERMINÉ en succès. `null` si aucun succès. */
  readonly lastSuccessAt: Date | null;
}

export type FreshnessState =
  /** Un run réussi dans la fenêtre autorisée. */
  | "FRESH"
  /** Un run réussi, mais trop ancien. */
  | "STALE"
  /** La source a tourné et n'a JAMAIS réussi : l'âge ne veut rien dire. */
  | "UNKNOWN"
  /** Aucun run : le collecteur n'est pas armé. Ce n'est pas de la vétusté. */
  | "NOT_ARMED";

export interface FreshnessVerdict {
  readonly sourceSlug: string;
  readonly state: FreshnessState;
  /** Âge du dernier SUCCÈS, en jours. `null` dès que `state` n'est pas mesurable. */
  readonly ageDays: number | null;
  /** Le seuil appliqué, pour que la sortie soit relisible sans le code. */
  readonly limitDays: number;
  /** Le champ effectivement mesuré — rend la sonde auditable. */
  readonly measuredField: "intel_ingestion_batches.completedAt(status=success)";
}

const MS_PER_DAY = 86_400_000;

/** Âge en jours pleins, sur la même base que la sonde d'origine. */
function ageInDays(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Le verdict d'une source.
 *
 * `declaredSlugs` porte les sources que le registre ANNONCE. Une source
 * déclarée sans aucune ligne de run rend `NOT_ARMED` — l'écart entre ce qui est
 * annoncé et ce qui tourne est le constat, pas un âge.
 */
export function assessSourceFreshness(
  rows: readonly SourceRunRow[],
  declaredSlugs: readonly string[],
  limits: Readonly<Record<string, number>>,
  defaultLimitDays: number,
  now: Date,
): FreshnessVerdict[] {
  const parSlug = new Map(rows.map((r) => [r.sourceSlug, r]));
  const tous = [...new Set([...declaredSlugs, ...rows.map((r) => r.sourceSlug)])].sort();

  return tous.map((slug) => {
    const limitDays = limits[slug] ?? defaultLimitDays;
    const base = { sourceSlug: slug, limitDays, measuredField: "intel_ingestion_batches.completedAt(status=success)" } as const;
    const row = parSlug.get(slug);

    // Aucune ligne de run : le collecteur n'a jamais été exécuté.
    if (!row || (row.lastStartedAt === null && row.lastSuccessAt === null)) {
      return { ...base, state: "NOT_ARMED", ageDays: null };
    }
    // Il a tourné mais n'a jamais réussi : on ne sait pas dater une observation.
    if (row.lastSuccessAt === null) {
      return { ...base, state: "UNKNOWN", ageDays: null };
    }
    const ageDays = ageInDays(row.lastSuccessAt, now);
    return { ...base, state: ageDays > limitDays ? "STALE" : "FRESH", ageDays };
  });
}

/** Les verdicts qui doivent remonter comme problème. `FRESH` n'en est pas un. */
export function needsAttention(v: FreshnessVerdict): boolean {
  return v.state !== "FRESH";
}

/**
 * Une ligne lisible par un humain. L'état précède toujours le nombre : c'est
 * l'état qui qualifie, et l'absence de nombre ne doit jamais se lire comme zéro.
 */
export function formatVerdict(v: FreshnessVerdict): string {
  switch (v.state) {
    case "FRESH":
      return `${v.sourceSlug} FRESH (${v.ageDays}j / seuil ${v.limitDays}j)`;
    case "STALE":
      return `${v.sourceSlug} STALE ${v.ageDays}j (seuil ${v.limitDays}j)`;
    case "UNKNOWN":
      return `${v.sourceSlug} UNKNOWN — a tourné, jamais réussi (âge non mesurable)`;
    case "NOT_ARMED":
      return `${v.sourceSlug} NOT_ARMED — déclaré au registre, aucun run (âge non mesurable)`;
  }
}
