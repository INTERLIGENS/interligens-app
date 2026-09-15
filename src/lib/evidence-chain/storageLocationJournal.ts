/**
 * LE REGISTRE DE LOCALISATION — LU. Où sont les octets de CETTE pièce.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « An evidence object's storage key does not establish its storage
 *     compartment. Storage location requires its own governed authority. »
 *
 * Et le motif qui a écarté la colonne mutable :
 *   « La localisation d'un objet probatoire est un fait SUSCEPTIBLE D'ÉVOLUER
 *     lors d'une migration ; elle doit donc avoir son historique et son
 *     fondement. UNE COLONNE MUTABLE r2Bucket ÉCRASERAIT PRÉCISÉMENT CETTE
 *     HISTOIRE. »
 *
 * ─── LES DEUX RÈGLES DE LECTURE, ET ELLES SONT TOUT ─────────────────────────
 *
 *     DERNIER ÉVÉNEMENT GOUVERNÉ = LOCALISATION COURANTE
 *     AMBIGUÏTÉ OU INCOHÉRENCE   = FAIL CLOSED
 *
 * « Dernier » = max(id), calculé ICI, en BigInt. JAMAIS la première ligne,
 * JAMAIS l'ordre du tableau reçu, JAMAIS la plus récente par une horloge —
 * deux horloges peuvent être égales, deux IDENTITY non.
 *
 * ─── ⛔ AUCUN REPLI. LES CINQ, NOMMÉMENT ────────────────────────────────────
 *
 * Ce module ne lit PAS, et ne lira jamais :
 *   · le PRÉFIXE de la clé (`reports/…`) pour en déduire un compartiment.
 *     NO-GO EXPLICITE. Les 31 pièces mesurées portent TOUTES ce préfixe : c'est
 *     ce qui rend le repli si tentant, et c'est exactement pourquoi il est
 *     interdit. Une clé décrit un CHEMIN DANS un compartiment, jamais lequel.
 *   · `R2_BUCKET_NAME` comme valeur par défaut.
 *   · une convention de date ou de dossier.
 *   · le sha256 des octets — il identifie des OCTETS, or la question est dans
 *     quel compartiment ils sont, et les mêmes octets peuvent être dans deux.
 *   · une ligne précédente « plus pratique » quand la dernière est hors domaine.
 *
 * Une valeur hors domaine rend une CAUSE PROPRE et ne remonte JAMAIS à une
 * ligne antérieure. C'est le motif exact de `journalProvenance.ts`, et pour la
 * même raison : remonter, ce serait choisir la réponse qui arrange.
 *
 * ─── LECTURE SEULE ──────────────────────────────────────────────────────────
 *
 * AUCUN INSERT, AUCUN UPDATE, AUCUN DELETE. Le registre est append-only par
 * trigger en base (23001 sur UPDATE, DELETE et TRUNCATE) ; ici il est LU.
 * L'inscription des lignes est une écriture de production, et une autre fenêtre.
 */

/** Le vocabulaire CLOS du mode d'établissement. Deux valeurs, pas trois. */
export const ESTABLISHMENT_MODES = ["DECLARED_AT_WRITE", "VERIFIED_BY_HEAD"] as const;
export type EstablishmentMode = (typeof ESTABLISHMENT_MODES)[number];

/**
 * POURQUOI la localisation n'est pas résolue. Une non-résolution sans cause
 * serait indiscernable d'une non-résolution par négligence — et surtout, les
 * quatre causes n'appellent PAS le même geste.
 */
