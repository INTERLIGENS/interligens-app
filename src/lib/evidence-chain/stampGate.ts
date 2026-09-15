/**
 * LE GATE D'HORODATAGE — l'ordre des opérations, et il n'est pas négociable.
 *
 *   1. relire les octets persistés
 *   2. recalculer le SHA-256 DEPUIS CES OCTETS
 *   3. confronter au digest attendu
 *   4. refuser AVANT tout appel TSA si quoi que ce soit cloche
 *   5. ne soumettre QUE le hash recalculé
 *
 * POURQUOI CE FICHIER EXISTE SÉPARÉMENT DU SCRIPT
 * -----------------------------------------------
 * Tant que la séquence vivait dans `stamp-pending.ts`, la seule façon de
 * l'éprouver était de lancer le job — donc de toucher la production et une
 * autorité tierce. Les DEUX capacités sont désormais INJECTÉES : la relecture
 * et l'horodatage. Le gate peut être mis en défaut sans un octet de réseau,
 * et l'espion sur `timestamp` prouve la seule chose qui compte vraiment —
 * QU'AUCUN APPEL N'EST ÉMIS quand la relecture refuse.
 *
 * Le script, lui, ne décide plus rien : il câble les vraies capacités.
 */
import {
  readbackDigest,
  type ReadObjectFn,
  type ReadbackRefusalKind,
} from "./readback";

/** Ce que le job sait d'une pièce en attente. Trois colonnes, pas une de plus. */
export interface PendingEvidenceRow {
  readonly id: string;
  /** L'ATTENTE du registre. Jamais soumise telle quelle à une TSA. */
  readonly sha256: string;
  readonly r2Key: string | null;
}

/** Ce qu'une autorité d'horodatage rend. Volontairement structurel. */
export interface RoutedStamp {
  readonly tsaUsed: string;
  readonly result: {
    readonly token: Buffer;
    readonly genTime: Date;
    readonly provider: string;
    readonly certChainPem: string;
  };
}

/**
 * La capacité d'horodatage, injectée. Elle ne reçoit QU'UN HASH — jamais la
 * ligne — pour qu'il soit structurellement impossible de lui faire retrouver
 * la colonne toute seule.
 */
export type TimestampFn = (sha256hex: string) => Promise<RoutedStamp | null>;

export type StampOutcome =
  | {
      readonly status: "stamped";
      /** Le hash RÉELLEMENT soumis. Rapporté pour être vérifiable. */
      readonly submittedSha256: string;
      readonly byteSize: number;
      readonly tsaUsed: string;
      readonly provider: string;
      readonly token: Buffer;
      readonly genTime: Date;
      readonly certChainPem: string;
    }
  | { readonly status: "refused"; readonly kind: ReadbackRefusalKind; readonly detail: string }
  | { readonly status: "no_tsa"; readonly detail: string };

export interface StampGateDeps {
  readonly readObject: ReadObjectFn;
  readonly timestamp: TimestampFn;
}

/**
 * Horodate UNE pièce, ou refuse en le nommant. Aucune écriture : l'appelant
 * persiste ce qui revient. Le gate décide, il ne range pas.
 */
export async function stampOne(
  row: PendingEvidenceRow,
  deps: StampGateDeps,
): Promise<StampOutcome> {
  // ── ÉTAPE 1-3 — LES OCTETS, AVANT TOUT ─────────────────────────────────
  const back = await readbackDigest({
    r2Key: row.r2Key,
    expectedSha256: row.sha256,
    readObject: deps.readObject,
  });

  // ── ÉTAPE 4 — FAIL CLOSED. Le `return` est AVANT `deps.timestamp`, et
  //    c'est tout le fichier. Un jeton n'est jamais demandé sur un doute.
  if (!back.ok) {
    return { status: "refused", kind: back.kind, detail: back.detail };
  }

  // ── ÉTAPE 5 — `back.sha256`, PAS `row.sha256`. Les octets sont l'autorité.
  const routed = await deps.timestamp(back.sha256);
  if (!routed) {
    return {
      status: "no_tsa",
      detail: "aucune autorité d'horodatage n'a répondu — la pièce reste en attente",
    };
  }

  return {
    status: "stamped",
    submittedSha256: back.sha256,
    byteSize: back.byteSize,
    tsaUsed: routed.tsaUsed,
    provider: routed.result.provider,
    token: routed.result.token,
    genTime: routed.result.genTime,
    certChainPem: routed.result.certChainPem,
  };
}
