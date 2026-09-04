// --- F0.3 — OBSERVATION « SOURCE COMMUNE » --------------------------------
//
// PURE. Une seule question, et elle est factuelle :
//
//   « Dans les arêtes FOURNIES, existe-t-il une adresse qui a envoyé du SOL à
//     au moins deux des wallets donnés ? »
//
// ██ CE QUE CE MODULE NE DIT JAMAIS ██
//
// Il ne dit pas « ces wallets sont coordonnés ». Il ne dit pas « ce n'est pas
// un scam ». Il ne produit ni label, ni score, ni seuil de suspicion. Un
// bailleur commun peut être un exchange, un pont, un routeur, un ami. Trancher
// demanderait une INFERENCE — produite ailleurs, sur une base traçable, et
// jamais par le module qui constate.
//
// ─── L'ABSENCE EST `NOT_OBSERVED`, ET C'EST TOUT ─────────────────────────
//
// Ne rien observer n'établit rien. Les arêtes fournies sont un ÉCHANTILLON :
// elles viennent d'une collecte bornée, sur une fenêtre, sur un budget. Un
// bailleur commun peut exister entièrement hors de cet échantillon.
//
// Rendre « pas de source commune observée » comme « pas de coordination »
// convertirait une limite de collecte en fait sur le monde — l'erreur exacte
// que SHILL-M2 interdit. Le type impose donc `NOT_OBSERVED` avec son motif :
// il n'existe aucune valeur de retour signifiant « rien ne se passe ».
//
// MULTI-HOP EXCLU : seules les arêtes DIRECTES comptent. Un chemin en deux
// sauts est une reconstruction, pas une observation, et il appartient à une
// phase ultérieure.

import type { FundingEdge } from "./types";

export const SHARED_FUNDER_RULE_VERSION = "funding-graph/shared-funder@v1";

/** Combien de wallets du sujet un bailleur doit toucher pour être « commun ». */
export const MIN_SHARED_RECIPIENTS = 2;

/** La preuve qu'un bailleur a financé un wallet donné. Opposable sur la chaîne. */
export interface FunderLink {
  wallet: string;
  txSignature: string;
  blockTimeSeconds: number;
  amountLamports: number;
}

export interface SharedFunder {
  funder: string;
  /** Les wallets du sujet que ce bailleur a touchés, dédupliqués. */
  recipients: string[];
  /** Une preuve par arête retenue — jamais agrégée. */
  links: FunderLink[];
  /**
   * Le bailleur fait-il lui-même partie des wallets interrogés ? Un wallet qui
   * en finance deux autres est un fait différent d'un tiers qui les finance
   * tous les deux, et l'appelant doit pouvoir les distinguer.
   */
  funderIsAmongSubjects: boolean;
}

export type SharedFunderObservation =
  | {
      observed: true;
      ruleVersion: string;
      subjects: string[];
      funders: SharedFunder[];
      edgesConsidered: number;
    }
  | {
      observed: false;
      /** ██ JAMAIS « pas de coordination ». ██ */
      diagnostic: "NOT_OBSERVED";
      ruleVersion: string;
      subjects: string[];
      /** Pourquoi rien n'a été observé — une limite, pas une conclusion. */
      reason:
        | "no_edges_provided"
        | "fewer_than_two_subjects"
        | "no_funder_reaching_two_subjects";
      edgesConsidered: number;
    };

/**
 * Cherche un bailleur commun DIRECT parmi les arêtes fournies.
 *
 * Ne collecte rien : si l'appelant fournit peu d'arêtes, l'observation portera
 * sur peu d'arêtes, et `edgesConsidered` le dit.
 */
export function sharedFunder(
  wallets: readonly string[],
  edges: readonly FundingEdge[],
): SharedFunderObservation {
  const subjects = [...new Set(wallets.filter((w) => !!w))];
  const base = { ruleVersion: SHARED_FUNDER_RULE_VERSION, subjects, edgesConsidered: edges.length };

  if (subjects.length < MIN_SHARED_RECIPIENTS) {
    return { observed: false, diagnostic: "NOT_OBSERVED", reason: "fewer_than_two_subjects", ...base };
  }
  if (edges.length === 0) {
    return { observed: false, diagnostic: "NOT_OBSERVED", reason: "no_edges_provided", ...base };
  }

  const subjectSet = new Set(subjects);
  const byFunder = new Map<string, FunderLink[]>();

  for (const e of edges) {
    // Le DESTINATAIRE doit être un sujet ; la direction n'est jamais relue à
    // l'envers. Un wallet qui ENVOIE du SOL au bailleur n'est pas financé par lui.
    if (!subjectSet.has(e.toWallet)) continue;
    if (e.fromWallet === e.toWallet) continue; // ceinture : buildFundingEdges l'exclut déjà
    const list = byFunder.get(e.fromWallet) ?? [];
    list.push({
      wallet: e.toWallet,
      txSignature: e.txSignature,
      blockTimeSeconds: e.blockTimeSeconds,
      amountLamports: e.amountLamports,
    });
    byFunder.set(e.fromWallet, list);
  }

  const funders: SharedFunder[] = [];
  for (const [funder, links] of byFunder) {
    const recipients = [...new Set(links.map((l) => l.wallet))];
    if (recipients.length < MIN_SHARED_RECIPIENTS) continue;
    funders.push({
      funder,
      recipients,
      links,
      funderIsAmongSubjects: subjectSet.has(funder),
    });
  }

  if (funders.length === 0) {
    return {
      observed: false,
      diagnostic: "NOT_OBSERVED",
      reason: "no_funder_reaching_two_subjects",
      ...base,
    };
  }

  funders.sort(
    (a, b) => b.recipients.length - a.recipients.length || a.funder.localeCompare(b.funder),
  );
  return { observed: true, funders, ...base };
}
