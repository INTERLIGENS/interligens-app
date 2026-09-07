// ─── BUILD 8 / P3 — LA NATURE D'UN MONTANT DE PROCEEDS ─────────────────────
//
// ██  5 602 lignes, 17,5 M$, deux natures dans la MÊME colonne, aucune       ██
// ██  colonne pour les distinguer. C'est la table monétaire du produit.      ██
//
// ─── Ce que la mesure a établi ─────────────────────────────────────────────
//
// `KolProceedsEvent.amountUsd` n'est JAMAIS un montant relevé tel quel : il est
// CALCULÉ, `amountUsd = quantité × prix` (src/lib/kol/proceeds.ts:90 et :187).
// La nature ne se lit donc pas dans la table, elle se lit dans le PRIX injecté
// — et `pricingSource` le nomme, ligne par ligne.
//
// Mesuré sur ep-square-band le 2026-09-07, en lecture seule :
//
//   pricingSource                  n      prix    qté    usd   méthode réelle
//   binance_historical          5 407   5 407     78  5 407   clôture quotidienne Binance
//   helius_sol_estimate_200usd    133      59    133     59   constante SOL = 200 $
//   yearly_fallback                53      53     50     53   constante annuelle codée
//   ARKHAM_CSV                      6       0      0      6   montant importé tel quel
//   CEX_DETECTED                    2       0      0      2   posé à la détection, ambigu
//   arkham_aggregate                1       0      0      1   montant importé tel quel
//
// ─── Q3 — la nature est celle de la DERNIÈRE OPÉRATION ─────────────────────
//
// Le prix Binance est une donnée tierce ; la quantité est constatée on-chain.
// Mais le MONTANT n'est ni l'un ni l'autre : c'est le produit des deux, calculé
// par nous. Il est donc INFERENCE, avec les deux entrées retenues en basis.
//
// Le classer THIRD_PARTY_DATA parce que le prix vient de Binance serait le
// site de mélange M4 exactement : étiqueter du nom d'un fournisseur un chiffre
// qu'il n'a jamais publié.
//
// ─── Pourquoi une ESTIMATE, et pas une INFERENCE de plus ───────────────────
//
// `yearly_fallback` n'est pas un prix observé : c'est une constante par année,
// écrite en dur dans src/lib/kol/pricing.ts (SOL 2024:120, 2025:145, 2026:185).
// Mesuré : 52 lignes valorisées à exactement 145, 1 à 185. Aucune observation
// n'a eu lieu — la grandeur n'était pas disponible, on l'a remplacée.
//
// `helius_sol_estimate_200usd` porte la même faute d'un cran plus loin : le
// prix du TOKEN y est dérivé d'une constante SOL = 200 $ posée par le seeder
// (src/scripts/seed/botifyKolScan.ts:29). Les 59 prix stockés ne valent pas
// 200 — ce sont des prix de token — mais ils DÉPENDENT tous de cette
// constante, et rien dans la ligne ne le dit.
//
// Une grandeur non observable, remplacée par une valeur choisie, est une
// ESTIMATE. Règle §1.2 : quand deux natures conviendraient, la MOINS
// autoritaire l'emporte.
//
// ─── Pourquoi un natureBasis et PAS un methodRef inventé ───────────────────
//
// `assertEstimateAuditable` (src/lib/data-nature/writeGuard.ts) accepte une
// ESTIMATE auditable par SA MÉTHODE **ou** par SON BASIS, et son commentaire
// dit pourquoi : « W2 a produit une ESTIMATE légitime qu'AUCUNE méthodologie
// gelée ne couvre […] Exiger un methodRef l'aurait poussée à en inventer un :
// exactement ce que W2 interdit. »
//
// C'est le cas ici. `financial-estimates/est-proceeds@v1` décrit une
// valorisation « at contemporaneous market or LP price data » — ce qui décrit
// `binance_historical` et NE DÉCRIT PAS une constante annuelle. Le citer sur
// les 186 lignes estimées attacherait une méthode qui ment sur ce qui a été
// fait. Ces lignes portent donc un basis explicite : la constante employée,
// son origine, et la formule.
//
// ─── Fail-closed ───────────────────────────────────────────────────────────
//
// Une `pricingSource` inconnue, absente, ou un `amountUsd` nul ne reçoit PAS
// une nature par défaut : il reçoit UNCLASSIFIED. Un montant dont on ne sait
// pas ce qu'il affirme ne se publie pas.

