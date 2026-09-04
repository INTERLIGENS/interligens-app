// --- B7 — la configuration d'exploitation, en un seul endroit -------------
//
// ██ POURQUOI DEUX CRONS ET PAS UN ██
//
// Le feed et le shadow ont des modes de panne DIFFÉRENTS, et les coupler
// aurait fait dépendre l'ingestion sociale d'un budget on-chain :
//
//   FEED    hourly · Helius-free · écrit des ShillEvent
//   SHADOW  daily  · Helius borné · lit ces événements, écrit dans un sink
//
// Sous un cron unique, une panne Helius aurait tari le feed — et un feed vide
// se lit comme « aucune promotion », pas comme « la collecte est tombée ».
// C'est le genre de silence qu'on ne remarque pas avant des semaines.
//
// LA CADENCE DU SHADOW EST CONFIGURABLE ici et dans vercel.json. La descendre
// à 3×/semaine si le coût Helius l'exige ne demande pas de toucher au code de
// la route — seulement cette constante et la ligne `schedule`.

/** Fenêtre de recouvrement du feed, en minutes. */
export const FEED_OVERLAP_MINUTES = 30;

/** Plafond de candidats examinés par passage du feed. */
export const FEED_MAX_CANDIDATES = 500;

/**
 * ██ BUDGET HELIUS PAR RUN SHADOW — GLOBAL, PAS PAR ÉVÉNEMENT ██
 *
 * 100 000 crédits pour TOUT le passage. Un budget par événement aurait
 * multiplié la dépense par le nombre de sujets sans qu'aucune ligne du code ne
 * l'annonce : dix événements auraient coûté un million de crédits.
 *
 * Au plafond, le reste du lot rend BUDGET_EXHAUSTED / NOT_MEASURABLE. Aucune
 * poursuite cachée, aucun retry automatique — un retry silencieux transforme
 * une borne en suggestion.
 */
export const SHADOW_MAX_CREDITS_PER_RUN = 100_000;
export const SHADOW_CREDITS_PER_CALL = 100;
export const SHADOW_MAX_CALLS_PER_RUN =
  SHADOW_MAX_CREDITS_PER_RUN / SHADOW_CREDITS_PER_CALL;

/** Plafond de sujets par passage shadow. Borne le pire cas de latence. */
export const SHADOW_MAX_SUBJECTS_PER_RUN = 25;

/**
 * Cadence du shadow, déclarée ici pour être lisible sans ouvrir vercel.json.
 * Changer la valeur NE change PAS la planification — il faut aussi la ligne
 * `schedule`. Les deux sont gardées côte à côte pour que l'écart se voie.
 */
export const SHADOW_SCHEDULE = {
  current: "daily",
  cron: "0 7 * * *",
  /** Alternative si le coût Helius l'exige — lundi/mercredi/vendredi. */
  reduced: { label: "3x_per_week", cron: "0 7 * * 1,3,5" },
} as const;

/**
 * ⚠ CADENCE DU FEED — QUOTIDIENNE, ET CE N'EST PAS LE CHOIX SOUHAITE.
 *
 * B7 demandait `hourly`. La suite porte une garde
 * (__tests__/api/intelFreshness.test.ts) qui REFUSE toute cadence
 * infra-quotidienne, au motif que « le plan Vercel est Hobby, le deploy
 * echouerait ». Sur Hobby, un cron sous-quotidien fait echouer le DEPLOIEMENT
 * ENTIER, pas seulement le cron.
 *
 * Je n'ai pas pu verifier le plan : la CLI Vercel attend une authentification
 * interactive. Les indices divergent — `orgId` est un `team_...` (les comptes
 * Hobby n'ont pas d'equipe) et 15 crons sont deja planifies, mais des commits
 * d'avril 2026 portent explicitement « Hobby plan limit ».
 *
 * Le risque est asymetrique : une cadence quotidienne retarde le feed d'au
 * plus 24 h, une cadence horaire sur Hobby casse la production. La cadence
 * horaire est prete ci-dessous — la poser demande de confirmer le plan et de
 * mettre a jour la garde, qui est le seul endroit ou l'hypothese est ecrite.
 */
export const FEED_SCHEDULE = {
  current: "daily",
  cron: "0 5 * * *",
  /** Cible de B7, en attente de confirmation du plan Vercel. */
  intended: { label: "hourly", cron: "0 * * * *", blockedBy: "vercel_plan_unverified" },
} as const;
