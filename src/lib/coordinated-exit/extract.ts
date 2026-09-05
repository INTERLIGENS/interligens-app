// --- BUILD 6 / F0 / G1 — L'EXTRACTION -------------------------------------
//
// PURE. Aucun réseau, aucune base. On lui donne des transactions DÉJÀ
// collectées et un sujet ; elle rend les actes de sortie qu'elles DÉMONTRENT.
//
// ─── LA RÈGLE, ET POURQUOI ELLE EST STRUCTURELLE ─────────────────────────
//
// Dans une transaction, pour un sujet et un mint donnés :
//
//   le mint SORT du wallet du sujet        condition nécessaire d'une sortie
//   + un AUTRE actif ENTRE chez le sujet   ⇒ SELL
//   + rien n'entre                         ⇒ OUTGOING_TRANSFER
//
// L'atomicité fait la preuve : dans une seule transaction, sortir un token et
// recevoir autre chose EST un échange. Aucune sémantique n'est devinée, aucun
// nom de programme n'est interprété.
//
// ─── CE QUI EST EXCLU, ET COMPTÉ ─────────────────────────────────────────
//
// Un acte dont le type ne peut pas être PROUVÉ n'est pas classé « au mieux » :
// il est exclu, et son motif est compté. Un événement mal typé se propagerait
// en aval sans que personne ne puisse le distinguer d'un événement démontré.
//
//   missing_signature / missing_block_time   pas de preuve opposable
//   no_outgoing_amount                       le mint ne sort pas, ou sort à 0
//   same_mint_in_and_out                     le sujet envoie ET reçoit le mint
//                                            dans la même tx : le sens net du
//                                            mouvement n'est pas démontrable
//                                            (routage, split, rééquilibrage)
//
// ██ amount = 0 N'EST PAS UN ÉVÉNEMENT, et ce n'est pas un plancher. ██
// F0 ne porte AUCUN seuil de matérialité : toute sortie réelle est conservée,
// aussi petite soit-elle. Décider qu'un montant est négligeable est une règle
// versionnée, et elle n'est pas ici.

import {
  COORDINATED_EXIT_EXTRACT_VERSION,
  EXIT_EVENT_NATURE,
  OBSERVED_COUNTERPARTY_MEANING,
  type ExitCandidateTx,
  type ExitEvent,
} from "./types";

// ═══ LE GARDE — PAR PROVENANCE, JAMAIS PAR MONTANT ════════════════════════
//
// ██ AUCUNE CONSTANTE DE LOYER N'APPARAÎT DANS CE FICHIER. ██
//
// Distinguer un remboursement de loyer d'un paiement par son MONTANT aurait
// été une heuristique : le loyer d'un compte dépend de sa taille, il change
// avec les paramètres du protocole, et n'importe quel paiement peut tomber sur
// la même valeur. Un seuil en lamports aurait fabriqué des faux positifs ET
// des faux négatifs, sans qu'aucun des deux ne se voie.
//
// La provenance, elle, se démontre :
//
//   1. LE LIEN D'ÉCHANGE. Une contrepartie ne compte que si elle vient d'un
//      compte QUI A REÇU LE MINT DU SUJET dans la même transaction. C'est ce
//      qui fait l'échange : ce qui sort revient transformé, du même acteur.
//      Mesuré le 2026-09-05 sur VINE : 453 échanges sur 453 le vérifient.
//
//   2. LE LOYER. Du SOL qui sort d'un COMPTE DE TOKEN est la récupération du
//      loyer de ce compte au moment où il se ferme. Un compte de token n'est
//      pas une contrepartie commerciale, c'est un contenant.
//
// ██ FAIL-CLOSED. ██ Une contrepartie qui ne satisfait pas 1, ou qui tombe
// sous 2, n'est pas « probablement une vente » : elle n'est pas démontrée,
// donc elle n'est pas affirmée. L'événement redevient un OUTGOING_TRANSFER, et
// le motif du refus est écrit dans sa provenance.
//
// Sans `tokenBalanceChanges`, le garde ne s'assouplit pas : il ne peut pas
// reconnaître les comptes de token, donc il ne peut écarter aucun loyer — mais
// la règle 1 continue de s'appliquer, et elle est la plus contraignante.

export type ExitExclusionReason =
  | "missing_signature"
  | "missing_block_time"
  | "no_outgoing_amount"
  | "same_mint_in_and_out";

export interface ExtractExitEventsResult {
  events: ExitEvent[];
  transactionsSeen: number;
  /** Chaque refus sous son motif. Un refus silencieux est un refus invisible. */
  excluded: Record<ExitExclusionReason, number>;
}

export interface ExtractExitEventsInput {
  subjectWallet: string;
  mint: string;
  txs: readonly ExitCandidateTx[];
}

/** Une source nommée `UNKNOWN` ne nomme rien : elle vaut absence. */
function usableVenue(source: string | undefined): string | null {
  if (!source) return null;
  const s = source.trim();
  if (!s || s.toUpperCase() === "UNKNOWN") return null;
  return s;
}

