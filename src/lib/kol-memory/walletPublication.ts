// ─── BUILD 8 / P1 — LA PUBLIABILITÉ D'UNE ADRESSE ATTRIBUÉE ────────────────
//
// ██  Une adresse attribuée à une personne nommée ne sort que si son          ██
// ██  attribution l'autorise. Le point de filtrage est ICI, et nulle part.    ██
//
// ─── Ce qu'il ferme ────────────────────────────────────────────────────────
//
// `/api/kol/[handle]` rend ses wallets en `select: { kolWallets: true }`,
// SANS aucun `where`. Mesuré sur ep-square-band le 2026-09-07, sur les seuls
// profils publiés :
//
//     229 wallets servis
//      65 dont `isPubliclyUsable = false`
//      51 dont `attributionStatus <> 'confirmed'`
//      21 des 32 profils publiés concernés
//
// `isPubliclyUsable` est écrit par 5 seeders — qui posent délibérément `false`
// sur tout ce qui n'est pas validé — et lu par UN SEUL site dans tout le
// produit : un compteur dans `explorerItems.ts`. Le drapeau existait, il
// portait la bonne décision, et rien ne s'en servait.
//
// ─── Pourquoi `isPubliclyUsable` et pas `attributionStatus` ────────────────
//
// Les deux axes ne coïncident pas : 76 lignes sont `confirmed` mais NON
// publiables, 5 sont `review` mais publiables. Ce sont deux questions
// distinctes — « avons-nous revu cette attribution ? » et « acceptons-nous de
// la publier ? » — et le produit a déjà une colonne par question.
//
// La publication se décide sur la colonne de publication. Fusionner les deux
// axes ici inventerait une troisième règle que personne n'a ratifiée, et
// retirerait 51 lignes de plus au nom d'un critère qui n'est pas celui-là.
//
// ─── FAIL-CLOSED ───────────────────────────────────────────────────────────
//
// `isWalletPublishable` rend `true` UNIQUEMENT sur le booléen `true`.
// `undefined` (la colonne n'a pas été sélectionnée dans la requête Prisma),
// `null`, `0`, `"true"` : tout cela est traité comme NON PUBLIABLE.
//
// Le mode de défaillance probable est l'oubli — une nouvelle surface qui lit
// des wallets sans sélectionner le drapeau. En fail-open, l'oubli republie
// silencieusement les 65. En fail-closed, il fait disparaître des adresses qui
// auraient pu rester : c'est visible, ça se corrige, et ça ne publie rien.
//
//     UNKNOWN ≠ SAFE · NO DATA ≠ NO RISK
//
// ─── Pourquoi ce module n'appelle PAS `decorate()` ─────────────────────────
//
// `KolWallet` est en régime ROW : sa nature se lit dans `rowNature`. Mesuré :
// 200 des 229 wallets servis n'en portent aucune. Passer ces lectures par
// `decorate()` les ferait toutes lever — et supprimerait 200 lignes de plus,
// au nom d'une dette historique.
//
// C'est précisément ce que `src/lib/data-nature/writeGuard.ts` interdit, dans
// son en-tête : « Poser requireNature sur un chemin de LECTURE transformerait
// S6 en panne générale et ferait disparaître la dette au lieu de la montrer. »
//
// La nature est donc ATTACHÉE à la sortie, jamais utilisée pour la supprimer.
// Une ligne non classée sort en portant `UNCLASSIFIED` en toutes lettres :
// l'ignorance devient visible et coûteuse, ce qui est exactement son rôle.

import type { Prisma } from "@prisma/client";
import { UNCLASSIFIED, isNatureValue, type NatureValue } from "@/lib/data-nature/nature";

/**
 * LE filtre Prisma. Toute lecture de wallets destinée à une sortie nominative
 * l'utilise, ou n'est pas une lecture publiable.
 *
 * `status: "active"` reprend le filtre que `canonical.ts` applique déjà pour
 * compter les wallets d'un profil : une lecture publique qui servirait des
 * lignes inactives contredirait le compteur affiché à côté d'elle.
 */
export const PUBLISHABLE_WALLET_FILTER = {
  status: "active",
  isPubliclyUsable: true,
} as const satisfies Prisma.KolWalletWhereInput;

/** Colonnes sans lesquelles la décision ne peut pas être prise. Fail-closed :
 *  les omettre ne rend pas la ligne publiable, il la rend invisible. */
export const WALLET_PUBLICATION_SELECT = {
  status: true,
  isPubliclyUsable: true,
  rowNature: true,
} as const;

export class WalletNotPublishableError extends Error {
  constructor(where: string, reason: string) {
    super(
      `[kol-memory] publication de wallet refusée (${where}) : ${reason}. ` +
        "Une adresse attribuée à une personne nommée ne sort que si son " +
        "attribution l'autorise.",
    );
    this.name = "WalletNotPublishableError";
  }
}

export interface WalletPublicationCarrier {
  readonly status?: unknown;
  readonly isPubliclyUsable?: unknown;
  readonly rowNature?: unknown;
}

/**
 * Le prédicat. `true` sur le seul booléen `true`, et sur rien d'autre.
 *
 * Volontairement strict sur le TYPE, pas seulement sur la valeur : `"true"`,
 * `1` et `"1"` sont refusés. Une colonne qui remonterait en chaîne après un
 * changement de driver ne doit pas ouvrir la publication en silence.
 */
export function isWalletPublishable(row: WalletPublicationCarrier): boolean {
  if (row.isPubliclyUsable !== true) return false;
  if (row.status !== "active") return false;
  return true;
}

/** La raison du refus, en clair. Sert au message d'erreur et aux tests. */
export function publicationRefusalReason(row: WalletPublicationCarrier): string | null {
  if (row.isPubliclyUsable === undefined) {
    return "isPubliclyUsable absent de la requête (colonne non sélectionnée)";
  }
  if (row.isPubliclyUsable !== true) {
    return `isPubliclyUsable = ${JSON.stringify(row.isPubliclyUsable)}`;
  }
  if (row.status === undefined) {
    return "status absent de la requête (colonne non sélectionnée)";
  }
  if (row.status !== "active") {
    return `status = ${JSON.stringify(row.status)}`;
  }
  return null;
}

/** Dernière barrière avant l'envoi. À appeler dans le sérialiseur. */
export function assertWalletPublishable(row: WalletPublicationCarrier, where: string): void {
  const reason = publicationRefusalReason(row);
  if (reason !== null) throw new WalletNotPublishableError(where, reason);
}

/**
 * La nature portée par la ligne, `UNCLASSIFIED` compris et assumé.
 *
 * N'utilise PAS `natureForRow` : celui-ci consulte le registre et rendrait la
 * même valeur, mais il PEUT être durci plus tard pour lever. Ici on veut
 * explicitement une lecture qui n'échoue jamais — voir l'en-tête.
 */
export function walletNature(row: WalletPublicationCarrier): NatureValue {
  return isNatureValue(row.rowNature) ? row.rowNature : UNCLASSIFIED;
}

export type PublishableWallet<T> = T & { readonly natureValue: NatureValue };

/**
 * Le point de passage des listes. Filtre, puis étiquette.
 *
 * L'ordre compte : on ne calcule aucune nature sur une ligne qu'on ne publiera
 * pas, et on ne publie aucune ligne sans dire ce qu'elle affirme.
 */
export function selectPublishableWallets<T extends WalletPublicationCarrier>(
  rows: readonly T[],
): PublishableWallet<T>[] {
  return rows
    .filter(isWalletPublishable)
    .map((row) => ({ ...row, natureValue: walletNature(row) }));
}
