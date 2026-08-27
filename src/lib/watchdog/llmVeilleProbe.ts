// ─── Sonde « Veille LLM » — le modèle de résumé est-il joignable ? ─────────
//
// Incident du 2026-08-27 : `llm.service.ts` épinglait un modèle retiré depuis
// le 2026-06-15. Chaque appel revenait en 404, le cron intel-summarize
// répondait `{ok:true}` quand même, et personne n'a rien vu pendant deux mois.
// Le cron ne rend plus vert sur échec — mais un cron rouge que personne ne
// regarde reste muet. Il faut que ça sorte sur le canal d'alerte.
//
// ─── Correctif du 2026-08-27 (seconde passe) ──────────────────────────────
// La première version déclenchait le critique sur le COMPTEUR DE BACKLOG :
// « 217 items en échec MODEL_NOT_FOUND » ⇒ 🔴 MODÈLE INDISPONIBLE. Une heure
// après la remise en service, le modèle répondait, trente items venaient
// d'être résumés — et l'alerte criait toujours la panne. C'est la faute que ce
// chantier combattait, refaite par la sonde elle-même : affirmer au présent une
// propriété établie sur des traces passées.
//
// La fraîcheur n'est PAS dérivable de la file. Mesuré, pas supposé :
//   • `FounderIntelItem` n'a aucune colonne de mise à jour — `publishedAt` et
//     `fetchedAt` datent l'ARTICLE, jamais la tentative de résumé.
//   • `lastSummaryError` est réécrite à chaque échec mais ne porte pas d'heure.
//   • La table `JobRunLog` existe, mais `intel-summarize` n'y écrit rien :
//     seuls `watcher_bridge_promote` et `watcher_v2_scan` y figurent.
// Aucun ordre de file ne lève l'ambiguïté non plus : le cron sert
// `starRating desc, publishedAt desc`, si bien que la tête de file est occupée
// par le résidu lui-même — les items qu'il reste à drainer sont exactement ceux
// que le dernier run a touchés. Résidu et échec frais y sont indiscernables.
//
// Donc on mesure la propriété qu'on affirme, directement : un appel minimal au
// modèle épinglé. « Le modèle répond-il MAINTENANT » est une question à
// laquelle seule une réponse du modèle répond. Le compteur de backlog reste
// affiché — il est vrai, et il documente la dette — mais il ne déclenche plus
// rien de critique.
//
// La logique vit ici, pure et testable ; le watchdog (.mjs) ne fait que la
// requête SQL et l'appel réseau. Même découpage que la sonde C4.

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
  /** Items en attente dont la DERNIÈRE erreur enregistrée est un modèle
   *  introuvable. Historique : ne dit rien de l'état courant du modèle. */
  modelOff: number;
}

/**
 * Verdict de l'appel réel au modèle.
 *   ok          le modèle épinglé a répondu
 *   model_off   il a répondu « ce modèle n'existe pas » — panne certaine
 *   unmeasured  on n'a pas pu conclure (clé absente, réseau, quota, 5xx)
 *
 * `unmeasured` n'est PAS un demi-vert : c'est l'aveu qu'on ne sait pas, et il
 * sort quand même sur le digest. Une clé expirée ou un 429 ne prouvent rien
 * sur l'existence du modèle et ne doivent jamais s'afficher comme une panne de
 * modèle — ce serait renommer une cause, donc mentir sur le correctif à faire.
 */
export type LlmLiveStatus = "ok" | "model_off" | "unmeasured";

