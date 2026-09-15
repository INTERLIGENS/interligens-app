// ─── CC-OFFLINE-214 — L'ÉCRIVAIN DU REGISTRE DE LOCALISATION ───────────────
//
// ██  Celui qui a ÉCRIT les octets est le seul à savoir OÙ il les a écrits.  ██
// ██  Il le DÉCLARE. Il ne prétend pas l'avoir MESURÉ.                       ██
//
// ─── LE DÉFAUT QUE CE MODULE FERME ────────────────────────────────────────
//
// `evidence_storage_location_journal` est l'autorité de localisation — la
// réponse à « où vivent les octets de CETTE pièce ». Elle est LUE par
// `storageLocationJournal.ts` et consommée, pièce par pièce, par le chemin
// d'horodatage (`runtimeResolution` → `storageResolution` → `stampGate`).
//
// Mesuré le 2026-09-15 : elle n'avait AUCUN écrivain dans `src/`. Ses 31 lignes
// ont été posées par du SQL que `discrimination.ts` GÉNÈRE et qu'un humain colle
// dans l'éditeur Neon — un chemin correct pour un rattrapage historique, et
// inutilisable pour une pièce qui NAÎT. Conséquence exacte : une pièce
// nouvellement née, correctement archivée, était structurellement INHORODATABLE
// — sa localisation ne pouvait être établie par aucun chemin de production.
//
// ─── LES DEUX MODES, ET POURQUOI CE MODULE N'EN CONNAÎT QU'UN ─────────────
//
//   DECLARED_AT_WRITE   « j'ai écrit ces octets là, et je le déclare »
//                       L'autorité est celle de l'ÉCRITURE. Elle est disponible
//                       à l'instant du PUT, et à aucun autre.
//
//   VERIFIED_BY_HEAD    « j'ai INTERROGÉ les compartiments, l'objet est ici et
//                       mesurablement absent des concurrents gouvernés »
//                       L'autorité est celle d'une MESURE. Elle exige des
//                       requêtes réseau que ce module n'émet pas.
//
// ⛔ CE MODULE NE PEUT PAS ÉCRIRE `VERIFIED_BY_HEAD`. Pas « ne le fait pas » :
//    le littéral est dans le gabarit SQL, et les colonnes d'observation sont
//    écrites `NULL` en dur. Il n'y a aucune entrée par laquelle un appelant
//    pourrait demander l'autre mode — le type ne le porte pas, et le CHECK
//    `head_iff_observation` en base refuserait de toute façon un
//    VERIFIED_BY_HEAD sans observation.
//
//    C'est la même doctrine que `discrimination.ts` applique en sens inverse :
//
//      « Finding an evidence object in one compartment establishes presence
//        there; it establishes authoritative location only when competing
//        governed compartments have also been measurably excluded. »
//
//    Une déclaration d'écriture n'a pas exclu les concurrents — elle n'a pas
//    eu à le faire, parce qu'elle SAIT où elle a écrit. Les deux modes disent
//    des choses différentes, et le registre les garde distinctes exprès.
//
// ─── CE QU'IL NE PEUT PAS FAIRE, PAR CONSTRUCTION ─────────────────────────
//
//   · AUCUN UPDATE. AUCUN DELETE. AUCUN TRUNCATE. Pas « aucun n'est appelé » :
//     aucun n'est ÉCRIT. Une relocalisation est une NOUVELLE ligne. La table
//     est append-only par deux triggers ; ici c'est la FORME du module qui le
//     dit, et un témoin structurel le relit.
//   · AUCUN `now()` sur `declared_at`. L'instant vient de l'APPELANT, passe en
//     `$n`, et la relecture EXIGE l'égalité. `recorded_at` (DEFAULT now())
//     porte l'horloge de la base, et c'est elle seule qui ordonne.
//   · AUCUN NOM DE COMPARTIMENT INVENTÉ. Le bucket déclaré doit appartenir au
//     vocabulaire FERMÉ des compartiments gouvernés. Une écriture qui aurait
//     atterri ailleurs n'est pas une localisation gouvernée : c'est un fait
//     qu'il faut regarder, pas inscrire.
//
// ─── CE QU'IL N'AFFIRME PAS ───────────────────────────────────────────────
//
// Inscrire une localisation n'établit NI que les octets sont intacts, NI que
// leur empreinte concorde, NI qu'ils sont horodatables. Elle dit OÙ CHERCHER,
// et c'est tout. La concordance reste l'affaire de `readbackDigest`, qui relit
// et recalcule — et qui refuse.

import { estCompartimentGouverne, COMPARTIMENTS_GOUVERNES } from "./compartment";
import type { EstablishmentMode } from "./storageLocationJournal";

