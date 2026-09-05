// --- BUILD 7 / @v2 — L'AGRÉGATION GROUPE → SUJET (P0) ---------------------
//
// PURE. Elle ne décide RIEN au cas par cas : elle applique la règle que le
// REGISTRE déclare pour la feature, et elle rend toujours les faits de niveau
// groupe avec elle.
//
// ██ IL N'Y A PAS DE RÈGLE « LA VALEUR LA PLUS FRÉQUENTE GAGNE ». ██
// Ce serait un seuil déguisé, et il écraserait le groupe divergent. Quand les
// groupes démontrent deux valeurs, la portée le dit et AUCUNE valeur sujet
// n'est produite.

import type { AggregationDetail, AggregationRule, PerGroupFact } from "./types";

export interface CategoricalGroupFact {
  groupRef: string;
  /** `null` = ce groupe ne démontre rien pour cette feature. */
  value: string | null;
}

export interface AggregatedCategorical {
  detail: AggregationDetail;
  /** La valeur sujet, ou `null` s'il n'y en a pas. */
  value: string | null;
  /** Pourquoi il n'y en a pas. `null` quand une valeur a été produite. */
  reason: string | null;
}

/**
 * Agrège une CATÉGORIELLE de niveau groupe vers le sujet.
 *
 * `ALL_OR_NOTHING`      une valeur n'existe au niveau sujet que si TOUS les
 *                       groupes la démontrent — la feature décrit alors une
 *                       propriété du tout, pas d'un fragment.
 * `DEMONSTRATED_BY_ANY` un fait démontré par au moins un groupe EST démontré ;
 *                       la portée dit par combien, et ne prétend jamais valoir
 *                       pour le sujet entier.
 */
export function aggregateCategorical(
  rule: Extract<AggregationRule, "ALL_OR_NOTHING" | "DEMONSTRATED_BY_ANY">,
  facts: readonly CategoricalGroupFact[],
): AggregatedCategorical {
  const perGroup: PerGroupFact[] = facts.map((f) => ({ groupRef: f.groupRef, value: f.value }));
  const demonstrated = facts.filter((f) => f.value !== null);
  const distinctValues = [...new Set(demonstrated.map((f) => f.value as string))].sort();
  const considered = facts.length;
  const demonstrating = demonstrated.length;

  const base = { rule, groupsConsidered: considered, groupsWithValue: demonstrating, perGroup, distinctValues };

  if (considered === 0 || demonstrating === 0) {
    return {
      detail: { ...base, scope: "NO_GROUP" },
      value: null,
      reason:
        considered === 0
          ? "aucun groupe fourni pour ce sujet"
          : `aucun des ${considered} groupe(s) ne démontre cette caractéristique`,
    };
  }

  // ██ DIVERGENCE : la portée le dit, et rien n'est tranché. ██
  if (distinctValues.length > 1) {
    return {
      detail: { ...base, scope: "CONFLICTING_GROUPS" },
      value: null,
      reason:
        `les groupes démontrent ${distinctValues.length} valeurs distinctes ` +
        `(${distinctValues.join(", ")}) sur ${considered} groupe(s) : aucune valeur sujet ` +
        `n'est produite, et retenir la plus fréquente serait un vote majoritaire`,
    };
  }

  const scope = demonstrating === considered ? "ALL_GROUPS" : "SOME_GROUPS";
  const only = distinctValues[0];

  if (rule === "ALL_OR_NOTHING" && scope !== "ALL_GROUPS") {
    return {
      detail: { ...base, scope },
      value: null,
      reason:
        `« ${only} » n'est démontré que par ${demonstrating} groupe(s) sur ${considered} ; ` +
        `cette caractéristique décrit une propriété du sujet ENTIER et n'existe donc ` +
        `qu'à l'unanimité`,
    };
  }

  return { detail: { ...base, scope }, value: only, reason: null };
}

/**
 * Une grandeur définie PAR GROUPE.
 *
 * ██ DEUX SITUATIONS, ET ELLES NE SE CONFONDENT PAS. ██
 *
 * PLUSIEURS GROUPES — il n'y a pas de valeur sujet. Elle n'est pas perdue pour
 * autant : `perGroup` la porte intacte, groupe par groupe. Ce qui est refusé,
 * c'est de la RÉSUMER : une somme, une moyenne ou un maximum fabriquerait une
 * grandeur que rien n'a mesurée.
 *
 * UN SEUL GROUPE — le sujet EST le groupe, et la grandeur est exactement celle
 * que le contrat définit (« du premier au dernier acte DU GROUPE »). La rendre
 * NON MESURABLE serait refuser de lire une valeur qui existe, au niveau même où
 * elle est définie ; le comparateur la transporterait alors moins bien que @v1,
 * ce qui n'est pas une correction mais une régression.
 *
 * Ce n'est PAS un seuil : c'est la différence entre l'unité de définition
 * (un groupe) et un agrégat qui n'en est pas une (plusieurs). Et la grandeur
 * reste, dans les deux cas, TRANSPORTÉE et jamais jugée — INV-8 y veille.
 */
export function aggregateMagnitude(
  facts: readonly { groupRef: string; value: number | null }[],
): AggregationDetail {
  const withValue = facts.filter((f) => f.value !== null).length;
  const definitional = facts.length === 1 && withValue === 1;
  return {
    rule: "PER_GROUP_MAGNITUDE",
    scope: definitional ? "ALL_GROUPS" : "PER_GROUP_ONLY",
    groupsConsidered: facts.length,
    groupsWithValue: withValue,
    perGroup: facts.map((f) => ({ groupRef: f.groupRef, value: f.value })),
    distinctValues: [],
  };
}

/** Vrai quand le sujet EST le groupe : la grandeur y est définie. */
export function magnitudeIsDefinitional(detail: AggregationDetail): boolean {
  return (
    detail.rule === "PER_GROUP_MAGNITUDE" &&
    detail.groupsConsidered === 1 &&
    detail.groupsWithValue === 1
  );
}

/** Une feature calculée directement au niveau sujet : rien à agréger. */
export function notAggregated(rule: AggregationRule = "SUBJECT_LEVEL"): AggregationDetail {
  return {
    rule,
    scope: "NOT_AGGREGATED",
    groupsConsidered: 0,
    groupsWithValue: 0,
    perGroup: [],
    distinctValues: [],
  };
}
