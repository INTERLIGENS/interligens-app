// src/lib/ops/submissionRateLimits.ts
//
// Politiques de limitation et bornes de taille des surfaces d'écriture
// PUBLIQUES — celles qu'un tiers non authentifié peut appeler.
//
// POURQUOI CE FICHIER EXISTE
// L'audit de la surface d'écriture (144 routes écrivent en base, 13 sans
// authentification) a montré deux choses. D'abord qu'aucune de ces routes
// n'alimente TigerScore ni les casefiles : le risque n'est pas
// l'empoisonnement du moteur mais la saturation d'une file de revue humaine.
// Ensuite que les protections annoncées n'étaient pas toutes réelles — un
// compteur `new Map()` dans un handler serverless ne partage rien entre deux
// invocations, et le « max 3 par jour » affiché à l'utilisateur ne
// s'appliquait donc à rien.
//
// POURQUOI ICI ET PAS DANS src/lib/security/rateLimit.ts
// Ce serait la place naturelle de ces presets, mais `^src/lib/security/` est
// gelé par scripts/guard-offline.sh — alors même que le commentaire du guard
// annonce que « les rate-limiters restent NON gelés ». Intention et pattern
// divergent ; plutôt que d'ouvrir un fichier de sécurité pour trois constantes,
// on les pose ici. Signalé pour arbitrage séparé.
//
// POLITIQUE D'ÉCHEC
// Doctrine du repo : fail-CLOSED quand la route crée quelque chose de
// persistant qui coûte après la rafale, fail-OPEN quand elle est en lecture ou
// jetable. Les deux surfaces ci-dessous créent des lignes ET du travail humain
// de tri. Une panne d'Upstash y est donc un motif de refus, pas de laissez-
// passer : mieux vaut un formulaire indisponible dix minutes qu'une file de
// revue noyée sous 100 000 candidatures.

import type { RateLimitConfig } from "@/lib/security/rateLimit";

/**
 * Candidature investigateur — 3 par heure et par IP.
 *
 * La route créait deux lignes (`InvestigatorApplication` +
 * `InvestigatorProgramAuditLog`) sans aucune limitation. Chaque candidature
 * atterrit dans /api/admin/investigators/applications, revue à la main.
 * FAIL-CLOSED : le coût d'une rafale est du travail humain, pas des octets.
 */
export const INVESTIGATOR_APPLY_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: "rl:investigator-apply",
  failClosed: true,
};

/**
 * Soumission de transparence — 3 par 24 h et par IP.
 *
 * Fenêtre et plafond repris À L'IDENTIQUE du compteur mémoire qu'ils
 * remplacent : c'est un portage vers un store partagé, pas un resserrage
 * déguisé. La différence est qu'ils s'appliquent désormais réellement.
 * FAIL-CLOSED : chaque soumission crée une ligne plus jusqu'à 20 lignes de
 * portefeuilles, et une file de revue.
 */
export const TRANSPARENCY_SUBMIT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyPrefix: "rl:transparency-submit",
  failClosed: true,
};

/**
 * Bornes de taille des champs texte acceptés sur les surfaces publiques.
 *
 * Une route qui accepte du texte libre sans borne accepte un texte de 10 Mo.
 * Les valeurs sont volontairement généreuses pour l'usage réel et
 * ridiculement basses pour un abus.
 */
export const TEXT_LIMITS = {
  handle: 120,
  email: 254, // RFC 5321
  country: 80,
  displayName: 80,
  contact: 200,
  platform: 40,
  label: 120,
  address: 128,
  notes: 4000,
  freeform: 4000,
} as const;

/**
 * Nombre maximum d'éléments acceptés dans une liste soumise publiquement.
 */
export const LIST_LIMITS = {
  wallets: 20,
  languages: 10,
  specialties: 20,
  publicLinks: 20,
} as const;

/**
 * Normalise une valeur reçue d'un corps de requête en chaîne bornée.
 *
 * Renvoie `""` pour tout ce qui n'est pas une chaîne — un nombre, un objet,
 * un tableau ou `null` envoyés à la place d'un texte ne doivent pas traverser
 * la validation en se faisant passer pour du contenu.
 *
 * `max` est appliqué par troncature AVANT `trim()` : un texte de 10 Mo est
 * coupé tôt, sans que l'on parcoure le reste.
 */
export function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max).trim();
}

/**
 * Vrai si la valeur reçue dépasse la borne — utile pour REFUSER explicitement
 * au lieu de tronquer en silence.
 *
 * Tronquer un `notes` de 10 Mo à 4 000 caractères stocke un texte amputé sans
 * que personne ne le sache. Sur les champs où la troncature changerait le sens,
 * on préfère un 400 explicite.
 */
export function exceedsLimit(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > max;
}