// ═══ LA CONNEXION ═══════════════════════════════════════════════════════════

/** Une connexion DANS une transaction. `$1..$n` positionnels, rendu en lignes. */
export interface LocationSqlRunner {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}

/** Ouvre une transaction, VALIDE si `fn` rend, ANNULE si `fn` lève. */
export interface LocationSqlTransactor {
  transaction<T>(fn: (db: LocationSqlRunner) => Promise<T>): Promise<T>;
}

// ═══ L'INTENTION — UN SEUL MODE, ET IL N'EST PAS UN CHAMP ═══════════════════

/**
 * Ce qu'une DÉCLARATION D'ÉCRITURE porte.
 *
 * ⚠️ `establishmentMode` N'EST PAS UN CHAMP. Le rendre choisissable aurait fait
 * de « j'ai mesuré » une valeur qu'un appelant peut poser — c'est-à-dire
 * exactement la falsification que le registre existe pour empêcher.
 */
export interface DeclarationDEcriture {
  /** La pièce. FK vers `EvidenceItem` — une pièce inexistante est refusée par la base. */
  readonly evidenceItemId: string;
  /** Le compartiment où l'écriture a EFFECTIVEMENT eu lieu. Vocabulaire fermé. */
  readonly bucket: string;
  /** La clé sous laquelle elle a eu lieu. Telle quelle — jamais reconstruite. */
  readonly storageKey: string;
  /** QUI déclare. Un acte signé. */
  readonly declaredBy: string;
  /** QUAND. Fourni par l'appelant : la colonne est sans DEFAULT à dessein. */
  readonly declaredAt: Date | string;
}

/** LE mode que ce module écrit, et le seul. Exporté pour être assertable. */
export const MODE_ECRIT: Extract<EstablishmentMode, "DECLARED_AT_WRITE"> = "DECLARED_AT_WRITE";

// ═══ LES CAUSES — NOMMÉES, FERMÉES ══════════════════════════════════════════

export const LOCATION_WRITE_REFUSAL_CAUSES = [
  /** L'intention n'est pas un objet. */
  "MALFORMED_INTENT",
  /** `evidenceItemId` absent, vide, ou bordé de blancs. */
  "MISSING_EVIDENCE_TARGET",
  /** Le compartiment n'appartient pas au vocabulaire FERMÉ des gouvernés. */
  "COMPARTMENT_NOT_GOVERNED",
  /** Clé vide, bordée de blancs, portant un caractère de contrôle, ou absolue. */
  "MALFORMED_STORAGE_KEY",
  /** `declaredBy` vide ou bordé de blancs : un acte doit être signé. */
  "MALFORMED_DECLARANT",
  /** `declaredAt` absent ou non convertible en instant. */
  "MALFORMED_DECLARED_AT",
] as const;
export type LocationWriteRefusalCause = (typeof LOCATION_WRITE_REFUSAL_CAUSES)[number];

export const LOCATION_WRITE_ABORT_CAUSES = [
  /** L'INSERT n'a pas rendu d'id : rien n'a été inscrit, et on ne le suppose pas. */
  "INSERT_NOT_RECORDED",
  /** La relecture ne retrouve pas la ligne qui vient d'être inscrite. */
  "READBACK_MISSING",
  /** La ligne relue diverge de ce qui a été demandé. Le mutant `now()` tombe ICI. */
  "READBACK_MISMATCH",
] as const;
export type LocationWriteAbortCause = (typeof LOCATION_WRITE_ABORT_CAUSES)[number];

export interface LocationWriteRefusal<C extends string> {
  readonly cause: C;
  /** OÙ : le champ ou la colonne mise en cause. Un refus sans lieu ne se corrige pas. */
  readonly at: string;
}

/** La ligne inscrite, RELUE. Les valeurs viennent de la base, pas de l'intention. */
export interface LocalisationInscrite {
  readonly eventId: string;
  readonly evidenceItemId: string;
  readonly bucket: string;
  readonly storageKey: string;
  readonly establishmentMode: EstablishmentMode;
  readonly declaredBy: string;
  /** ISO-8601 UTC, tel que relu. */
  readonly declaredAt: string;
  readonly observedBy: string | null;
  readonly observedAt: string | null;
  /** L'horloge de la BASE. La seule qui ordonne. */
  readonly recordedAt: string;
}

export type LocationWriteOutcome =
  | { readonly outcome: "RECORDED"; readonly row: LocalisationInscrite }
  | { readonly outcome: "REFUSED"; readonly refusal: LocationWriteRefusal<LocationWriteRefusalCause> }
  | { readonly outcome: "ABORTED"; readonly refusal: LocationWriteRefusal<LocationWriteAbortCause> };

