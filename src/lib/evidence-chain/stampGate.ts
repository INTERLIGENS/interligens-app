/**
 * LE GATE D'HORODATAGE — l'ordre des opérations, et il n'est pas négociable.
 *
 *   0. RÉSOUDRE LE COMPARTIMENT de la pièce  ← CC-OFFLINE-189
 *   1. relire les octets persistés, DANS CE COMPARTIMENT
 *   2. recalculer le SHA-256 DEPUIS CES OCTETS
 *   3. confronter au digest attendu
 *   4. refuser AVANT tout appel TSA si quoi que ce soit cloche
 *   5. ne soumettre QUE le hash recalculé
 *
 * L'ÉTAPE 0, ET POURQUOI ELLE EST 0 ET NON 1
 * ------------------------------------------
 *   « Evidentiary eligibility does not imply storage resolvability. An
 *     irreversible evidence operation requires both. »
 *
 * `tsaPendingUniverseSql` établit l'ÉLIGIBILITÉ PROBATOIRE — pas de jeton,
 * aucune disqualification. Il ne dit rien de l'endroit où sont les octets.
 * Relire avant d'avoir résolu, c'est chercher au hasard ; et ne rien trouver
 * en cherchant au mauvais endroit se rapporterait `object_absent`, c'est-à-dire
 * comme un FAIT sur la preuve. Ce n'en est pas un.
 *
 * ⚠️ La capacité de lecture N'EXISTE PAS avant la résolution : c'est la
 * résolution qui la REND. Le gate est donc structurellement incapable de lire
 * en premier — il n'y a rien à appeler. `readObject` n'est plus une dépendance
 * du gate, et c'est tout le correctif.
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
  READBACK_REFUSAL_KINDS,
  type ReadbackRefusalKind,
} from "./readback";
import type { ResolveStorageFn } from "./storageResolution";

/**
 * LE REFUS DE LOCALISATION. Une cause à lui seul, et JAMAIS `object_absent`.
 *
 * « Absent du nouveau compartiment » n'est pas « octets absents ». Confondre
 * les deux ferait porter à la PREUVE le défaut d'une CONFIGURATION — et, pire,
 * ferait croire qu'une pièce intacte a disparu.
 */
export const STORAGE_LOCATION_UNRESOLVED = "storage_location_unresolved" as const;

/** Les refus du gate : ceux de la relecture, plus celui de la localisation. */
export type StampRefusalKind = ReadbackRefusalKind | typeof STORAGE_LOCATION_UNRESOLVED;

export const STAMP_REFUSAL_KINDS: readonly StampRefusalKind[] = Object.freeze([
  STORAGE_LOCATION_UNRESOLVED,
  ...READBACK_REFUSAL_KINDS,
]);

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
  | { readonly status: "refused"; readonly kind: StampRefusalKind; readonly detail: string }
  | { readonly status: "no_tsa"; readonly detail: string };

export interface StampGateDeps {
  /**
   * LA RÉSOLUTION DE COMPARTIMENT. Elle rend la capacité de lecture, ou elle
   * refuse — il n'y a pas de `readObject` ici, et c'est délibéré : le gate ne
   * peut pas lire tant qu'il n'a pas résolu, parce qu'il n'a rien à appeler.
   */
  readonly resolveStorage: ResolveStorageFn;
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
  // ── ÉTAPE 0 — OÙ SONT LES OCTETS ? ─────────────────────────────────────
  //
  // Avant de lire, savoir OÙ lire. Une pièce éligible dont la localisation
  // n'est pas établie ne devient pas une pièce absente : elle devient une
  // pièce qu'on ne sait pas atteindre, et c'est une cause à elle seule.
  const lieu = await deps.resolveStorage(row);
  if (!lieu.ok) {
    return { status: "refused", kind: STORAGE_LOCATION_UNRESOLVED, detail: lieu.detail };
  }

  // ── ÉTAPE 1-3 — LES OCTETS, DANS LE COMPARTIMENT RÉSOLU ────────────────
  //
  // `lieu.readObject` est LIÉ au compartiment que la résolution a nommé. Il
  // n'existait pas avant elle, et aucune autre capacité de lecture n'est
  // disponible ici.
  const back = await readbackDigest({
    r2Key: row.r2Key,
    expectedSha256: row.sha256,
    readObject: lieu.readObject,
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