export const LOCATION_REFUSAL_CAUSES = [
  /**
   * Le registre ne porte AUCUN événement pour cette pièce. C'est l'état de
   * TOUTES les pièces au jour de la pose : la table naît vide. Une DETTE DE
   * MIGRATION — pas une impossibilité, et surtout pas une absence d'octets.
   */
  "NO_LOCATION_EVENT",
  /**
   * Le dernier événement n'est pas exploitable : mode hors du vocabulaire clos,
   * compartiment vide, VERIFIED_BY_HEAD sans observation (ou DECLARED_AT_WRITE
   * avec une observation), ou un `id` non ordonnable — « le dernier événement »
   * cesserait alors d'être non ambigu. Une ANOMALIE DE LA BASE, pas un trou de
   * couverture, et elle ne se dégrade JAMAIS en simple absence.
   */
  "ROW_OUT_OF_DOMAIN",
  /**
   * L'AMBIGUÏTÉ que le ruling nomme : deux événements portant le MÊME id
   * maximal désignent des compartiments (ou des clés, ou des modes) DIFFÉRENTS.
   * La base ne peut pas produire ça — `id` est PK : le jeu de résultats est
   * malformé. Prendre le premier serait ARBITRER. On refuse.
   */
  "AMBIGUOUS_LATEST",
  /**
   * L'INCOHÉRENCE, seconde moitié de la règle : le registre désigne une clé,
   * la pièce en porte une autre. Deux autorités se contredisent sur l'endroit
   * où regarder. On ne « préfère » ni l'une ni l'autre — préférer, c'est
   * arbitrer.
   */
  "KEY_DIVERGENCE",
] as const;
export type LocationRefusalCause = (typeof LOCATION_REFUSAL_CAUSES)[number];

/** Ce qu'il faut pour interroger le registre : l'identité, et la clé portée. */
export interface StorageLocationRef {
  readonly evidenceItemId: string;
  /** `"EvidenceItem"."r2Key"` — confronté à celui du registre, jamais préféré. */
  readonly r2Key: string | null;
}

/** Une ligne du registre, TELLE QUE LUE. Colonnes énumérées, jamais `*`. */
export interface StorageLocationRow {
  /** BIGINT : il peut dépasser `Number.MAX_SAFE_INTEGER`. Comparé en `BigInt`. */
  readonly id: string | number | bigint;
  readonly evidenceItemId: string;
  readonly bucket: string;
  readonly storageKey: string;
  readonly establishmentMode: string;
  readonly declaredBy: string;
  readonly declaredAt: Date | string;
  readonly observedBy: string | null;
  readonly observedAt: Date | string | null;
}

/** Une localisation EFFECTIVEMENT établie, lue au registre. */
export interface EstablishedLocation {
  readonly established: true;
  readonly bucket: string;
  readonly storageKey: string;
  readonly mode: EstablishmentMode;
  /** L'`id` de l'événement qui fait foi. Rendu en texte : c'est un BIGINT. */
  readonly eventId: string;
  readonly declaredBy: string;
  /**
   * Non nul SI ET SEULEMENT SI `mode === "VERIFIED_BY_HEAD"` — CHECK en base,
   * RECONSTRUIT ici. Une ligne posée hors du DDL ne se ferait pas passer pour
   * mesurée, et une déclaration ne se ferait pas passer pour une mesure.
   */
  readonly observation: { readonly by: string; readonly at: Date | string } | null;
}

/** L'ABSENCE de localisation établie, et sa cause. */
export interface UnestablishedLocation {
  readonly established: false;
  readonly cause: LocationRefusalCause;
  /** L'événement mis en cause, quand il y en a un. */
  readonly eventId: string | null;
  /** Le détail, pour un opérateur. Jamais vide, jamais « inconnu ». */
  readonly detail: string;
}

export type StorageLocation = EstablishedLocation | UnestablishedLocation;

const estMode = (v: unknown): v is EstablishmentMode =>
  typeof v === "string" && (ESTABLISHMENT_MODES as readonly string[]).includes(v);

const refus = (
  cause: LocationRefusalCause,
  detail: string,
  eventId: string | null = null,
): UnestablishedLocation => ({ established: false, cause, eventId, detail });

/**
 * L'`id` d'un événement, en `BigInt`, ou `null` s'il n'est pas ordonnable.
 *
 * `BigInt` et non `Number` : la colonne est un BIGINT IDENTITY. Au-delà de 2^53
 * deux ids distincts deviendraient égaux en flottant, et « le dernier événement
 * gouverné » cesserait d'être non ambigu — exactement ce que la colonne
 * IDENTITY garantit en base.
 */