import { UNCLASSIFIED, type DataNature, type NatureValue } from "@/lib/data-nature/nature";

/** Table de la table. Le seul endroit qui nomme ces chaînes. */
export const PRICING_SOURCES = {
  BINANCE_HISTORICAL: "binance_historical",
  HELIUS_SOL_ESTIMATE_200: "helius_sol_estimate_200usd",
  YEARLY_FALLBACK: "yearly_fallback",
  ARKHAM_CSV: "ARKHAM_CSV",
  ARKHAM_AGGREGATE: "arkham_aggregate",
  CEX_DETECTED: "CEX_DETECTED",
} as const;

export interface AmountBasis {
  /** La formule effectivement appliquée. */
  readonly formula: string;
  /** Les natures des entrées (Q3). */
  readonly inputs: readonly DataNature[];
  /** La constante employée, quand il y en a une. C'est ce qui rend auditable. */
  readonly constant?: { readonly name: string; readonly value: string; readonly origin: string };
  /** Résolution temporelle du prix employé (BUILD 7 / P2). */
  readonly priceResolution: "INSTANT" | "DAY" | "PERIOD" | "NONE";
}

export interface AmountClassification {
  readonly nature: NatureValue;
  readonly basis: AmountBasis | null;
  /** Pourquoi cette nature, en une phrase — pour le rapport et le backfill. */
  readonly why: string;
}

/** Une ligne KolProceedsEvent, dans la forme minimale nécessaire au classement. */
export interface ProceedsEventRow {
  readonly pricingSource?: unknown;
  readonly amountUsd?: unknown;
  readonly ambiguous?: unknown;
}

const UNCLASSIFIED_RESULT = (why: string): AmountClassification => ({
  nature: UNCLASSIFIED,
  basis: null,
  why,
});

/**
 * LE classement. Une ligne, une nature, une raison.
 *
 * Cette fonction est la SPÉCIFICATION du backfill : le SQL de migration
 * reproduit exactement ces branches, et un test compare les deux. Écrire la
 * règle deux fois sans les confronter est le mécanisme par lequel une base et
 * son code divergent en silence.
 */
