// --- SHILL-C1 : une mesure censuree n'est pas une mesure ------------------
//
// LE DEFAUT QUI FONDE CE MODULE (revue du 2026-08-28)
// `getSignaturesForAddress(wallet, 1000)` plafonne la collecte. Quand le
// plafond est atteint, `txCount30d` vaut 1000 - et 1000 ne dit pas « mille
// transactions », il dit « au moins mille, on n'a pas regarde plus loin ».
// Les 20 wallets exclus en `high_frequency` portaient TOUS exactement 1000 :
// aucune exclusion ne reposait sur un comptage, toutes sur un plafond.
//
// INVARIANT SHILL-C1
// Une valeur plafonnee par la collecte ne peut JAMAIS etre traitee comme une
// mesure exacte, ni franchir seule un seuil. Le type l'impose : une comparaison
// sur une valeur censuree ne rend pas un booleen, elle rend `indeterminate`,
// et l'appelant doit en faire quelque chose.

export interface Measurement {
  value: number;
  /** true => `value` est un PLANCHER impose par la collecte, pas la quantite. */
  censored: boolean;
  /** Ce qui a borne la collecte. Renseigne si et seulement si `censored`. */
  censoredBy: string | null;
}

export function exactMeasurement(value: number): Measurement {
  return { value, censored: false, censoredBy: null };
}

export function censoredMeasurement(value: number, by: string): Measurement {
  return { value, censored: true, censoredBy: by };
}

/** Absence de mesure - distincte d'une mesure a zero. */
export const UNMEASURED: Measurement = { value: Number.NaN, censored: false, censoredBy: null };

export function isMeasured(m: Measurement): boolean {
  return Number.isFinite(m.value);
}

export type ThresholdVerdict = "above" | "below" | "indeterminate";

/**
 * SHILL-C1. Trois issues, jamais deux.
 *
 * `indeterminate` couvre deux cas et un seul comportement : on ne sait pas.
 *   - la mesure est absente ;
 *   - la mesure est censuree et la valeur censuree se trouve AU-DESSUS du
 *     seuil. Le vrai nombre est peut-etre bien plus haut - mais la collecte
 *     s'est arretee la, et un plafond n'est pas un constat.
 *
 * Une valeur censuree SOUS le seuil, elle, est concluante : le plancher lui-meme
 * ne l'atteint pas, donc la vraie valeur non plus... a l'envers. Un plancher
 * sous le seuil ne dit rien du vrai total, qui peut le depasser. On rend donc
 * `indeterminate` des que la mesure est censuree, sans exception.
 */
export function compareToThreshold(m: Measurement, threshold: number): ThresholdVerdict {
  if (!isMeasured(m)) return "indeterminate";
  if (m.censored) return "indeterminate";
  return m.value >= threshold ? "above" : "below";
}

export class CensoredThresholdError extends Error {
  constructor(what: string, m: Measurement) {
    super(
      `[shill] SHILL-C1 viole (${what}) : tentative de franchir un seuil avec une ` +
        `valeur censuree (${m.value}, plafonnee par ${m.censoredBy ?? "?"}). ` +
        "Un plafond de collecte n'est pas une mesure.",
    );
    this.name = "CensoredThresholdError";
  }
}

/** Garde-fou explicite pour un appelant qui croirait tenir un comptage. */
export function assertUsableAsCount(m: Measurement, what: string): number {
  if (m.censored) throw new CensoredThresholdError(what, m);
  if (!isMeasured(m)) throw new CensoredThresholdError(what, m);
  return m.value;
}

/**
 * DENSITE - ce que la saturation ne detruit PAS.
 *
 * Le plafond detruit le comptage sur 30 jours, mais pas la densite : 1 000
 * signatures couvrant 3 jours font 333/jour, et c'est exact pour cette fenetre.
 * C'est la seule quantite de frequence qu'on puisse encore affirmer une fois le
 * sampler sature - et elle ne coute aucun appel supplementaire.
 */
export function activityDensityPerDay(sampleSize: number, sampleSpanDays: number | null): Measurement {
  if (sampleSpanDays == null || sampleSpanDays <= 0 || sampleSize <= 0) return UNMEASURED;
  return exactMeasurement(sampleSize / sampleSpanDays);
}