/** Levée DANS la transaction : le transactor annule, l'appelant reçoit la cause. */
export class LocationWriteAbort extends Error {
  constructor(readonly cause: LocationWriteAbortCause, readonly at: string) {
    super(`[storage-location] ABANDON [${cause}] à ${at}`);
    this.name = "LocationWriteAbort";
  }
}

// ═══ LA VALIDATION — AVANT LA BASE, AVEC UNE CAUSE ══════════════════════════

const estChaineNonBordee = (v: unknown): v is string =>
  typeof v === "string" && v !== "" && v.trim() === v;

/** `true` si la chaîne porte un caractère de contrôle C0 ou DEL. */
const porteUnCaractereDeControle = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
};

/** Un instant, en ISO-8601 UTC. `null` si la valeur n'en est pas un. */
function instant(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "string" && v.trim() !== "") {
    const t = new Date(v);
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  }
  return null;
}

/** Ce que l'INSERT recevra : chaque colonne, déjà normalisée. */
interface Parametres {
  readonly evidenceItemId: string;
  readonly bucket: string;
  readonly storageKey: string;
  readonly declaredBy: string;
  readonly declaredAt: string;
}

/**
 * Toutes les règles, en une passe. Pure : aucune requête, aucune horloge.
 *
 * Les formes refusées reproduisent les CHECK de la base — délibérément. Le
 * CHECK reste le FILET pour ce qui n'est pas passé par ici (psql, un import) ;
 * il n'est pas la règle de ce module, et un refus de la base ne dirait pas
 * QUELLE règle a parlé.
 */
export function validerDeclaration(
  intent: DeclarationDEcriture,
): { ok: true; params: Parametres } | { ok: false; refusal: LocationWriteRefusal<LocationWriteRefusalCause> } {
  const ko = (cause: LocationWriteRefusalCause, at: string) => ({ ok: false as const, refusal: { cause, at } });

  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
    return ko("MALFORMED_INTENT", "intent");
  }
  if (!estChaineNonBordee(intent.evidenceItemId)) return ko("MISSING_EVIDENCE_TARGET", "evidenceItemId");

  // ⛔ Le vocabulaire est FERMÉ. On n'inscrit pas une localisation dans un
  //    compartiment que le dépôt ne gouverne pas : ce serait rendre autoritaire
  //    un nom que personne n'a décidé.
  if (!estChaineNonBordee(intent.bucket) || !estCompartimentGouverne(intent.bucket)) {
    return ko("COMPARTMENT_NOT_GOVERNED", "bucket");
  }

  // La forme exacte du CHECK `storage_key_check` : non vide, non bordée, sans
  // caractère de contrôle, jamais absolue.
  const cle = intent.storageKey;
  if (
    !estChaineNonBordee(cle) ||
    // Caractères de contrôle, par CODE et non par classe de regex : une classe
    // qui porte des octets de contrôle LITTÉRAUX est invisible en revue, et un
    // outil qui réécrit le fichier peut la mutiler sans que rien ne le dise.
    porteUnCaractereDeControle(cle) ||
    cle.startsWith("/")
  ) {
    return ko("MALFORMED_STORAGE_KEY", "storageKey");
  }

  if (!estChaineNonBordee(intent.declaredBy)) return ko("MALFORMED_DECLARANT", "declaredBy");

  const declaredAt = instant(intent.declaredAt);
  if (declaredAt === null) return ko("MALFORMED_DECLARED_AT", "declaredAt");

  return {
    ok: true,
    params: {
      evidenceItemId: intent.evidenceItemId,
      bucket: intent.bucket,
      storageKey: cle,
      declaredBy: intent.declaredBy,
      declaredAt,
    },
  };
}

const memeInstant = (a: string, b: string): boolean => {
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  return !Number.isNaN(x) && !Number.isNaN(y) && x === y;
};

// ═══ L'ÉCRITURE — UNE TRANSACTION, UN INSERT, UNE RELECTURE ═════════════════

/**
 * DÉCLARER où des octets ont été écrits. Append-only, par construction.
 *
 * Refuse AVANT la base sur toute règle violée, avec une cause nommée. Les refus
 * de la BASE (23503 pièce inexistante, 23514 CHECK) ne sont PAS traduits en
 * refus gouvernés : ils remontent tels quels, parce qu'ils disent quelque chose
 * que ce module ne savait pas. La transaction est annulée de la même façon.
 *
 * ⛔ Aucun chemin de cette fonction ne met à jour ni ne supprime quoi que ce
 * soit. Relocaliser = rappeler cette fonction avec une NOUVELLE déclaration ;
 * le lecteur prend `max(id)`, donc la dernière fait foi sans rien réécrire.
 */
