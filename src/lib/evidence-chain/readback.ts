/**
 * RELECTURE DES OCTETS PERSISTÉS — l'autorité du hash soumis à la TSA.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « Persisted bytes, not stored digest metadata, are the authority for the
 *     hash submitted to a timestamp service. »
 *
 * CE QUI SE FAISAIT AVANT
 * -----------------------
 * `stamp-pending` lisait `EvidenceItem.sha256` — UNE COLONNE — et l'envoyait
 * tel quel à l'autorité d'horodatage. Rien, à aucun moment, ne retournait
 * voir si des octets existaient encore derrière ce hash, ni s'ils le
 * produisaient toujours. Le jeton RFC 3161 aurait donc attesté une LIGNE DE
 * BASE, pas une preuve. C'est exactement le scénario `evi_rep_bd69380a…` :
 * octets supprimés par une règle de cycle de vie R2 le 2026-08-19, hash et
 * byteSize toujours au registre, indiscernables d'une pièce intacte.
 *
 * Un HEAD ne suffit pas non plus. HEAD répond « il y a un objet, il fait
 * 182 296 octets ». Il ne dit RIEN de leur contenu. Un objet écrasé par un
 * autre de même taille passerait le HEAD sans broncher. Le gate exige LES
 * OCTETS EUX-MÊMES, et le SHA-256 RECALCULÉ DEPUIS CES OCTETS.
 *
 * FAIL-CLOSED, ET LA DIRECTION DU DÉFAUT EST LE SUJET
 * ---------------------------------------------------
 * Ne pas horodater une pièce saine est RÉPARABLE : le run suivant la reprend.
 * Horodater une pièce dont les octets ont changé ou disparu ne l'est PAS :
 * le jeton est une écriture irréversible chez un tiers. Chaque doute sort donc
 * en refus nommé, et aucun refus ne se confond avec un autre.
 *
 * CE MODULE N'A NI CLIENT S3 NI ACCÈS BASE — même doctrine que `bytesProbe`.
 * Il ne sait faire qu'une chose : appeler le `readObject` qu'on lui INJECTE.
 * Il est structurellement incapable d'aller chercher un octet tout seul, et
 * c'est ce qui permet de l'éprouver sans aucun réseau.
 */
import { sha256Buffer } from "./hash";
import { classifyHeadError } from "./bytesProbe";

/** L'unique capacité de la relecture. Injectée. Rien d'autre n'est possible. */
export type ReadObjectFn = (key: string) => Promise<Buffer>;

/**
 * Les refus. Chacun est une CAUSE DISTINCTE, et les confondre est la faute
 * qu'on répare : « absent » et « je n'ai pas pu lire » ne se traitent pas
 * pareil, et aucun des deux ne vaut « divergent ».
 */
export type ReadbackRefusalKind =
  /** Le registre ne dit même pas où sont les octets. Rien à relire. */
  | "no_storage_key"
  /** La colonne sha256 est vide ou malformée : il n'y a rien à confronter. */
  | "no_expected_digest"
  /** Le stockage a répondu de façon autoritaire : l'objet n'est plus là. */
  | "object_absent"
  /** Le stockage n'a pas répondu, ou a refusé. NON-OBSERVATION, pas absence. */
  | "object_unreadable"
  /** Objet présent et vide. Un hash sur zéro octet n'atteste rien. */
  | "object_empty"
  /** Les octets existent et ne produisent PAS le hash attendu. */
  | "digest_mismatch";

export const READBACK_REFUSAL_KINDS: readonly ReadbackRefusalKind[] = Object.freeze([
  "no_storage_key",
  "no_expected_digest",
  "object_absent",
  "object_unreadable",
  "object_empty",
  "digest_mismatch",
]);

export interface ReadbackOk {
  readonly ok: true;
  /**
   * LE HASH À SOUMETTRE. Recalculé depuis les octets relus. Ce champ n'est
   * JAMAIS une copie de la colonne : si les deux coïncident c'est parce
   * qu'ils ont été confrontés, pas parce que l'un a été recopié.
   */
  readonly sha256: string;
  /** Taille RELUE, pas la colonne byteSize. */
  readonly byteSize: number;
}

export interface ReadbackRefused {
  readonly ok: false;
  readonly kind: ReadbackRefusalKind;
  readonly detail: string;
}

export type ReadbackVerdict = ReadbackOk | ReadbackRefused;

/** Un digest hexadécimal se compare sans égard à la casse ni aux espaces. */
export function normalizeDigest(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase();
}

const HEX64 = /^[0-9a-f]{64}$/;

function refuse(kind: ReadbackRefusalKind, detail: string): ReadbackRefused {
  return { ok: false, kind, detail };
}

function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  return `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`;
}

export interface ReadbackInput {
  /** Où le registre affirme que les octets sont persistés. */
  readonly r2Key: string | null | undefined;
  /** Ce que le registre affirme qu'ils produisent. Une ATTENTE, pas une autorité. */
  readonly expectedSha256: string | null | undefined;
  readonly readObject: ReadObjectFn;
}

/**
 * Relit les octets, recalcule, confronte. Rend le hash RECALCULÉ, ou un refus.
 *
 * L'ordre des contrôles n'est pas décoratif : on ne parle de divergence
 * qu'après avoir établi qu'il y avait bien quelque chose à lire, sinon un
 * objet absent se rapporterait comme une preuve altérée.
 */
export async function readbackDigest(input: ReadbackInput): Promise<ReadbackVerdict> {
  const key = (input.r2Key ?? "").trim();
  if (!key) {
    return refuse(
      "no_storage_key",
      "aucune clé de stockage au registre — il n'existe aucun octet à relire, donc rien à horodater",
    );
  }

  const expected = normalizeDigest(input.expectedSha256);
  if (!HEX64.test(expected)) {
    return refuse(
      "no_expected_digest",
      `sha256 attendu absent ou malformé au registre (${JSON.stringify(input.expectedSha256)}) — aucune confrontation possible`,
    );
  }

  let bytes: Buffer;
  try {
    bytes = await input.readObject(key);
  } catch (err) {
    // MÊME décision 404-vs-le-reste que la sonde d'existence, et au MÊME
    // endroit : un 403 sur un jeton révoqué ne doit jamais se lire « la
    // pièce a disparu ».
    const kind = classifyHeadError(err);
    return kind === "absent"
      ? refuse("object_absent", `objet introuvable dans le stockage: ${key} (${describeError(err)})`)
      : refuse("object_unreadable", `objet illisible: ${key} (${describeError(err)})`);
  }

  if (!bytes || bytes.length === 0) {
    return refuse("object_empty", `objet présent mais de taille nulle: ${key}`);
  }

  const recomputed = sha256Buffer(bytes);
  if (recomputed !== expected) {
    return refuse(
      "digest_mismatch",
      `les octets persistés ne produisent pas le hash attendu: ${key} — attendu ${expected}, relu ${recomputed} (${bytes.length} o)`,
    );
  }

  return { ok: true, sha256: recomputed, byteSize: bytes.length };
}