export function extractExitEvents(input: ExtractExitEventsInput): ExtractExitEventsResult {
  const { subjectWallet: subject, mint } = input;
  const events: ExitEvent[] = [];
  const excluded: Record<ExitExclusionReason, number> = {
    missing_signature: 0,
    missing_block_time: 0,
    no_outgoing_amount: 0,
    same_mint_in_and_out: 0,
  };

  for (const tx of input.txs) {
    const tts = tx.tokenTransfers ?? [];
    const nts = tx.nativeTransfers ?? [];

    // Le mint qui SORT du sujet, dans cette transaction.
    const out = tts.filter(
      (t) => t.mint === mint && t.fromUserAccount === subject && t.tokenAmount > 0,
    );
    if (out.length === 0) { excluded.no_outgoing_amount++; continue; }

    // Le MÊME mint qui rentre : le sens net n'est pas démontrable.
    const sameMintIn = tts.some(
      (t) => t.mint === mint && t.toUserAccount === subject && t.tokenAmount > 0,
    );
    if (sameMintIn) { excluded.same_mint_in_and_out++; continue; }

    // La preuve opposable d'abord — sans elle, rien n'est produit.
    if (!tx.signature) { excluded.missing_signature++; continue; }
    if (typeof tx.timestamp !== "number" || !Number.isFinite(tx.timestamp)) {
      excluded.missing_block_time++; continue;
    }

    const amountRaw = out.reduce((s, t) => s + t.tokenAmount, 0);
    if (!(amountRaw > 0)) { excluded.no_outgoing_amount++; continue; }

    // La destination : un seul destinataire, ou rien. Plusieurs ⇒ en désigner
    // un serait choisir, pas constater.
    const recipients = [...new Set(out.map((t) => t.toUserAccount).filter(Boolean))] as string[];
    const destination = recipients.length === 1 ? recipients[0] : null;

    // ── LE GARDE ──────────────────────────────────────────────────────────
    // Les comptes qui ont REÇU le mint du sujet : les seules contreparties
    // possibles d'un échange démontré.
    const mintRecipients = new Set(recipients);
    // Les comptes de TOKEN de la transaction. Du SOL qui en sort est un loyer.
    const tokenAccounts = new Set(
      (tx.tokenBalanceChanges ?? [])
        .map((c) => c.tokenAccount)
        .filter((a): a is string => !!a),
    );

    const anyTokenIn = tts.find(
      (t) => t.mint !== mint && t.toUserAccount === subject && t.tokenAmount > 0,
    );
    const anyNativeIn = nts.find((n) => n.toUserAccount === subject && n.amount > 0);

    let asset: string | null = null;
    let amountIn: number | null = null;
    let rejected: "rent" | "unlinked" | null = null;

    // Un actif TOKEN venu d'un compte ayant reçu le mint : échange démontré.
    const linkedToken = tts.find(
      (t) =>
        t.mint !== mint &&
        t.toUserAccount === subject &&
        t.tokenAmount > 0 &&
        !!t.fromUserAccount &&
        mintRecipients.has(t.fromUserAccount),
    );
    // Idem pour du SOL — et le compte source ne doit pas être un compte de
    // token qui se ferme.
    const linkedNative = nts.find(
      (n) =>
        n.toUserAccount === subject &&
        n.amount > 0 &&
        !!n.fromUserAccount &&
        mintRecipients.has(n.fromUserAccount) &&
        !tokenAccounts.has(n.fromUserAccount),
    );

    if (linkedToken) {
      asset = linkedToken.mint;
      amountIn = linkedToken.tokenAmount;
    } else if (linkedNative) {
      asset = "native";
      amountIn = linkedNative.amount;
    } else if (anyNativeIn && anyNativeIn.fromUserAccount && tokenAccounts.has(anyNativeIn.fromUserAccount)) {
      // Un actif est bien rentré, mais d'un compte de token qui se ferme.
      rejected = "rent";
    } else if (anyTokenIn || anyNativeIn) {
      // Un actif est rentré, d'une source qui n'a pas reçu le mint. Non démontré.
      rejected = "unlinked";
    }

    // ██ SELL SEULEMENT SUR CONTREPARTIE DÉMONTRÉE PAR SA PROVENANCE. ██
    const type = asset !== null ? "SELL" : "OUTGOING_TRANSFER";

    events.push({
      subjectWallet: subject,
      mint,
      type,
      // bigint : la quantité est une preuve, et un flottant la dégraderait.
      // Math.trunc plutôt qu'un arrondi : on ne fabrique pas d'unité.
      amount: BigInt(Math.trunc(amountRaw)),
      // Le block time, TEL QUEL. UTC. Aucune compensation de fuseau — celle de
      // B4 avait décalé de 2 h des instants qui étaient justes.
      blockTimeSeconds: tx.timestamp,
      txSignature: tx.signature,
      destination,
      venue: usableVenue(tx.source),
      observedCounterpartyAsset: asset,
      observedCounterpartyAmount: amountIn,
      observedCounterpartyMeaning: asset !== null ? OBSERVED_COUNTERPARTY_MEANING : null,
      rowNature: EXIT_EVENT_NATURE,
      evidenceProvenance: {
        rule: COORDINATED_EXIT_EXTRACT_VERSION,
        basis:
          asset !== null
            ? "swap_counter_asset_same_tx"
            : rejected === "rent"
              ? "counterparty_rejected_rent_recovery"
              : rejected === "unlinked"
                ? "counterparty_rejected_provenance_undemonstrated"
                : "token_leaves_wallet_no_counter_asset",
        source: usableVenue(tx.source),
        // Le type de l'indexeur est RAPPORTÉ, jamais utilisé pour trancher.
        indexerType: tx.type ?? null,
      },
    });
  }

  // Une quantité tronquée à 0 n'est pas un événement (et n'est pas un seuil).
  const kept = events.filter((e) => e.amount > 0n);
  excluded.no_outgoing_amount += events.length - kept.length;

  return { events: kept, transactionsSeen: input.txs.length, excluded };
}