export function classifyAmountUsd(row: ProceedsEventRow): AmountClassification {
  // Un montant absent n'affirme rien — il n'y a rien à classer.
  if (row.amountUsd == null || typeof row.amountUsd !== "number" || !Number.isFinite(row.amountUsd)) {
    return UNCLASSIFIED_RESULT("aucun montant : la ligne n'affirme aucune valeur monétaire");
  }

  // Une ligne marquée ambiguë par le produit ne se classe pas à sa place.
  if (row.ambiguous === true) {
    return UNCLASSIFIED_RESULT(
      "ligne marquée ambiguous par le produit : la classer serait trancher à sa place",
    );
  }

  const src = typeof row.pricingSource === "string" ? row.pricingSource : "";

  switch (src) {
    case PRICING_SOURCES.BINANCE_HISTORICAL:
      return {
        nature: "INFERENCE",
        basis: {
          formula: "amountUsd = quantité constatée on-chain × clôture quotidienne Binance",
          inputs: ["PRIMARY_OBSERVATION", "THIRD_PARTY_DATA"],
          priceResolution: "DAY",
        },
        why:
          "produit d'une quantité constatée et d'un prix tiers — le montant n'a été " +
          "publié par personne, il est calculé ici (Q3)",
      };

    case PRICING_SOURCES.YEARLY_FALLBACK:
      return {
        nature: "ESTIMATE",
        basis: {
          formula: "amountUsd = quantité constatée on-chain × constante annuelle",
          inputs: ["PRIMARY_OBSERVATION"],
          constant: {
            name: "YEARLY_FALLBACK",
            value: "SOL 2024:120 · 2025:145 · 2026:185 (USD)",
            origin: "src/lib/kol/pricing.ts — valeurs codées en dur",
          },
          priceResolution: "PERIOD",
        },
        why:
          "le prix n'a pas été observé : il a été remplacé par une constante " +
          "annuelle. Grandeur non observable remplacée par une valeur choisie",
      };

    case PRICING_SOURCES.HELIUS_SOL_ESTIMATE_200:
      return {
        nature: "ESTIMATE",
        basis: {
          formula:
            "prix du token dérivé d'un swap libellé en SOL, valorisé à une constante SOL",
          inputs: ["PRIMARY_OBSERVATION"],
          constant: {
            name: "SOL_PRICE_ESTIMATE",
            value: "200 USD (fenêtre janvier–février 2025)",
            origin: "src/scripts/seed/botifyKolScan.ts — constante de seeding",
          },
          priceResolution: "PERIOD",
        },
        why:
          "le prix stocké n'est pas 200 $ — c'est un prix de token — mais il DÉPEND " +
          "d'une constante SOL posée par le seeder, et rien dans la ligne ne le disait",
      };

    case PRICING_SOURCES.ARKHAM_CSV:
    case PRICING_SOURCES.ARKHAM_AGGREGATE:
      return {
        nature: "THIRD_PARTY_DATA",
        basis: {
          formula: "amountUsd repris tel quel de la source",
          inputs: ["THIRD_PARTY_DATA"],
          priceResolution: "NONE",
        },
        why:
          "montant importé sans transformation (ni prix ni quantité en base) — " +
          "un relais, pas un calcul",
      };

    // `CEX_DETECTED` tombe volontairement dans le défaut : ses 2 lignes sont
    // toutes ambiguous=true et n'ont ni prix ni quantité. On ne devine pas.
    default:
      return UNCLASSIFIED_RESULT(
        src.length > 0
          ? `pricingSource « ${src} » hors vocabulaire connu : classement humain requis`
          : "pricingSource absente : rien ne dit comment ce montant a été obtenu",
      );
  }
}

/** La nature seule — utilisée par le prédicat de champ du registre. */
export function amountUsdNature(row: ProceedsEventRow): NatureValue {
  return classifyAmountUsd(row).nature;
}

/**
 * La nature de la LIGNE, distincte de celle du montant.
 *
 * Une ligne KolProceedsEvent est la trace d'une transaction lue on-chain :
 * signature, date, portefeuille, chaîne. Ça, c'est constaté. Seul le montant
 * en dollars est dérivé — d'où le régime CHAMP, et d'où l'importance de ne pas
 * confondre les deux : dire que la ligne est une INFERENCE effacerait le fait
 * que la transaction, elle, a bien eu lieu.
 */
export function proceedsRowNature(row: ProceedsEventRow): NatureValue {
  // Les lignes importées d'Arkham ne sont pas des transactions que nous avons
  // lues : ce sont des lignes de CSV. Elles ne peuvent pas être PRIMARY.
  const src = typeof row.pricingSource === "string" ? row.pricingSource : "";
  if (src === PRICING_SOURCES.ARKHAM_CSV || src === PRICING_SOURCES.ARKHAM_AGGREGATE) {
    return "THIRD_PARTY_DATA";
  }
  if (src === PRICING_SOURCES.CEX_DETECTED) return UNCLASSIFIED;
  if (src.length === 0) return UNCLASSIFIED;
  return "PRIMARY_OBSERVATION";
}