function ordre(id: unknown): bigint | null {
  try {
    if (typeof id === "bigint") return id;
    if (typeof id === "number") return Number.isSafeInteger(id) ? BigInt(id) : null;
    if (typeof id === "string" && /^-?\d+$/.test(id)) return BigInt(id);
    return null;
  } catch {
    return null;
  }
}

/**
 * LA RÉSOLUTION. Pure, synchrone, déterministe. Aucun réseau, aucun `process.env`.
 *
 * L'ordre des étapes EST le contrat :
 *   1. les événements de CETTE pièce            (égalité stricte sur l'identité)
 *   2. aucun ?                                  → NO_LOCATION_EVENT
 *   3. le DERNIER = max(id)                     (jamais le tableau, jamais l'horloge)
 *   4. plusieurs au max, en désaccord ?         → AMBIGUOUS_LATEST
 *   5. hors domaine ?                           → ROW_OUT_OF_DOMAIN
 *   6. clé du registre ≠ clé de la pièce ?      → KEY_DIVERGENCE
 *   7. sinon : la localisation, AVEC son mode.
 *
 * Aucune branche ne rend un compartiment par défaut. La SEULE source d'un nom
 * de compartiment dans cette fonction est `derniere.bucket` — c'est vérifiable
 * à l'œil, et un témoin structurel le vérifie aussi.
 */