export async function declarerLocalisationALEcriture(
  tx: LocationSqlTransactor,
  intent: DeclarationDEcriture,
): Promise<LocationWriteOutcome> {
  const v = validerDeclaration(intent);
  if (!v.ok) return { outcome: "REFUSED", refusal: v.refusal };
  const p = v.params;

  try {
    return await tx.transaction(async (db) => {
      // ── L'INSERT. Le SQL est écrit EN CLAIR AU SITE D'APPEL, jamais tenu
      //    dans une constante ni assemblé : la garde S24 découvre les tables
      //    atteintes en lisant le gabarit littéral passé à `db.query`.
      //
      // ⚠ `'DECLARED_AT_WRITE'` est un LITTÉRAL, et `observed_by` / `observed_at`
      //    sont `NULL` EN DUR. Il n'y a pas de paramètre pour le mode : l'autre
      //    mode est inexprimable ici, pas seulement inutilisé.
      //
      // ⚠ `declared_at` est `$5`. Pas `now()`. Le mutant qui substitue l'horloge
      //    du serveur fait diverger la relecture et rougit.
      const inserted = await db.query<{ eventId: string }>(
        `INSERT INTO evidence_storage_location_journal
        (evidence_item_id, bucket, storage_key, establishment_mode,
         declared_by, declared_at, observed_by, observed_at)
 VALUES ($1, $2, $3, 'DECLARED_AT_WRITE', $4, $5::timestamptz, NULL, NULL)
 RETURNING id::text AS "eventId"`,
        [p.evidenceItemId, p.bucket, p.storageKey, p.declaredBy, p.declaredAt],
      );
      const eventId = inserted[0]?.eventId;
      if (typeof eventId !== "string" || eventId === "") {
        throw new LocationWriteAbort("INSERT_NOT_RECORDED", "id");
      }

      // ── LA RELECTURE. Ce qui est rendu vient de la BASE, jamais de
      //    l'intention : un DEFAULT surprise, un trigger ou une troncature
      //    doivent être VUS, et non recopiés depuis ce qu'on croyait écrire.
      const relu = await db.query<Record<string, unknown>>(
        `SELECT id::text            AS "eventId",
                evidence_item_id    AS "evidenceItemId",
                bucket              AS "bucket",
                storage_key         AS "storageKey",
                establishment_mode  AS "establishmentMode",
                declared_by         AS "declaredBy",
                declared_at         AS "declaredAt",
                observed_by         AS "observedBy",
                observed_at         AS "observedAt",
                recorded_at         AS "recordedAt"
           FROM evidence_storage_location_journal
          WHERE id = $1::bigint`,
        [eventId],
      );
      const r = relu[0];
      if (!r) throw new LocationWriteAbort("READBACK_MISSING", eventId);

      const declaredAtRelu = instant(r.declaredAt);
      const divergences: string[] = [];
      if (r.evidenceItemId !== p.evidenceItemId) divergences.push("evidence_item_id");
      if (r.bucket !== p.bucket) divergences.push("bucket");
      if (r.storageKey !== p.storageKey) divergences.push("storage_key");
      if (r.establishmentMode !== MODE_ECRIT) divergences.push("establishment_mode");
      if (r.declaredBy !== p.declaredBy) divergences.push("declared_by");
      if (declaredAtRelu === null || !memeInstant(declaredAtRelu, p.declaredAt)) divergences.push("declared_at");
      // L'AUTRE SENS du CHECK `head_iff_observation` : une DÉCLARATION ne porte
      // aucune observation. Une ligne qui en porterait une se ferait passer
      // pour une mesure.
      if (r.observedBy !== null) divergences.push("observed_by");
      if (r.observedAt !== null) divergences.push("observed_at");
      if (divergences.length > 0) throw new LocationWriteAbort("READBACK_MISMATCH", divergences.join(","));

      const recordedAt = instant(r.recordedAt);
      if (recordedAt === null) throw new LocationWriteAbort("READBACK_MISMATCH", "recorded_at");

      return {
        outcome: "RECORDED" as const,
        row: {
          eventId,
          evidenceItemId: p.evidenceItemId,
          bucket: p.bucket,
          storageKey: p.storageKey,
          establishmentMode: MODE_ECRIT,
          declaredBy: p.declaredBy,
          declaredAt: declaredAtRelu as string,
          observedBy: null,
          observedAt: null,
          recordedAt,
        },
      };
    });
  } catch (e) {
    if (e instanceof LocationWriteAbort) {
      return { outcome: "ABORTED", refusal: { cause: e.cause, at: e.at } };
    }
    throw e;
  }
}

/** Le vocabulaire fermé, ré-exporté pour un message d'opérateur. */
export const COMPARTIMENTS_DECLARABLES: readonly string[] = COMPARTIMENTS_GOUVERNES;
