// ─── Sonde « Veille LLM » — le modèle de résumé est-il joignable ? ─────────
//
// Incident du 2026-08-27 : `llm.service.ts` épinglait un modèle retiré depuis
// le 2026-06-15. Chaque appel revenait en 404, le cron intel-summarize
// répondait `{ok:true}` quand même, et personne n'a rien vu pendant deux mois.
// Le cron ne rend plus vert sur échec — mais un cron rouge que personne ne
// regarde reste muet. Il faut que ça sorte sur le canal d'alerte.
//
// La logique vit ici, pure et testable ; le watchdog (.mjs) ne fait que la
// requête SQL et l'appel. Même découpage que la sonde C4.

/** Ce que la requête compte. Aucune valeur n'est facultative : un compteur
 *  manquant serait un silence, et le silence est le défaut qu'on corrige. */
export interface LlmVeilleCounts {
  /** Items résumés avec succès (état terminal). */
  done: number;
  /** Items que le cron reprendra encore. */
  pending: number;
  /** Items abandonnés : plafond de tentatives atteint. */
  exhausted: number;
  /** Items en attente portant une erreur, tous motifs confondus. */
  withError: number;
  /** Items en attente dont l'erreur est un modèle introuvable. */
  modelOff: number;
}

export type LlmVeilleEtat = "ok" | "partial" | "FAILED";

export interface LlmVeilleProblem {
  key: string;
  severity: "crit" | "warn";
  line: string;
}

export interface LlmVeilleReport {
  etat: LlmVeilleEtat;
  /** null quand il n'y a rien à signaler. La ligne de résumé, elle, existe toujours. */
  problem: LlmVeilleProblem | null;
  /** Ligne du battement de cœur — présente dans TOUS les cas. */
  line: string;
}

/**
 * Deux formats d'échec de modèle cohabitent en base.
 *   « MODEL_NOT_FOUND: … »  depuis le correctif du 2026-08-27
 *   « Error:404 … », « NotFoundError… »  les 247 lignes écrites avant
 * Ne reconnaître que le format neuf afficherait vert sur un échec mesuré —
 * exactement le défaut qu'on vient de corriger. Ancré en début de chaîne pour
 * ne pas attraper un « 404 » cité au milieu d'un message.
 */
export const LLM_MODEL_OFF_PATTERN = "^(MODEL_NOT_FOUND|NotFoundError|Error:404)";

/**
 * Requête de la sonde. LECTURE SEULE, un seul SELECT, aucun effet de bord.
 * `$1` = plafond de tentatives (aligné sur MAX_ATTEMPTS du cron),
 * `$2` = LLM_MODEL_OFF_PATTERN.
 */
export const LLM_VEILLE_QUERY = `
  SELECT count(*) FILTER (WHERE "summaryDone")::int                        AS done,
         count(*) FILTER (WHERE NOT "summaryDone"
                          AND "summaryAttempts" < $1)::int                 AS pending,
         count(*) FILTER (WHERE NOT "summaryDone"
                          AND "summaryAttempts" >= $1)::int                AS exhausted,
         count(*) FILTER (WHERE NOT "summaryDone"
                          AND "lastSummaryError" IS NOT NULL)::int         AS with_error,
         count(*) FILTER (WHERE NOT "summaryDone"
                          AND "lastSummaryError" ~ $2)::int                AS model_off
    FROM "FounderIntelItem"`;

/** Normalise une ligne SQL brute (colonnes snake_case, entiers en texte). */
export function countsFromRow(row: Record<string, unknown> | undefined): LlmVeilleCounts {
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  return {
    done: n(row?.done),
    pending: n(row?.pending),
    exhausted: n(row?.exhausted),
    withError: n(row?.with_error),
    modelOff: n(row?.model_off),
  };
}

/**
 * Verdict de la file de veille.
 *
 * « FAILED » ne prétend PAS décrire un run : il n'existe aucun journal de run
 * pour ce cron (FounderIntelItem n'a pas de colonne de mise à jour, et en
 * ajouter une demanderait une migration). Ce qu'on lit est la trace durable que
 * le cron laisse déjà, item par item — `lastSummaryError`, effacée à chaque
 * succès, réécrite à chaque échec. L'état décrit donc la FILE, et la ligne le
 * dit tel quel : on n'affirme pas une propriété qu'on n'a pas mesurée.
 *
 * Un SEUL item porteur d'un échec de modèle suffit à déclarer FAILED : un
 * modèle indisponible l'est pour tout le monde, ce n'est jamais un cas isolé.
 */
export function evaluateLlmVeille(counts: LlmVeilleCounts): LlmVeilleReport {
  const { done, pending, exhausted, withError, modelOff } = counts;
  const etat: LlmVeilleEtat = modelOff > 0 ? "FAILED" : withError > 0 ? "partial" : "ok";

  let problem: LlmVeilleProblem | null = null;
  if (modelOff > 0) {
    problem = {
      key: "llm_model_off",
      severity: "crit",
      line:
        `🔴 MODÈLE LLM INDISPONIBLE — ${modelOff} item(s) de veille en échec ` +
        `MODEL_NOT_FOUND. Le modèle épinglé dans llm.service.ts ne répond plus : ` +
        `plus aucun résumé n'est produit, et l'assistant de dossier comme les ` +
        `synthèses passent par le même service. Vérifier l'identifiant de modèle.`,
    };
  } else if (withError > 0) {
    problem = {
      key: "llm_veille_errors",
      severity: "warn",
      line:
        `⚠️ Veille LLM — ${withError} item(s) en attente portent une erreur de ` +
        `résumé (hors modèle indisponible). Voir lastSummaryError.`,
    };
  }

  return {
    etat,
    problem,
    // Toujours émise, y compris quand tout va bien : c'est le battement de cœur.
    line:
      `• Veille LLM : ${etat} — ${pending} en attente, ${done} résumés, ` +
      `${withError} en erreur (${modelOff} MODEL_NOT_FOUND), ${exhausted} abandonné(s)`,
  };
}
