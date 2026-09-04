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
 * CADENCE DU FEED — HORAIRE, plan Vercel confirmé Pro le 2026-09-04.
 *
 * B7 avait livré en quotidien faute d'avoir pu vérifier le plan : la garde de
 * suite portait l'hypothèse « Hobby, le deploy échouerait », et le risque était
 * asymétrique — un horaire sur Hobby casse le déploiement entier, pas seulement
 * le cron. Le plan confirmé, la cadence prévue est posée.
 *
 * POURQUOI L'HORAIRE POUR LE FEED ET PAS POUR LE SHADOW : le feed est
 * Helius-free, son coût marginal est une requête base ; il gagne à suivre le
 * watcher au plus près. Le shadow DÉPENSE — 100 000 crédits par passage — et
 * reste quotidien. Deux cadences parce que deux coûts, pas par symétrie.
 */
export const FEED_SCHEDULE = { current: "hourly", cron: "0 * * * *" } as const;
