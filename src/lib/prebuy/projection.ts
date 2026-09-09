// ─── BUILD 12 · S2 — LA PROJECTION, ET ELLE LIT DEUX CHOSES ────────────────
//
// ██  LA PROJECTION CONSOMME VERDICT + ÉTAT DE MESURE. JAMAIS LE VERDICT   ██
// ██  SEUL.                                                                ██
//
// La propriété est STRUCTURELLE, pas déclarative : deux décisions au MÊME
// verdict `NO_CRITICAL_SIGNAL`, l'une dégradée, doivent projeter
// différemment. Une fonction du seul verdict échoue par construction — et
// c'est exactement ce que faisait `derivePhantomWarning`. La forme de
// `DecisionCanonique` rend l'erreur inexprimable : il n'y a pas de surcharge
// qui prenne le verdict tout seul.
//
// ─── WAIT et VERIFY ───────────────────────────────────────────────────────
//
// Ils projettent tous deux sur WARN, et ce n'est pas une équivalence : c'est
// que le contrat partenaire v1 ne sait pas les exprimer. `because` préserve le
// verdict d'origine, intact. En interne ils ne se confondent à aucun moment.
//
// ─── Sur les surfaces legacy ──────────────────────────────────────────────
//
// Les adaptateurs plus bas rendent les vocabulaires historiques
// (GREEN/ORANGE/RED, SAFE/WARNING/AVOID, ALLOW/WARN/BLOCK). Ils dérivent TOUS
// de la même `DecisionCanonique` : verdict et action ne peuvent plus diverger,
// parce qu'ils n'ont plus deux sources.

import type { ReflexVerdict } from "@/lib/reflex/types";
import type { DecisionCanonique, ManqueMesure } from "./canonicalDecision";

export type PreBuyLevel = "BLOCK" | "WARN" | "ALLOW";

export interface PreBuyProjection {
  level: PreBuyLevel;
  /** Le verdict D'ORIGINE, préservé. WAIT et VERIFY ne se confondent pas. */
  because: ReflexVerdict;
  /** Ce qui n'a pas été mesuré, tel quel. Jamais aplati, jamais filtré. */
  missing: readonly ManqueMesure[];
  degraded: boolean;
  /**
   * L'identité canonique a-t-elle été établie. Portée jusqu'ici parce qu'un
   * WARN d'identité non résolue et un WARN de mesure incomplète ne se disent
   * pas de la même façon — et qu'une surface qui les confondrait mentirait
   * sur la cause.
   */
  identityResolved: boolean;
  /** La phrase de réassurance, ou `null`. Jamais émise sans support. */
  reassurance: string | null;
}

export const REASSURANCE = "No major risk signals detected";

/**
 * La table de projection conservatrice, ratifiée :
 *
 *   STOP                   → BLOCK
 *   WAIT                   → WARN
 *   VERIFY                 → WARN
 *   INSUFFICIENT_COVERAGE  → WARN
 *   NO_CRITICAL_SIGNAL     → ALLOW UNIQUEMENT si le contrat de mesure attendue
 *                            est satisfait ET que la décision n'est pas dégradée
 *   NO_CRITICAL_SIGNAL + dégradé ou incomplet → WARN
 *
 * Et, avant tout le reste : une identité non résolue ne peut pas produire une
 * autorisation, quel que soit le verdict. Un STOP reste un BLOCK — on ne
 * relâche pas une gravité mesurée parce que l'identité manque.
 */
