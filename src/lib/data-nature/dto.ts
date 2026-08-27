// ─── S2 — La nature voyage AVEC la donnée, jusqu'à la sortie ────────────────
//
// Pourquoi la sortie AVANT le reclassement en base : le dégât mesuré par le
// discovery se produit À LA LECTURE. Un consommateur reçoit une inférence et la
// lit comme une observation ; rien dans la charge utile ne l'en empêche.
// Étiqueter les sorties depuis le registre traite ça sans DDL, sans backfill,
// et sans risque — et le schéma vient ensuite consolider ce que le code sait.
//
// Trois doctrines sont encodées ici, pas seulement documentées :
//   Q2  aucun tri global par confidence entre natures différentes
//   Q3  la nature de sortie est celle de la TRANSFORMATION, pas de l'entrée
//   Q5  methodRef versionnable et auditable — « internal » est refusé

import {
  assertPublishable, assertEstimateHasMethod, assertSingleNatureForConfidence,
  leastAuthoritative, UNCLASSIFIED,
  type DataNature, type NatureValue,
} from "./nature";
import { natureForField, natureForRow } from "./registry";

/** Bloc porté par toute sortie publique. Nom préfixé : il ne collisionne avec
 *  aucun champ métier existant et se repère d'un coup d'œil dans un payload. */
export interface NatureEnvelope {
  nature: DataNature;
  /** Q3 — natures des entrées quand `nature` est INFERENCE. */
  natureBasis?: DataNature[];
  /** Q5 — obligatoire quand `nature` est ESTIMATE. Forme `slug@version`. */
  methodRef?: string;
  /** Nature par champ, quand la ligne en porte plusieurs (régime CHAMP). */
  fields?: Record<string, DataNature>;
}

export type WithNature<T> = T & { _nature: NatureEnvelope };

export interface DecorateOptions {
  /** Champs gouvernés à étiqueter individuellement (régime CHAMP). */
  fields?: string[];
  /** Q5 — référence de méthode, si la ligne porte une ESTIMATE. */
  methodRef?: string;
  /** Q3 — natures des entrées, si la ligne est une INFERENCE. */
  basis?: DataNature[];
}

/**
 * Décore un DTO depuis le registre. Lève si la nature est inconnue (I3) ou si
 * une ESTIMATE n'a pas de méthode (Q5). Ne renvoie JAMAIS un défaut.
 */
export function decorate<T extends Record<string, unknown>>(
  table: string,
  row: T,
  where: string,
  opts: DecorateOptions = {},
): WithNature<T> {
  const rowNature = natureForRow(table, row);
  assertPublishable(rowNature, `${where} → ${table}`);
  assertEstimateHasMethod(rowNature, opts.methodRef, `${where} → ${table}`);

  let fields: Record<string, DataNature> | undefined;
  if (opts.fields?.length) {
    fields = {};
    for (const f of opts.fields) {
      const n = natureForField(table, f, row);
      // Un champ non classé n'est pas publié : on le retire du DTO plutôt que
      // de publier une valeur dont on ne sait pas ce qu'elle affirme.
      if (n === UNCLASSIFIED) {
        delete (row as Record<string, unknown>)[f];
        continue;
      }
      // Q5 s'applique AU CHAMP, pas seulement à la ligne : dans token_casefiles
      // la ligne est EDITORIAL_ASSERTION et c'est estimatedRetailHarmUsd qui est
      // l'ESTIMATE. Ne contrôler que la ligne laisserait passer 482 M$ sans méthode.
      assertEstimateHasMethod(n, opts.methodRef, `${where} → ${table}.${f}`);
      fields[f] = n;
    }
  }

  return {
    ...row,
    _nature: {
      nature: rowNature,
      ...(opts.basis?.length ? { natureBasis: opts.basis } : {}),
      ...(opts.methodRef ? { methodRef: opts.methodRef } : {}),
      ...(fields && Object.keys(fields).length ? { fields } : {}),
    },
  };
}

/**
 * Q3 — nature d'une sortie DÉRIVÉE. La nature est celle de la TRANSFORMATION,
 * jamais héritée des entrées ; celles-ci sont retenues dans `natureBasis`.
 *
 * `transformation` dit ce que le produit a fait :
 *   "relay"    reproduction sans transformation de sens  → nature des entrées
 *   "compute"  calcul déterministe                       → INFERENCE
 *   "estimate" grandeur non observable                   → ESTIMATE
 *   "assert"   un humain engage sa responsabilité        → EDITORIAL_ASSERTION
 */
export function natureOfTransformation(
  transformation: "relay" | "compute" | "estimate" | "assert",
  inputs: DataNature[],
): { nature: DataNature; natureBasis: DataNature[] } {
  const basis = [...new Set(inputs)].sort();
  switch (transformation) {
    case "compute": return { nature: "INFERENCE", natureBasis: basis };
    case "estimate": return { nature: "ESTIMATE", natureBasis: basis };
    case "assert": return { nature: "EDITORIAL_ASSERTION", natureBasis: basis };
    case "relay": {
      // Un relais ne crée rien : il hérite. Quand les entrées mélangent
      // plusieurs natures, la MOINS autoritaire l'emporte (règle §1.2).
      if (basis.length === 0) return { nature: "THIRD_PARTY_DATA", natureBasis: [] };
      return { nature: basis.reduce(leastAuthoritative), natureBasis: basis };
    }
  }
}

/**
 * Q2 — le remplaçant sûr d'un tri global par confiance. Groupe par nature, trie
 * DANS chaque groupe, puis ordonne les groupes par un ordre que l'appelant
 * DÉCLARE. Il n'y a pas d'ordre par défaut : décider qu'une observation vaut
 * mieux qu'un dossier publié est un arbitrage produit, pas une propriété du tri.
 */
export function sortWithinNature<T extends { nature: NatureValue }>(
  items: readonly T[],
  compareWithinNature: (a: T, b: T) => number,
  natureOrder: readonly DataNature[],
): T[] {
  const out: T[] = [];
  for (const n of natureOrder) {
    const group = items.filter((i) => i.nature === n);
    if (group.length > 1) assertSingleNatureForConfidence(group, "sortWithinNature");
    out.push(...group.slice().sort(compareWithinNature));
  }
  // Ce que l'ordre déclaré n'a pas nommé reste en queue, jamais supprimé.
  out.push(...items.filter((i) => !natureOrder.includes(i.nature as DataNature)));
  return out;
}

/** I3 — dernière barrière avant l'envoi. À appeler dans le sérialiseur. */
export function assertDtoPublishable(dto: unknown, where: string): void {
  const env = (dto as { _nature?: NatureEnvelope })?._nature;
  if (!env) throw new Error(`[data-nature] DTO sans enveloppe de nature (${where}) — I3.`);
  assertPublishable(env.nature, where);
  assertEstimateHasMethod(env.nature, env.methodRef, where);
}
