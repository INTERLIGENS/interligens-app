// ─── CONTAINMENT P0 — LES MONTANTS NOMINATIFS BOTIFY NON REPRODUCTIBLES ────
//
// ██  Ce module RETIRE des affirmations. Il n'en corrige aucune.            ██
//
// ─── Ce qui a été mesuré, et pourquoi ces chiffres sortent ─────────────────
//
// Le preset BOTIFY affirmait quatre encaissements nominatifs, chacun attribué
// à une personne nommée et à une adresse :
//
//     EduRio       347 237 $ → MEXC
//     MoneyLord     85 484 $ → Bybit
//     ElonTrades    53 313 $ → MEXC
//     GordonGekko   40 627 $
//
// Mesuré sur ep-square-band le 2026-09-07, en lecture seule : les QUATRE
// adresses portent **0 ligne KolProceedsEvent**. Aucune source du produit ne
// rend ces montants. Et les agrégats du même preset ne se reproduisent pas
// davantage — 604 489 $ affirmés contre 150 577 $ mesurés sur le mint
// canonique, 28 KOL contre 18, 295 événements contre 262.
//
// Trois des quatre adresses sont par ailleurs `isPubliclyUsable = false` :
// le CaseFile publiait nominativement des adresses que le régime de
// publication livré en BUILD 8 refuse sur toutes les autres surfaces.
//
// ─── Ce que ce module NE fait PAS, et c'est délibéré ───────────────────────
//
// Il ne remplace AUCUN chiffre retiré par une valeur de la base. 150 577 $
// n'est pas « la version corrigée » de 604 489 $ : les deux ne mesurent pas
// forcément la même chose — périmètre de wallets, fenêtre, définition de
// l'encaissement, tout cela reste à démontrer. Substituer sans cette
// démonstration remplacerait une affirmation non soutenue par une autre.
//
// Il ne reconstruit rien non plus. Un chiffre qu'on ne sait pas refaire ne se
// répare pas en le recalculant autrement.
//
//     RETIRER N'EST PAS CORRIGER · ABSENCE N'EST PAS ZÉRO
//
// La doctrine est celle de `proceedsGate` : on rend `null`, jamais `0`. Zéro
// affirmerait « cette personne n'a rien encaissé ». Le retrait dit seulement
// « nous ne publions pas ce chiffre ».
//
// ─── Portée : contenu, pas archive ─────────────────────────────────────────
//
// Les données restent en base et dans l'historique git. Elles cessent d'être
// des AFFIRMATIONS PUBLIQUES ACTIVES. `src/lib/plainte/` (voie pénale,
// admin-only) n'est pas touché : c'est une pièce d'instruction, pas une
// publication.

/** Un montant retiré, avec l'adresse qui le portait et le motif. */
export interface ContainedClaim {
  readonly subject: string;
  readonly address: string;
  /** Le montant retiré, conservé ICI pour que le retrait soit auditable. */
  readonly withdrawnUsd: number;
  /** `false` = le régime de publication BUILD 8 refuse cette adresse. */
  readonly isPubliclyUsable: boolean;
  readonly measuredProceedsEvents: number;
}

/**
 * Les quatre affirmations retirées, telles que mesurées le 2026-09-07.
 *
 * Cette liste est un CONSTAT DATÉ, pas un gate dynamique. Le gate dynamique
 * — interroger `isPubliclyUsable` au rendu — suppose de rendre le builder de
 * preset asynchrone, ce qui touche des routes gelées. Hors périmètre d'un
 * containment ; il revient au chantier CaseFile.
 */
export const CONTAINED_BOTIFY_CLAIMS: readonly ContainedClaim[] = [
  { subject: "EduRio", address: "GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66",
    withdrawnUsd: 347_237, isPubliclyUsable: false, measuredProceedsEvents: 0 },
  { subject: "MoneyLord", address: "7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ",
    withdrawnUsd: 85_484, isPubliclyUsable: false, measuredProceedsEvents: 0 },
  { subject: "ElonTrades", address: "BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX",
    withdrawnUsd: 53_313, isPubliclyUsable: false, measuredProceedsEvents: 0 },
  { subject: "GordonGekko", address: "0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41",
    withdrawnUsd: 40_627, isPubliclyUsable: true, measuredProceedsEvents: 0 },
];

/** Les agrégats du preset, retirés au même titre. */
export const CONTAINED_BOTIFY_AGGREGATES = {
  cashoutsUsd: 604_489,
  kolCount: 28,
  eventCount: 295,
} as const;

/** Les adresses qu'aucune sortie nominative de CaseFile ne doit porter. */
export const NON_PUBLISHABLE_ADDRESSES: ReadonlySet<string> = new Set(
  CONTAINED_BOTIFY_CLAIMS.filter((c) => !c.isPubliclyUsable).map((c) => c.address.toLowerCase()),
);

/** La mention qui remplace un chiffre retiré. Jamais un nombre. */
export const WITHDRAWN_NOTICE =
  "montant retiré de la publication — non reproductible depuis l'autorité produit";

export class ContainedClaimLeakError extends Error {
  constructor(where: string, found: string) {
    super(
      `[containment] sortie refusée (${where}) : « ${found} » est une affirmation ` +
        "retirée de la publication. Elle n'est adossée à aucune ligne de l'autorité " +
        "produit, et ne doit pas reparaître — ni telle quelle, ni recalculée.",
    );
    this.name = "ContainedClaimLeakError";
  }
}

/** Toutes les formes textuelles d'un montant retiré : `347237`, `347 237`… */
function montantFormes(n: number): string[] {
  const brut = String(n);
  return [
    brut,
    brut.replace(/\B(?=(\d{3})+(?!\d))/g, " "),
    brut.replace(/\B(?=(\d{3})+(?!\d))/g, " "),
    brut.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    brut.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
  ];
}

const FORMES_RETIREES: readonly string[] = [
  ...CONTAINED_BOTIFY_CLAIMS.flatMap((c) => montantFormes(c.withdrawnUsd)),
  ...montantFormes(CONTAINED_BOTIFY_AGGREGATES.cashoutsUsd),
];

/**
 * LE garde de sortie. Fail-closed : il lève plutôt que de nettoyer.
 *
 * Nettoyer silencieusement laisserait croire que la sortie est saine alors
 * qu'une source amont continue de produire le chiffre. Lever fait apparaître
 * la source — c'est le comportement voulu.
 */
export function assertNoContainedClaim(text: string | null | undefined, where: string): void {
  if (!text) return;
  for (const forme of FORMES_RETIREES) {
    if (text.includes(forme)) throw new ContainedClaimLeakError(where, forme);
  }
}

/** Vraie si cette adresse ne peut pas sortir nominativement. */
export function isAddressWithheld(address: string | null | undefined): boolean {
  return NON_PUBLISHABLE_ADDRESSES.has((address ?? "").trim().toLowerCase());
}

/**
 * Filtre une liste d'entrées nominatives portant une adresse.
 *
 * Retire les entrées dont l'adresse est non publiable, et vérifie que ce qui
 * reste ne porte aucun montant retiré.
 */
export function withholdNonPublishable<T extends { address?: string; role?: string }>(
  entries: readonly T[],
  where: string,
): T[] {
  const gardees = entries.filter((e) => !isAddressWithheld(e.address));
  for (const e of gardees) assertNoContainedClaim(e.role, `${where} → ${e.address ?? "?"}`);
  return gardees;
}