export function projectPreBuy(d: DecisionCanonique): PreBuyProjection {
  const base = {
    because: d.verdict,
    missing: d.coverage.missing,
    degraded: d.degraded,
    identityResolved: d.identityResolved,
  };

  switch (d.verdict) {
    case "STOP":
      // Avant l'identité : une gravité mesurée survit à tout le reste.
      return { ...base, level: "BLOCK", reassurance: null };
    case "WAIT":
    case "VERIFY":
    case "INSUFFICIENT_COVERAGE":
      return { ...base, level: "WARN", reassurance: null };
    case "NO_CRITICAL_SIGNAL": {
      const soutenu =
        d.identityResolved && d.expectedContractSatisfied && !d.degraded;
      return soutenu
        ? { ...base, level: "ALLOW", reassurance: REASSURANCE }
        : { ...base, level: "WARN", reassurance: null };
    }
    default:
      // Un verdict que la table ne connaît pas n'est pas un contrat satisfait.
      // Il retombe là où retombe toute décision non soutenue — et jamais sur
      // le niveau permissif. Sans ce `default`, un verdict inconnu rendait
      // `undefined` : ni permissif ni utilisable. Critère C2 de T2.
      return { ...base, level: "WARN", reassurance: null };
  }
}

// ═══ ADAPTATEURS LEGACY — projections, pas autorités ═════════════════════
//
// Chacun est une fonction de la PROJECTION, donc de la décision complète.
// Aucun ne relit un score. Aucun ne porte de seuil.

/** Le vocabulaire du chemin swap : GREEN · ORANGE · RED. */
export type SwapTier = "GREEN" | "ORANGE" | "RED";

export function toSwapTier(p: PreBuyProjection): SwapTier {
  if (p.level === "BLOCK") return "RED";
  if (p.level === "WARN") return "ORANGE";
  return "GREEN";
}

/** Le vocabulaire externe partenaire. `SAFE` reste dans le domaine. */
export type PartnerVerdict = "SAFE" | "WARNING" | "AVOID";

/**
 * Ce que la migration change n'est pas le JETON mais sa CONDITION D'ÉMISSION :
 * `SAFE` ne sort plus que sur une projection ALLOW, c'est-à-dire adossée à une
 * mesure attendue réussie et à une identité résolue. Le retirer du domaine
 * casserait des partenaires ; l'émettre sans mesure violerait BUILD 12.
 */
export function toPartnerVerdict(p: PreBuyProjection): PartnerVerdict {
  if (p.level === "BLOCK") return "AVOID";
  if (p.level === "WARN") return "WARNING";
  return "SAFE";
}

export type PartnerRecommendation = "ALLOW" | "WARN" | "BLOCK";

/**
 * L'action EST le niveau. C'est tout le correctif du défaut (a) : il n'y a
 * plus deux dérivations, donc plus de bande où verdict et action divergent.
 */
export function toPartnerRecommendation(p: PreBuyProjection): PartnerRecommendation {
  return p.level;
}

/**
 * La phrase du contrat partenaire. Même règle que côté `/api/v1/score` : elle
 * n'est émise que si la mesure attendue réussie la soutient.
 *
 * `buildReason` ne recevait que `(score, signalsCount)` — aucun état de mesure.
 * C'était le même défaut, resté ouvert côté partenaire.
 */
export function buildPartnerReason(
  p: PreBuyProjection,
  score: number,
  signalsCount: number,
): string {
  // Le préfixe `Score N/100 — ` est conservé au caractère près : des
  // partenaires le lisent. Ce qui change est la clause qui suit, et surtout la
  // CONDITION sous laquelle la clause rassurante peut apparaître.
  const tete = `Score ${score}/100 — `;
  const s = (n: number) => (n !== 1 ? "s" : "");

  if (p.level === "BLOCK") {
    return `${tete}${signalsCount} high-risk signal${s(signalsCount)} detected`;
  }
  if (p.level === "WARN") {
    // Un WARN qui vient d'une mesure incomplète ne se déguise pas en risque
    // élevé mesuré : il dit ce qu'il est.
    return p.because === "NO_CRITICAL_SIGNAL" || p.because === "INSUFFICIENT_COVERAGE"
      ? `${tete}the expected checks did not all complete — unverified, not safe`
      : `${tete}${signalsCount} risk signal${s(signalsCount)} detected, proceed with caution`;
  }
  return `${tete}no critical risk signals detected`;
}
