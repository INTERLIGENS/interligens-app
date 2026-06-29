/**
 * src/lib/osint/decision/poisoningMonitor.ts
 *
 * SPRINT A — Détection de signalement coordonné (data poisoning). AVANT
 * d'augmenter la moindre confiance sur un lien KOL↔token, on vérifie qu'on n'est
 * pas face à un cluster de soumissions coordonnées : N soumissions récentes
 * ciblant le MÊME kolHandle, avec des captures visuellement proches
 * (perceptualHash ~), encore NON vérifiées, depuis des tiers de faible confiance.
 *
 * Si cluster détecté → flag 'possible_coordinated_reporting', on NE monte PAS la
 * confiance, et on route en PENDING_REVIEW. Fonction PURE / read-only : la liste
 * des soumissions antérieures est INJECTÉE (aucun accès DB ici).
 */

import { SourceTrustTier, SOURCE_TRUST_WEIGHT } from "../contracts";

/** Vue minimale d'une soumission antérieure (lecture seule, injectée). */
export interface PriorSubmissionLite {
  imageSha256: string;
  perceptualHash: string | null;
  kolHandle: string | null;
  trustTier: SourceTrustTier;
  /** true si la soumission a atteint un palier vérifié (onchain/human). */
  verified: boolean;
  ingestedAt: string; // ISO 8601 UTC
}

export interface PoisoningInput {
  kolHandle: string | null;
  perceptualHash: string | null;
  trustTier: SourceTrustTier;
  priorSubmissions: PriorSubmissionLite[];
  /** Instant courant (injecté pour rester déterministe, pas de Date interne). */
  now: string;
  /** Fenêtre de regroupement, en heures (défaut 72h). */
  windowHours?: number;
  /** Taille minimale du cluster (soumission courante incluse) pour flaguer (défaut 3). */
  minClusterSize?: number;
  /** Distance de Hamming max (bits) entre pHash pour « similaire » (défaut 10). */
  maxHammingBits?: number;
}

export interface PoisoningVerdict {
  cluster: boolean;
  flag: "possible_coordinated_reporting" | null;
  clusterSize: number;
  /** true ⇒ ne PAS augmenter la confiance, router PENDING_REVIEW. */
  suppressConfidenceBoost: boolean;
  reason: string;
  /** sha256 des membres du cluster (hors soumission courante). */
  members: string[];
}

const INVESTIGATOR_WEIGHT = SOURCE_TRUST_WEIGHT[SourceTrustTier.INVESTIGATOR];

/** Hamming bit-level sur deux pHash hex de même longueur. Infini si incomparable. */
export function hexHamming(a: string | null, b: string | null): number {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const na = parseInt(a[i], 16);
    const nb = parseInt(b[i], 16);
    if (Number.isNaN(na) || Number.isNaN(nb)) return Number.POSITIVE_INFINITY;
    let x = na ^ nb;
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/**
 * Évalue le risque de poisoning pour la soumission courante. Ne compte que les
 * antérieures : même handle, fenêtre récente, pHash proche, NON vérifiées, tier
 * de faible confiance (< investigator). Un signalement par un investigator/admin,
 * ou une soumission déjà vérifiée, ne nourrit pas le cluster.
 */
export function evaluatePoisoning(input: PoisoningInput): PoisoningVerdict {
  const windowHours = input.windowHours ?? 72;
  const minClusterSize = input.minClusterSize ?? 3;
  const maxHammingBits = input.maxHammingBits ?? 10;

  const none: PoisoningVerdict = {
    cluster: false,
    flag: null,
    clusterSize: 1,
    suppressConfidenceBoost: false,
    reason: "no coordinated-reporting cluster detected",
    members: [],
  };

  // Pas de handle ciblé → rien à empoisonner côté attribution.
  if (!input.kolHandle) return none;

  const nowMs = Date.parse(input.now);
  const windowMs = windowHours * 3600 * 1000;
  const handle = input.kolHandle.toLowerCase();

  const members = input.priorSubmissions.filter((p) => {
    if (!p.kolHandle || p.kolHandle.toLowerCase() !== handle) return false;
    if (p.verified) return false; // déjà vérifiée ⇒ pas un signalement brut
    if (SOURCE_TRUST_WEIGHT[p.trustTier] >= INVESTIGATOR_WEIGHT) return false; // tier de confiance
    const t = Date.parse(p.ingestedAt);
    if (Number.isNaN(t) || nowMs - t > windowMs || t > nowMs) return false; // hors fenêtre
    return hexHamming(input.perceptualHash, p.perceptualHash) <= maxHammingBits;
  });

  const clusterSize = members.length + 1; // + la soumission courante

  // Le cluster est porté par la MASSE de signalements faible-confiance autour du
  // handle (les `members`, déjà filtrés < investigator + non vérifiés). Il
  // s'applique quel que soit le tier de la soumission COURANTE : même un
  // investigator dont la capture rejoint un brigade troll voit son boost
  // suspendu et routé en revue (l'evidence/CA reste, elle, commitée).
  if (clusterSize >= minClusterSize) {
    return {
      cluster: true,
      flag: "possible_coordinated_reporting",
      clusterSize,
      suppressConfidenceBoost: true,
      reason: `${clusterSize} soumissions faible-confiance non vérifiées ciblent @${handle} avec des captures similaires (pHash≤${maxHammingBits} bits, ${windowHours}h)`,
      members: members.map((m) => m.imageSha256),
    };
  }

  return { ...none, clusterSize, members: members.map((m) => m.imageSha256) };
}