export interface LlmLiveProbe {
  status: LlmLiveStatus;
  /** Identifiant réellement testé — l'alerte doit nommer le bon modèle. */
  model: string;
  /** Motif lisible. Jamais de clé, jamais de contenu d'article. */
  detail: string;
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
 * Ancré en début de chaîne pour ne pas attraper un « 404 » cité au milieu d'un
 * message. Sert désormais à COMPTER le résidu, plus à déclencher l'alerte.
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

/** Ce que le watchdog rapporte de son appel réel. Tout est facultatif : la
 *  sonde doit savoir conclure « je ne sais pas » sur une entrée dégradée. */
export interface LiveProbeOutcome {
  model: string;
  /** Renseigné quand l'appel n'a PAS été tenté (clé absente, désactivé). */
  skippedReason?: string | null;
  httpStatus?: number | null;
  errorName?: string | null;
  errorMessage?: string | null;
}

/**
 * Traduit le résultat brut de l'appel en verdict.
 *
 * `model_off` est délibérément AVARE : seul un refus explicite du modèle le
 * déclenche (404, ou un 400 qui nomme le modèle — la forme que prend un
 * identifiant inconnu selon les routes). Tout le reste est `unmeasured`. Une
 * sonde qui crie au modèle mort sur un 429 ou une coupure réseau se ferait
 * ignorer en trois jours, et l'alerte redeviendrait le bruit qu'elle remplace.
 */
export function classifyLiveProbe(outcome: LiveProbeOutcome): LlmLiveProbe {
  const model = outcome.model || "(inconnu)";
  if (outcome.skippedReason) {
    return { status: "unmeasured", model, detail: outcome.skippedReason };
  }

  const s = outcome.httpStatus ?? null;
  const msg = outcome.errorMessage ?? "";

  if (s !== null && s >= 200 && s < 300) {
    return { status: "ok", model, detail: `HTTP ${s}` };
  }
  if (s === 404) {
    return { status: "model_off", model, detail: "HTTP 404 — modèle inconnu de l'API" };
  }
  if (s === 400 && /model/i.test(msg)) {
    return { status: "model_off", model, detail: "HTTP 400 portant sur le modèle" };
  }
  if (s === 401 || s === 403) {
    return { status: "unmeasured", model, detail: `HTTP ${s} — problème de clé, pas de verdict sur le modèle` };
  }
  if (s === 429) {
    return { status: "unmeasured", model, detail: "HTTP 429 — quota, pas de verdict sur le modèle" };
  }
  if (s !== null) {
    return { status: "unmeasured", model, detail: `HTTP ${s} — réponse non concluante` };
  }
  const name = outcome.errorName ? `${outcome.errorName}: ` : "";
  return {
    status: "unmeasured",
    model,
    detail: `appel impossible (${name}${msg || "erreur inconnue"})`.slice(0, 160),
  };
}

/**
 * Verdict de la veille : l'état du MODÈLE vient de l'appel réel, l'état de la
 * FILE vient des compteurs. Les deux sont affichés ; un seul déclenche le
 * critique.
 *
 * Le compteur `modelOff` ne peut plus, à lui seul, produire un 🔴 : il décrit
 * des tentatives passées, dont certaines remontent à l'incident lui-même, et
 * il met des semaines à se vider au rythme du cron (un run par jour, dix items
 * par run). Le laisser piloter l'alerte, c'est garder un voyant rouge allumé
 * sur une panne réparée — et rendre la panne SUIVANTE invisible dans le bruit.
 */
export function evaluateLlmVeille(
  counts: LlmVeilleCounts,
  live: LlmLiveProbe,
): LlmVeilleReport {
  const { done, pending, exhausted, withError, modelOff } = counts;

  const etat: LlmVeilleEtat =
    live.status === "model_off" ? "FAILED" : withError > 0 ? "partial" : "ok";

  let problem: LlmVeilleProblem | null = null;
  if (live.status === "model_off") {
    problem = {
      key: "llm_model_off",
      severity: "crit",
      line:
        `🔴 MODÈLE LLM INDISPONIBLE — l'appel de contrôle à « ${live.model} » ` +
        `a échoué (${live.detail}). Le modèle épinglé dans llm.service.ts ne ` +
        `répond plus : plus aucun résumé n'est produit, et l'assistant de ` +
        `dossier comme les synthèses passent par le même service. Vérifier ` +
        `l'identifiant de modèle.`,
    };
  } else if (live.status === "unmeasured") {
    problem = {
      key: "llm_probe_unmeasured",
      severity: "warn",
      line:
        `⚠️ Veille LLM — disponibilité du modèle « ${live.model} » NON MESURÉE ` +
        `(${live.detail}). Ni panne confirmée ni service confirmé : le contrôle ` +
        `lui-même est aveugle, et c'est ça qu'il faut réparer.`,
    };
  } else if (modelOff > 0) {
    problem = {
      key: "llm_veille_residue",
      severity: "warn",
      line:
        `⚠️ Veille LLM — le modèle répond, mais ${modelOff} item(s) portent ` +
        `encore l'échec MODEL_NOT_FOUND de l'incident du 2026-08-27. Résidu à ` +
        `drainer, pas une panne : ~${Math.ceil(modelOff / 10)} run(s) de cron.`,
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

  const modeleTxt =
    live.status === "ok"
      ? `modèle OK (${live.model})`
      : live.status === "model_off"
        ? `MODÈLE INDISPONIBLE (${live.model})`
        : `modèle NON MESURÉ (${live.model})`;

  return {
    etat,
    problem,
    // Toujours émise, y compris quand tout va bien : c'est le battement de cœur.
    line:
      `• Veille LLM : ${etat} — ${modeleTxt} · ${pending} en attente, ` +
      `${done} résumés, ${withError} en erreur (${modelOff} MODEL_NOT_FOUND ` +
      `résiduels), ${exhausted} abandonné(s)`,
  };
}