export function resolveStorageLocation(
  ref: StorageLocationRef,
  rows: readonly StorageLocationRow[],
): StorageLocation {
  if (typeof ref !== "object" || ref === null || typeof ref.evidenceItemId !== "string" || ref.evidenceItemId === "") {
    return refus("NO_LOCATION_EVENT", "aucune identité de pièce à interroger : il n'y a pas de localisation à résoudre.");
  }

  // ── 1 · les événements de CETTE pièce. L'égalité est stricte : un événement
  // d'une AUTRE pièce ne fuit pas ici, quelle que soit la ressemblance des clés.
  const candidats = Array.isArray(rows)
    ? rows.filter((r) => typeof r === "object" && r !== null && r.evidenceItemId === ref.evidenceItemId)
    : [];
  if (candidats.length === 0) {
    return refus(
      "NO_LOCATION_EVENT",
      `le registre de localisation ne porte aucun événement pour la pièce ${ref.evidenceItemId}. ` +
        "C'est une DETTE DE MIGRATION / RÉSOLUTION, pas une impossibilité — et surtout pas une " +
        "absence d'octets. Aucun compartiment n'est supposé, aucun préfixe de clé n'est lu.",
    );
  }

  // ── 2 · le DERNIER événement = max(id). Un id non ordonnable rend l'ordre
  // lui-même ambigu : on ne devine pas, on refuse — et on ne remonte PAS à
  // l'événement précédent, qui serait « celui qui arrange ».
  let max: bigint | null = null;
  for (const r of candidats) {
    const o = ordre(r.id);
    if (o === null) {
      return refus(
        "ROW_OUT_OF_DOMAIN",
        `un événement de la pièce ${ref.evidenceItemId} porte un id non ordonnable (${String(r.id)}) : ` +
          "« le dernier événement gouverné » n'est plus défini. On ne retient pas l'événement précédent.",
        typeof r.id === "string" ? r.id : null,
      );
    }
    if (max === null || o > max) max = o;
  }
  if (max === null) return refus("NO_LOCATION_EVENT", `aucun événement ordonnable pour la pièce ${ref.evidenceItemId}.`);
  const eventId = max.toString();

  // ── 3 · L'AMBIGUÏTÉ. Plusieurs événements au MÊME id maximal : la base ne
  // peut pas l'avoir produit (`id` est PK), donc le jeu de résultats est
  // malformé. S'ils disent la MÊME chose, la doublure est inoffensive ; s'ils
  // divergent, prendre le premier serait ARBITRER.
  const auMax = candidats.filter((r) => ordre(r.id) === max);
  const signatures = new Set(auMax.map((r) => `${r.bucket} ${r.storageKey} ${r.establishmentMode}`));
  if (signatures.size > 1) {
    return refus(
      "AMBIGUOUS_LATEST",
      `${auMax.length} événements concurrents portent l'id ${eventId} pour la pièce ${ref.evidenceItemId} et ` +
        `désignent des localisations DIFFÉRENTES (${auMax.map((r) => `${r.bucket}/${r.storageKey}`).join(" ≠ ")}). ` +
        "Une ambiguïté n'est pas une résolution : on ne choisit pas, on refuse.",
      eventId,
    );
  }
  const derniere = auMax[0];

  // ── 4 · LE DOMAINE. Un mode hors du vocabulaire clos tombe ICI, et n'en
  // ressort pas : il ne se dégrade pas en absence, et ne fait pas remonter à
  // un événement antérieur.
  if (!estMode(derniere.establishmentMode)) {
    return refus(
      "ROW_OUT_OF_DOMAIN",
      `l'événement ${eventId} porte un mode d'établissement hors du vocabulaire clos ` +
        `(« ${String(derniere.establishmentMode)} » ; admis : ${ESTABLISHMENT_MODES.join(", ")}). ` +
        "C'est une anomalie de la base, pas un trou de couverture.",
      eventId,
    );
  }
  if (typeof derniere.bucket !== "string" || derniere.bucket.trim() === "") {
    return refus("ROW_OUT_OF_DOMAIN", `l'événement ${eventId} ne nomme aucun compartiment.`, eventId);
  }
  if (typeof derniere.storageKey !== "string" || derniere.storageKey.trim() === "") {
    return refus("ROW_OUT_OF_DOMAIN", `l'événement ${eventId} ne porte aucune clé de stockage.`, eventId);
  }

  // ── 5 · VERIFIED_BY_HEAD ⇔ (qui a mesuré, quand). Le CHECK le garantit en
  // base ; on le RECONSTRUIT ici. Les DEUX SENS : une DECLARED_AT_WRITE portant
  // une observation n'est pas une déclaration renforcée, c'est une ligne
  // incohérente — quelqu'un aurait mesuré sans le déclarer comme tel.
  let observation: EstablishedLocation["observation"] = null;
  if (derniere.establishmentMode === "VERIFIED_BY_HEAD") {
    const by = derniere.observedBy;
    const at = derniere.observedAt;
    if (typeof by !== "string" || by === "" || at === null || at === undefined) {
      return refus(
        "ROW_OUT_OF_DOMAIN",
        `l'événement ${eventId} se déclare VERIFIED_BY_HEAD sans dire QUI a mesuré ni QUAND. ` +
          "Une mesure sans date de mesure est invérifiable : on ne saurait pas de quand date la " +
          "dernière fois qu'on a vu l'objet.",
        eventId,
      );
    }
    observation = { by, at };
  } else if (derniere.observedBy !== null || derniere.observedAt !== null) {
    return refus(
      "ROW_OUT_OF_DOMAIN",
      `l'événement ${eventId} se déclare ${derniere.establishmentMode} mais porte une observation. ` +
        "Ce n'est pas une déclaration renforcée : c'est une ligne incohérente.",
      eventId,
    );
  }

  // ── 6 · L'INCOHÉRENCE entre les deux autorités sur la CLÉ. Le registre dit
  // une chose, la colonne de la pièce en dit une autre. On ne départage pas.
  //
  // ⚠️ Ce n'est PAS un CHECK en base, à dessein : une migration qui DÉPLACE un
  // objet change légitimement sa clé, et un registre incapable de l'enregistrer
  // ne serait pas un registre d'historique. La divergence est légitime à
  // ÉCRIRE, et refusée à LIRE tant qu'une autorité n'a pas aussi mis "r2Key" à
  // jour. Le refus est le bon endroit pour cette tension.
  const cleDeLaPiece = (ref.r2Key ?? "").trim();
  if (cleDeLaPiece !== "" && cleDeLaPiece !== derniere.storageKey.trim()) {
    return refus(
      "KEY_DIVERGENCE",
      `le registre situe la pièce ${ref.evidenceItemId} sous « ${derniere.storageKey} » (événement ${eventId}), ` +
        `mais la pièce porte « ${cleDeLaPiece} ». Deux autorités se contredisent sur l'endroit où regarder : ` +
        "on ne préfère ni l'une ni l'autre, on refuse. Chercher au mauvais endroit et ne rien trouver " +
        "ne serait pas une mesure d'absence.",
      eventId,
    );
  }

  return {
    established: true,
    bucket: derniere.bucket,
    storageKey: derniere.storageKey,
    mode: derniere.establishmentMode,
    eventId,
    declaredBy: derniere.declaredBy,
    observation,
  };
}

