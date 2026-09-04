// --- F0.2 — EXTRACTION : TRANSFERTS → ARÊTES ------------------------------
//
// PURE. Aucun réseau, aucune base, aucun état. On lui donne des transactions,
// elle rend des arêtes.
//
// ─── LES QUATRE REFUS, ET POURQUOI CHACUN EST UN REFUS ───────────────────
//
// Un transfert écarté ne produit PAS d'arête dégradée : il ne produit rien.
// Une arête approximative se propagerait dans tout ce qui lit le graphe, et
// personne en aval ne pourrait plus la distinguer d'une arête constatée.
//
//   from === to      un compte ne se finance pas lui-même. L'auto-arête
//                    ferait de tout wallet actif son propre bailleur, et
//                    « source commune » en hériterait mécaniquement.
//   from ou to vide  sans les deux extrémités, il n'y a pas d'arête ; en
//                    inventer une extrémité serait fabriquer le fait.
//   montant ≤ 0      un transfert nul ou négatif n'établit aucun flux.
//   non fini         NaN/Infinity ne sont pas des montants.
//
// AUCUNE AGRÉGATION, AUCUNE DÉDUPLICATION. Deux transferts entre les mêmes
// adresses sont DEUX faits, chacun avec sa signature. Les fondre produirait un
// montant qu'aucune transaction ne porte — et ferait perdre la preuve
// opposable de chacun.
//
// L'ORDRE D'ENTRÉE EST PRÉSERVÉ : la fonction est déterministe, et deux appels
// sur la même entrée rendent la même sortie dans le même ordre.

import {
  FUNDING_EDGE_NATURE,
  type FundingEdge,
  type TransferBearingTx,
} from "./types";

export interface BuildEdgesResult {
  edges: FundingEdge[];
  /** Ce qui a été écarté, par motif. Un refus silencieux est un refus invisible. */
  skipped: {
    selfTransfer: number;
    missingEndpoint: number;
    nonPositiveAmount: number;
    nonFiniteAmount: number;
  };
  /** Transferts natifs vus en entrée — le dénominateur des refus. */
  transfersSeen: number;
}

/**
 * Construit les arêtes de financement à partir de transactions.
 *
 * N'INTERPRÈTE RIEN. Ne classe pas, ne score pas, ne regroupe pas. Le seul
 * jugement porté est « ce transfert est-il un fait exploitable », et chaque
 * réponse négative est comptée sous son motif.
 */
export function buildFundingEdges(
  txs: readonly TransferBearingTx[],
): BuildEdgesResult {
  const edges: FundingEdge[] = [];
  const skipped = {
    selfTransfer: 0,
    missingEndpoint: 0,
    nonPositiveAmount: 0,
    nonFiniteAmount: 0,
  };
  let transfersSeen = 0;

  for (const tx of txs) {
    for (const t of tx.nativeTransfers ?? []) {
      transfersSeen++;

      const from = t.fromUserAccount;
      const to = t.toUserAccount;
      if (!from || !to) {
        skipped.missingEndpoint++;
        continue;
      }
      if (from === to) {
        skipped.selfTransfer++;
        continue;
      }
      if (!Number.isFinite(t.amount)) {
        skipped.nonFiniteAmount++;
        continue;
      }
      if (!(t.amount > 0)) {
        skipped.nonPositiveAmount++;
        continue;
      }

      edges.push({
        // La DIRECTION est recopiée telle quelle. L'inverser transformerait le
        // bailleur en bénéficiaire, ce qu'aucune relecture ne rattraperait.
        fromWallet: from,
        toWallet: to,
        asset: "SOL",
        amountLamports: t.amount,
        txSignature: tx.signature,
        blockTimeSeconds: tx.timestamp,
        rowNature: FUNDING_EDGE_NATURE,
      });
    }
  }

  return { edges, skipped, transfersSeen };
}