// ═══ LA LECTURE EN BASE — SELECT, ET RIEN D'AUTRE ═══════════════════════════

/** Le minimum pour interroger. Même forme que `JournalSqlRunner`. */
export interface StorageLocationSqlRunner {
  query<T extends Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

/**
 * Le nom de la table.
 *
 * ⚠️ Il est aussi écrit LITTÉRALEMENT dans la requête ci-dessous, et ce n'est
 * pas une redondance à supprimer. La garde S24 (`racinesSqlParCapacite.ts`)
 * recense les racines de SQL brut en cherchant `FROM <identifiant>` dans les
 * sources : une requête qui INTERPOLE son nom de table devient INVISIBLE à
 * l'inventaire de gouvernance. Mesuré le 2026-09-15 — l'interpolation faisait
 * rougir « l'inventaire ne porte aucune entrée morte ». Une table gouvernée
 * doit se voir dans le code comme dans l'inventaire.
 */
export const STORAGE_LOCATION_TABLE = "evidence_storage_location_journal";

/**
 * Les DERNIERS événements pour un lot de pièces, une pièce par ligne.
 *
 * `DISTINCT ON` plutôt qu'un `LATERAL` par pièce : une seule passe sur
 * `evidence_storage_location_journal_item_idx (evidence_item_id, id DESC)`.
 * Le tri est le MÊME que celui de `resolveStorageLocation` — la résolution ne
 * s'y fie pas pour autant : deux gardes valent mieux qu'un contrat implicite
 * entre un appelant et son appelé.
 *
 * ⛔ SELECT. Ce module n'écrit RIEN — et la table est append-only par trigger
 * de toute façon.
 */
export async function readLatestStorageLocationRows(
  db: StorageLocationSqlRunner,
  evidenceItemIds: readonly string[],
): Promise<StorageLocationRow[]> {
  const clefs = [...new Set(evidenceItemIds.filter((s): s is string => typeof s === "string" && s !== ""))];
  if (clefs.length === 0) return [];
  const rows = await db.query<Record<string, unknown>>(
    `SELECT DISTINCT ON (evidence_item_id)
            id::text           AS "id",
            evidence_item_id   AS "evidenceItemId",
            bucket             AS "bucket",
            storage_key        AS "storageKey",
            establishment_mode AS "establishmentMode",
            declared_by        AS "declaredBy",
            declared_at        AS "declaredAt",
            observed_by        AS "observedBy",
            observed_at        AS "observedAt"
       FROM evidence_storage_location_journal
      WHERE evidence_item_id = ANY($1)
      ORDER BY evidence_item_id, id DESC`,
    [clefs],
  );
  return rows as unknown as StorageLocationRow[];
}

/**
 * Le lecteur complet : les identités, puis le registre, puis la résolution.
 *
 * Rend une entrée par `evidenceItemId` reçu — y compris pour les pièces sans
 * événement : leur refus est dérivé de l'ABSENCE, et il le dit.
 */
export async function readStorageLocations(
  db: StorageLocationSqlRunner,
  refs: readonly StorageLocationRef[],
): Promise<Map<string, StorageLocation>> {
  const rows = await readLatestStorageLocationRows(db, refs.map((r) => r?.evidenceItemId));
  return new Map(refs.map((r) => [r.evidenceItemId, resolveStorageLocation(r, rows)]));
}
