/**
 * RECENSEMENT D'INTÉGRITÉ — chaîne de conservation, E-RC INTEGRITY.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * Mesuré le 2026-09-12 : 1 103 lignes `EvidenceItem` portent un `r2Key`,
 * 1 103 portent un `sha256`, ZÉRO n'en manque. Et cette empreinte n'a JAMAIS
 * été opposée aux octets, par aucun chemin exécuté :
 *
 *   `verifyManifest`  recalcule — mais contre un répertoire LOCAL, et son seul
 *                     appelant est une CLI manuelle.
 *   `bytesProbe`      regarde R2 — mais `HeadObject` seul, ZÉRO OCTET LU.
 *   l'ingestion       hache le buffer AVANT l'envoi, puis écrit `r2Key` sans
 *                     jamais relire (`ingest.ts:190-196`).
 *
 * Les deux invariants qui gouvernent ce fichier :
 *
 *   « A stored digest becomes integrity evidence only when it is independently
 *     recomputed from the persisted bytes it purports to authenticate. »
 *
 *   « Integrity at birth requires reading the persisted object back; hashing
 *     the pre-upload buffer proves the input, not the stored object. »
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE RECALCUL N'EST PAS INJECTABLE. Ce module importe `sha256Buffer` en dur.
 * Passer la fonction de hachage en paramètre — comme `headObject` l'est dans
 * `bytesProbe` — rendrait le recalcul substituable, donc l'invariant
 * contournable par le câblage. L'appelant fournit les OCTETS et l'ATTENDU ;
 * il ne fournit jamais la mesure.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * CONTRE QUOI ON COMPARE — et pourquoi il faut DEUX cibles
 * --------------------------------------------------------
 * Le segment de clé `evidence/<aa>/<sha256>` et la colonne `sha256` viennent de
 * LA MÊME écriture d'ingestion : les opposer l'un à l'autre est un accord NOM
 * contre NOM, et il n'atteste rien (mesuré : 1 071/1 071 concordent).
 *
 * La colonne est donc le PLANCHER — elle est l'affirmation du registre, et la
 * recalculer contre les octets satisfait l'invariant à la lettre.
 *
 * Le TOKEN TSA est l'ARBITRE. Il vient d'un tiers, il est vérifiable HORS
 * LIGNE (chaîne de certificats archivée dans la ligne), et il coûte zéro
 * réseau. Sans lui, toute divergence accuse les octets PAR DÉFAUT, faute
 * d'arbitre. Avec lui, « c'est la COLONNE qui a tort » devient un verdict
 * décidable — `DIVERGENT_REGISTRY_SUSPECT` — au lieu d'une opinion.
 *
 * Population mesurée : 1 070/1 104 pièces portent un TSA. Les 34 sans TSA ne
 * sont PAS invalides : elles retombent sur le plancher et sont rendues sous un
 * verdict qui le DIT — `VERIFIED_UNANCHORED`. Jamais confondues avec les
 * ancrées, jamais comptées comme un échec.
 *
 * FAIL-CLOSED — mêmes règles que la sonde d'existence, un cran plus haut
 * ---------------------------------------------------------------------
 *   1. Une lecture qui échoue autrement que par un 404 est une NON-OBSERVATION
 *      (`UNREADABLE`), jamais une divergence, jamais un OK.
 *   2. Une lecture INSTABLE — deux lectures successives qui ne se ressemblent
 *      pas — est une non-observation, pas une divergence. On n'escalade sur
 *      des octets qu'après deux lectures concordantes.
 *   3. Un périmètre vide n'est pas un périmètre sain (`nothing_expected`).
 *   4. LA RÉCONCILIATION EST UNE CONDITION DE VALIDITÉ, pas une décoration :
 *         recalculés + absents connus + non observés = attendus
 *      Si la somme ne tombe pas, le rapport est UNABLE — quel que soit le
 *      nombre de divergences trouvées. C'est ce qui interdit à « 0 divergence »
 *      de vouloir dire « 0 objet regardé ».
 *
 * CE MODULE N'ÉCRIT RIEN, ET IL EN EST STRUCTURELLEMENT INCAPABLE
 * ---------------------------------------------------------------
 * Aucun client S3, aucun accès base, aucune capacité d'écriture injectée. Il
 * reçoit DEUX fonctions — lire des octets, vérifier un token hors ligne — et
 * il ne peut rien faire d'autre. Aucune correction d'octets n'est possible
 * depuis ici, même par erreur de câblage. Un test le vérifie sur le SOURCE.
 */
import { sha256Buffer } from "./hash";
import { eligibleForEvidenceChain } from "./eligibility";

// ─── Ce que le registre affirme ─────────────────────────────────────────────

/** Une ligne `EvidenceItem` portant un `r2Key`, telle que le runner la rend. */
export interface RegistryRow {
  id: string;
  r2Key: string;
  /** La colonne. Mesuré : non vide sur 1 103/1 103. */
  sha256: string;
  byteSize: number | null;
  mimeType: string | null;
  /** ISO. Instant d'insertion de la LIGNE — l'objet est écrit juste après. */
  ingestedAt: string;
  /** NULL | EXCLUDED | BYTES_LOST | … */
  evidentiaryStatus: string | null;
  /** L'arbitre, quand il existe. NULL pour 34 pièces mesurées. */
  tsa: { tokenB64: string; certChainPem: string } | null;
}

// ─── Les deux seules capacités injectées ────────────────────────────────────

/** Les octets REELLEMENT rangés sous cette clé, tels que le stockage les rend. */
export interface FetchedObject {
  bytes: Buffer;
  /** La comptabilité que le STOCKAGE fait des octets qu'il détient. */
  contentLength: number | null;
  /** ISO. Dernière écriture constatée côté stockage. */
  lastModified: string | null;
  /** Empreinte calculée par le stockage (MD5 si envoi mono-part). */
  etag: string | null;
}

export type FetchBytesFn = (key: string) => Promise<FetchedObject>;

/** Vérification TSA HORS LIGNE : (empreinte, token, chaîne archivée) → ok. */
export type VerifyTsaFn = (
  digestHex: string,
  tokenB64: string,
  certChainPem: string,
) => Promise<boolean>;

// ─── Les verdicts ───────────────────────────────────────────────────────────

/**
 * Onze verdicts, et aucun `FAIL` générique. Un échec sans nom rendrait la
 * question « invalide, corrompu, ou remplacé ? » indécidable — et les trois
 * appellent des conduites différentes, dont AUCUNE n'est « supprimer ».
 */
export type ItemVerdict =
  /** Octets = colonne, ET un tiers atteste l'empreinte. Le plein énoncé. */
  | "VERIFIED_ANCHORED"
  /** Octets = colonne, aucun TSA disponible. Intégrité plancher, ancrage absent. */
  | "VERIFIED_UNANCHORED"
  /** Octets = colonne, mais le token tiers ne vérifie pas. L'artefact va bien. */
  | "ANCHOR_BROKEN"
  /** Octets ≠ colonne, MAIS le tiers atteste les octets LUS : la colonne a tort. */
  | "DIVERGENT_REGISTRY_SUSPECT"
  /** Octets ≠ colonne, et plus courts que ce que le registre déclare. */
  | "DIVERGENT_TRUNCATED"
  /** Octets ≠ colonne, taille pleine, et une ÉCRITURE a eu lieu après ingestion. */
  | "DIVERGENT_SUBSTITUTED"
  /** Octets ≠ colonne, aucune écriture constatée. Dégradation, ou mauvaise écriture d'origine. */
  | "DIVERGENT_CORRUPTED"
  /** Clé absente, ligne NON étiquetée. La classe du 2026-08-19. */
  | "ABSENT_UNDECLARED"
  /** Clé absente, absence DÉJÀ déclarée au registre. Pas une divergence. */
  | "ABSENT_KNOWN"
  /** Une absence déclarée qui RÉPOND. Une pièce perdue qui revient est une écriture inexpliquée. */
  | "ABSENT_KNOWN_REAPPEARED"
  /** Je n'ai pas pu observer. Ni OK, ni divergence. */
  | "UNREADABLE";

/**
 * La liste CANONIQUE, disponible à l'exécution.
 *
 * Elle existe pour que la règle « tout verdict est rangé dans exactement un
 * seau de la réconciliation » soit éprouvable SUR LES VALEURS, et non par une
 * expression régulière lue sur ce fichier — un contrôle qui inspecte son
 * propre source se casse à la première virgule déplacée, et se casse en
 * rendant VERT ce qu'il ne sait plus lire.
 */
export const TOUS_LES_VERDICTS: readonly ItemVerdict[] = Object.freeze([
  "VERIFIED_ANCHORED",
  "VERIFIED_UNANCHORED",
  "ANCHOR_BROKEN",
  "DIVERGENT_REGISTRY_SUSPECT",
  "DIVERGENT_TRUNCATED",
  "DIVERGENT_SUBSTITUTED",
  "DIVERGENT_CORRUPTED",
  "ABSENT_UNDECLARED",
  "ABSENT_KNOWN",
  "ABSENT_KNOWN_REAPPEARED",
  "UNREADABLE",
] as const);

/** Les verdicts qui ne sont ni un constat sain ni une absence attendue. */
const VERDICTS_INCIDENT: ReadonlySet<ItemVerdict> = new Set<ItemVerdict>([
  "ANCHOR_BROKEN",
  "DIVERGENT_REGISTRY_SUSPECT",
  "DIVERGENT_TRUNCATED",
  "DIVERGENT_SUBSTITUTED",
  "DIVERGENT_CORRUPTED",
  "ABSENT_UNDECLARED",
  "ABSENT_KNOWN_REAPPEARED",
]);

/** Les verdicts qui attestent les octets. `UNANCHORED` en fait partie : GPT a
 *  borné le contrat — l'absence de TSA n'invalide RIEN, elle affaiblit l'énoncé. */
const VERDICTS_RECALCULES: ReadonlySet<ItemVerdict> = new Set<ItemVerdict>([
  "VERIFIED_ANCHORED",
  "VERIFIED_UNANCHORED",
  "ANCHOR_BROKEN",
  "DIVERGENT_REGISTRY_SUSPECT",
  "DIVERGENT_TRUNCATED",
  "DIVERGENT_SUBSTITUTED",
  "DIVERGENT_CORRUPTED",
]);

export function isIncidentVerdict(v: ItemVerdict): boolean {
  return VERDICTS_INCIDENT.has(v);
}

/**
 * ⚠️ DEUX NOTIONS QUE J'AVAIS CONFONDUES, ET LE RECENSEMENT L'A DIT
 * ─────────────────────────────────────────────────────────────────
 * Première exécution en vif, 2026-09-12, 20 premières clés `evidence/` :
 * `evidence/00/004306fc…` est étiquetée `EXCLUDED` et son objet RÉPOND. Ma
 * première version en faisait « une pièce perdue qui revient ». C'était faux,
 * et c'était le glissement sémantique lui-même :
 *
 *   `BYTES_LOST` est une affirmation sur LES OCTETS — ils ne sont plus là.
 *   `EXCLUDED`   est une décision de GOUVERNANCE — la pièce ne participe pas
 *                à la chaîne active (S4 : 5 conteneurs ZIP, 2 `.DS_Store`).
 *                Elle ne dit RIEN des octets, qui existent le plus souvent :
 *                8 des 9 lignes `EXCLUDED` portent des octets bien vivants.
 *
 * Les deux gouvernent donc des faces différentes, et une seule chacune.
 */

/**
 * Face ABSENCE. Les deux statuts sous lesquels une clé absente est une absence
 * CONNUE, jamais une divergence d'intégrité — c'est le ruling (d) : les deux
 * références mortes mesurées sont étiquetées, et ce sont des absences, pas des
 * altérations.
 *
 * Liste blanche, comme `eligibility.ts` : un statut futur inconnu ne devient
 * jamais « absence attendue » par défaut.
 */
const STATUTS_ABSENCE_TOLEREE: ReadonlySet<string> = new Set(["BYTES_LOST", "EXCLUDED"]);

export function absenceEstDeclaree(row: Pick<RegistryRow, "evidentiaryStatus">): boolean {
  const s = row.evidentiaryStatus;
  return s !== null && STATUTS_ABSENCE_TOLEREE.has(s);
}

/**
 * Face PRÉSENCE. Le seul statut qui AFFIRME que les octets ont disparu — donc
 * le seul dont la présence est un constat. Une pièce `EXCLUDED` qui répond est
 * le cas NORMAL ; une pièce `BYTES_LOST` qui répond est une écriture que
 * personne n'a expliquée.
 */
const STATUTS_ABSENCE_AFFIRMEE: ReadonlySet<string> = new Set(["BYTES_LOST"]);

export function absenceEstAffirmee(row: Pick<RegistryRow, "evidentiaryStatus">): boolean {
  const s = row.evidentiaryStatus;
  return s !== null && STATUTS_ABSENCE_AFFIRMEE.has(s);
}

/**
 * L'objet est écrit APRÈS l'insertion de la ligne : `ingest.ts` insère en :167
 * et appelle `putEvidenceObject` en :193, dans la même requête. `lastModified`
 * est donc LÉGITIMEMENT postérieur à `ingestedAt`, de quelques secondes.
 *
 * Une heure est large, et c'est voulu : ce seuil ne sert pas à dater finement,
 * il sert à distinguer « l'écriture de l'ingestion » de « quelqu'un a écrit
 * plus tard ». Le prix est dit : une substitution survenue DANS l'heure suivant
 * l'ingestion serait classée `CORRUPTED` au lieu de `SUBSTITUTED`. C'est une
 * ERREUR DE CLASSE, jamais un silence — la divergence est rendue dans les deux cas.
 */
export const TOLERANCE_ECRITURE_APRES_INGESTION_MS = 3_600_000;

// ─── Le rapport ─────────────────────────────────────────────────────────────

export interface ItemOutcome {
  id: string;
  key: string;
  verdict: ItemVerdict;
  /** L'empreinte RECALCULÉE sur les octets relus. Absente si rien n'a été lu. */
  recomputedSha256?: string;
  /** L'empreinte que le registre AFFIRME. Toujours rendue : le rapport se relit. */
  registrySha256: string;
  observedBytes?: number;
  registryBytes: number | null;
  lastModified?: string | null;
  etag?: string | null;
  /** null = aucun TSA ; true/false = l'arbitre a été consulté. */
  tsaAttesteLesOctets?: boolean | null;
  tsaAttesteLaColonne?: boolean | null;
  /** true/false/null — null = type non jugeable. JAMAIS un discriminant de classe. */
  bienForme?: boolean | null;
  /**
   * La pièce participe-t-elle à la chaîne probatoire ACTIVE ? Dérivé de
   * `eligibility.ts` — la liste blanche canonique, pas un prédicat réécrit ici.
   * Une pièce EXCLUDED est vérifiée comme les autres, et son compte est tenu
   * À PART : elle ne renforce ni n'affaiblit l'énoncé de la chaîne active.
   */
  horsChaineActive: boolean;
  detail: string;
}

export interface Probleme {
  verdict: ItemVerdict;
  severite: "incident" | "unable";
  id: string;
  key: string;
  detail: string;
}

export interface Reconciliation {
  attendus: number;
  recalcules: number;
  /** Informatif : la part du recalcul qui porte sur la chaîne ACTIVE. */
  recalculesChaineActive: number;
  /** Informatif : la part hors chaîne (EXCLUDED, statut inconnu). Jamais fondue. */
  recalculesHorsChaine: number;
  absentsConnus: number;
  nonObserves: number;
  somme: number;
  /** FAUX ⇒ le rapport entier est UNABLE. Condition de validité. */
  equilibre: boolean;
}

export interface CensusReport {
  verdict: "OK" | "INCIDENT" | "UNABLE";
  /** false dès qu'une partie du périmètre n'a pas pu être observée. */
  complete: boolean;
  reconciliation: Reconciliation;
  parVerdict: Record<string, number>;
  items: ItemOutcome[];
  problemes: Probleme[];
  /** Octets d'objet RÉELLEMENT lus. Le coût du recensement, rendu, pas estimé. */
  octetsLus: number;
  /** Périmètre déclaré non observé — jamais tu par omission. */
  horsPerimetre: { count: number; reason: string } | null;
}

export interface CensusInput {
  rows: RegistryRow[];
  fetchBytes: FetchBytesFn;
  verifyTsa: VerifyTsaFn;
  horsPerimetre?: { count: number; reason: string } | null;
  /** Notifié après chaque pièce — pour la progression d'un long recensement. */
  onProgress?: (done: number, total: number, outcome: ItemOutcome) => void;
}

// ─── Classification des erreurs de lecture ──────────────────────────────────

/**
 * Un échec de lecture veut dire DEUX choses très différentes, et les confondre
 * est la faute que tout ce chantier répare.
 *
 *   404 / NotFound / NoSuchKey  → l'objet n'est PAS là. Fait observé.
 *   tout le reste               → je n'ai pas pu regarder. Non-observation.
 */
export function classifyFetchError(err: unknown): "absent" | "unreadable" {
  const e = err as
    | { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
    | undefined;
  const status = e?.$metadata?.httpStatusCode;
  if (status === 404) return "absent";
  if (status !== undefined) return "unreadable";
  const name = e?.name ?? e?.Code ?? "";
  if (name === "NotFound" || name === "NoSuchKey") return "absent";
  return "unreadable";
}

function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  return `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`;
}

// ─── Bonne formation : CORROBORATION, jamais discriminant ───────────────────

/**
 * Les octets ressemblent-ils au type déclaré ? Rendu dans le rapport comme
 * DÉTAIL, et volontairement JAMAIS utilisé pour choisir une classe : une
 * heuristique de nombres magiques n'a pas à décider si une pièce est corrompue
 * ou substituée. `null` = ce type n'est pas jugé ici, et on le dit.
 */
export function bienFormePourMime(bytes: Buffer, mimeType: string | null): boolean | null {
  if (!mimeType) return null;
  const t = mimeType.toLowerCase();
  if (t.includes("png")) {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (t.includes("pdf")) {
    return bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  }
  if (t.includes("jpeg") || t.includes("jpg")) {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return null;
}

// ─── Le cœur : une pièce ────────────────────────────────────────────────────

/**
 * L'arbre de décision, écrit une fois, dans l'ordre où les discriminants sont
 * disponibles. Chaque branche est décidable sur un FAIT OBSERVÉ — la longueur,
 * la date d'écriture du stockage, le verdict du tiers — jamais sur une intuition.
 */
async function verifierUnePiece(
  row: RegistryRow,
  input: CensusInput,
): Promise<ItemOutcome> {
  const base = {
    id: row.id,
    key: row.r2Key,
    registrySha256: row.sha256,
    registryBytes: row.byteSize,
    horsChaineActive: !eligibleForEvidenceChain(row),
  };

  // ── 1. Lire. Un échec ≠ 404 n'est JAMAIS une divergence. ────────────────
  let lu: FetchedObject;
  try {
    lu = await input.fetchBytes(row.r2Key);
  } catch (err) {
    if (classifyFetchError(err) === "absent") {
      // L'ABSENCE ATTENDUE. La ligne porte déjà son étiquette : ce n'est pas
      // une altération, c'est une absence connue. Elle reste DANS le périmètre —
      // l'en retirer ferait rendre « 1 101/1 101 OK », un périmètre qui guérit
      // en oubliant.
      if (absenceEstDeclaree(row)) {
        return { ...base, verdict: "ABSENT_KNOWN", detail: `absence déjà déclarée au registre (${row.evidentiaryStatus})` };
      }
      return { ...base, verdict: "ABSENT_UNDECLARED", detail: "objet attendu introuvable, et AUCUNE étiquette au registre" };
    }
    return { ...base, verdict: "UNREADABLE", detail: describeError(err) };
  }

  // ── 2. L'assertion à DEUX FACES — mais seulement pour `BYTES_LOST` ──────
  // Une pièce dont on AFFIRME que les octets ont disparu, et qui RÉPOND, n'est
  // pas une bonne nouvelle : c'est une écriture que personne n'a expliquée.
  // Même logique que le canari de la sonde — une clé dont l'existence EST le
  // problème. `EXCLUDED`, lui, n'a jamais rien affirmé sur les octets : une
  // pièce exclue qui répond suit le chemin normal, et son verdict portera
  // simplement qu'elle est hors de la chaîne active.
  if (absenceEstAffirmee(row)) {
    return {
      ...base,
      verdict: "ABSENT_KNOWN_REAPPEARED",
      observedBytes: lu.bytes.length,
      lastModified: lu.lastModified,
      etag: lu.etag,
      detail: `ligne étiquetée ${row.evidentiaryStatus} — l'objet RÉPOND. Écriture inexpliquée.`,
    };
  }

  // ── 3. LE RECALCUL. Non injectable : voir l'en-tête. ────────────────────
  const recompute = sha256Buffer(lu.bytes);
  const commun = {
    ...base,
    recomputedSha256: recompute,
    observedBytes: lu.bytes.length,
    lastModified: lu.lastModified,
    etag: lu.etag,
    bienForme: bienFormePourMime(lu.bytes, row.mimeType),
  };

  // ── 4. Accord avec la colonne : reste l'ANCRAGE ─────────────────────────
  if (recompute === row.sha256) {
    if (!row.tsa) {
      // Le contrat borné : PAS d'invalidation automatique. Intégrité plancher,
      // ancrage indisponible, et l'énoncé le dit au lieu de le taire.
      return { ...commun, tsaAttesteLesOctets: null, tsaAttesteLaColonne: null, verdict: "VERIFIED_UNANCHORED", detail: "octets = colonne ; aucun TSA sur cette ligne — intégrité attestée, ancrage tiers indisponible" };
    }
    const ok = await input.verifyTsa(recompute, row.tsa.tokenB64, row.tsa.certChainPem);
    if (ok) {
      return { ...commun, tsaAttesteLesOctets: true, tsaAttesteLaColonne: true, verdict: "VERIFIED_ANCHORED", detail: "octets = colonne, et un tiers atteste l'empreinte" };
    }
    // Les octets et le registre s'accordent ; c'est l'ATTESTATION qui est
    // rompue. Classe distincte, conduite distincte : un ré-horodatage
    // attesterait d'AUJOURD'HUI en se faisant passer pour la date d'origine.
    return { ...commun, tsaAttesteLesOctets: false, tsaAttesteLaColonne: false, verdict: "ANCHOR_BROKEN", detail: "octets = colonne, mais le token TSA ne vérifie pas — ne PAS ré-horodater en silence" };
  }

  // ── 5. DIVERGENCE. Deux lectures concordantes avant d'escalader. ────────
  // Une lecture instable est un défaut d'OBSERVATION jusqu'à preuve qu'elle est
  // un défaut de STOCKAGE. On ne déclare pas une pièce divergente sur un
  // transfert qui bafouille.
  let seconde: FetchedObject;
  try {
    seconde = await input.fetchBytes(row.r2Key);
  } catch (err) {
    return { ...commun, verdict: "UNREADABLE", detail: `divergence à la 1re lecture, 2e lecture impossible — ${describeError(err)}` };
  }
  const recompute2 = sha256Buffer(seconde.bytes);
  if (recompute2 !== recompute) {
    return { ...commun, verdict: "UNREADABLE", detail: `lecture INSTABLE — deux lectures rendent ${recompute.slice(0, 12)}… puis ${recompute2.slice(0, 12)}… Non-observation, pas une divergence.` };
  }

  // ── 6. L'ARBITRE, d'abord. C'est lui qui dit DE QUEL CÔTÉ est l'erreur. ──
  if (row.tsa) {
    const tiersAtteste = await input.verifyTsa(recompute, row.tsa.tokenB64, row.tsa.certChainPem);
    if (tiersAtteste) {
      // Les octets sont ceux qui ont été HORODATÉS. La colonne est la partie
      // déviante. On corrige LE REGISTRE, jamais les octets — et pas ici.
      return { ...commun, tsaAttesteLesOctets: true, tsaAttesteLaColonne: false, verdict: "DIVERGENT_REGISTRY_SUSPECT", detail: "octets ≠ colonne, MAIS le tiers atteste les octets LUS — la colonne est suspecte, pas les octets" };
    }
  }
  // L'arbitre est interrogé sur LES DEUX cibles, et seulement ici — le coût
  // (une vérification hors ligne de plus) ne se paie que sur une divergence.
  // S'il atteste la COLONNE sans attester les octets, la partie déviante est
  // établie : ce sont les octets. C'est la différence entre « ils ne
  // s'accordent pas » et « voici lequel des deux a bougé ».
  const tsaVu = row.tsa
    ? {
        tsaAttesteLesOctets: false,
        tsaAttesteLaColonne: await input.verifyTsa(row.sha256, row.tsa.tokenB64, row.tsa.certChainPem),
      }
    : { tsaAttesteLesOctets: null, tsaAttesteLaColonne: null };

  // ── 7. Longueur : le discriminant de la troncature. ─────────────────────
  if (row.byteSize !== null && lu.bytes.length < row.byteSize) {
    return { ...commun, ...tsaVu, verdict: "DIVERGENT_TRUNCATED", detail: `octets ≠ colonne, ${lu.bytes.length} octets lus contre ${row.byteSize} déclarés — lecture stable sur deux passes` };
  }

  // ── 8. Date d'écriture : le discriminant de la substitution. ────────────
  const ecritureApres = ecriturePosterieureAIngestion(lu.lastModified, row.ingestedAt);
  if (ecritureApres) {
    return { ...commun, ...tsaVu, verdict: "DIVERGENT_SUBSTITUTED", detail: `octets ≠ colonne, taille pleine, et une écriture a eu lieu le ${lu.lastModified} — postérieure à l'ingestion (${row.ingestedAt})` };
  }

  // ── 9. Aucune écriture constatée. Dégradation — ou mauvaise écriture
  //      d'origine, hypothèse PLEINEMENT ouverte tant que l'ingestion ne
  //      relit pas son PUT (L-c).
  return { ...commun, ...tsaVu, verdict: "DIVERGENT_CORRUPTED", detail: "octets ≠ colonne, aucune écriture constatée depuis l'ingestion — dégradation, ou écriture d'origine jamais vérifiée" };
}

/** Vrai seulement si l'écriture est trop tardive pour être celle de l'ingestion. */
export function ecriturePosterieureAIngestion(
  lastModified: string | null,
  ingestedAt: string,
): boolean {
  if (!lastModified) return false;
  const lm = Date.parse(lastModified);
  const ing = Date.parse(ingestedAt);
  if (Number.isNaN(lm) || Number.isNaN(ing)) return false;
  return lm - ing > TOLERANCE_ECRITURE_APRES_INGESTION_MS;
}

// ─── La réconciliation — et pourquoi elle n'est pas une tautologie ──────────

/**
 * `recalculés + absents connus + non observés = attendus`.
 *
 * ⚠️ CE CONTRÔLE SERAIT CREUX s'il se contentait de répartir les verdicts
 * produits : les trois seaux couvrent les onze verdicts, donc leur somme vaut
 * TOUJOURS `items.length`. Ce qu'il compare réellement, c'est `items.length`
 * à `attendus` — c'est-à-dire au nombre de lignes que le REGISTRE a demandé
 * d'examiner. Il mord donc sur les deux seules façons dont un rapport peut
 * mentir par omission :
 *
 *   1. une ligne n'a produit AUCUN verdict (boucle interrompue, filtre, sortie
 *      anticipée) → la somme est inférieure aux attendus ;
 *   2. un verdict FUTUR aura été ajouté à `ItemVerdict` sans être rangé dans
 *      un seau → il disparaît de la somme, et le rapport devient UNABLE au
 *      lieu de compter une pièce inconnue comme saine.
 *
 * Exporté pour être éprouvé directement : un contrôle de non-vacuité qui ne
 * peut pas être mis en échec en test n'est pas un contrôle.
 */
export function reconcilier(
  items: readonly { verdict: ItemVerdict; horsChaineActive?: boolean }[],
  attendus: number,
): Reconciliation {
  const recalculesTous = items.filter((i) => VERDICTS_RECALCULES.has(i.verdict));
  const recalcules = recalculesTous.length;
  const recalculesHorsChaine = recalculesTous.filter((i) => i.horsChaineActive === true).length;
  const recalculesChaineActive = recalcules - recalculesHorsChaine;
  const absentsConnus = items.filter((i) => i.verdict === "ABSENT_KNOWN").length;
  // `ABSENT_UNDECLARED` n'est ni une absence connue ni un recalcul : c'est une
  // rupture référentielle. Du point de vue de l'INTÉGRITÉ elle est une
  // non-observation — il n'existe aucun octet à opposer à l'empreinte.
  const nonObserves = items.filter(
    (i) => i.verdict === "UNREADABLE" || i.verdict === "ABSENT_UNDECLARED" || i.verdict === "ABSENT_KNOWN_REAPPEARED",
  ).length;
  const somme = recalcules + absentsConnus + nonObserves;
  return { attendus, recalcules, recalculesChaineActive, recalculesHorsChaine, absentsConnus, nonObserves, somme, equilibre: somme === attendus };
}

// ─── Le recensement ─────────────────────────────────────────────────────────

export async function recenserIntegrite(input: CensusInput): Promise<CensusReport> {
  const horsPerimetre = input.horsPerimetre ?? null;

  // Un périmètre vide n'est PAS un succès. Même piège que le compteur nº 4 du
  // watchdog : zéro ligne examinée rendrait zéro problème.
  if (input.rows.length === 0) {
    return {
      verdict: "UNABLE",
      complete: false,
      reconciliation: { attendus: 0, recalcules: 0, recalculesChaineActive: 0, recalculesHorsChaine: 0, absentsConnus: 0, nonObserves: 0, somme: 0, equilibre: false },
      parVerdict: {},
      items: [],
      problemes: [{ verdict: "UNREADABLE", severite: "unable", id: "-", key: "-", detail: "aucune ligne attendue — rien n'a été observé. Un périmètre vide ne vaut pas un périmètre sain." }],
      octetsLus: 0,
      horsPerimetre,
    };
  }

  const items: ItemOutcome[] = [];
  let octetsLus = 0;
  for (const row of input.rows) {
    const outcome = await verifierUnePiece(row, input);
    if (outcome.observedBytes) octetsLus += outcome.observedBytes;
    items.push(outcome);
    input.onProgress?.(items.length, input.rows.length, outcome);
  }

  const parVerdict: Record<string, number> = {};
  for (const it of items) parVerdict[it.verdict] = (parVerdict[it.verdict] ?? 0) + 1;

  const reconciliation = reconcilier(items, input.rows.length);

  const problemes: Probleme[] = items
    .filter((i) => isIncidentVerdict(i.verdict) || i.verdict === "UNREADABLE")
    .map((i) => ({
      verdict: i.verdict,
      severite: i.verdict === "UNREADABLE" ? ("unable" as const) : ("incident" as const),
      id: i.id,
      key: i.key,
      detail: i.detail,
    }));

  const aUnConstat = items.some((i) => isIncidentVerdict(i.verdict));
  const nonObservations = items.some((i) => i.verdict === "UNREADABLE");
  const complete = !nonObservations && reconciliation.equilibre;

  // La réconciliation est une CONDITION DE VALIDITÉ : si elle ne tombe pas, le
  // rapport ne peut rien affirmer, même s'il a trouvé des divergences.
  let verdict: CensusReport["verdict"];
  if (!reconciliation.equilibre) verdict = "UNABLE";
  else if (aUnConstat) verdict = "INCIDENT";
  else if (!complete) verdict = "UNABLE";
  else verdict = "OK";

  if (!reconciliation.equilibre) {
    problemes.unshift({
      verdict: "UNREADABLE",
      severite: "unable",
      id: "-",
      key: "-",
      detail: `RÉCONCILIATION ROMPUE : ${reconciliation.recalcules} + ${reconciliation.absentsConnus} + ${reconciliation.nonObserves} = ${reconciliation.somme} ≠ ${input.rows.length} attendus. Le rapport n'affirme rien.`,
    });
  }

  return { verdict, complete, reconciliation, parVerdict, items, problemes, octetsLus, horsPerimetre };
}

/** 0 seulement si OK. Tout le reste sort en échec — y compris UNABLE. */
export function exitCodeFor(report: CensusReport): number {
  return report.verdict === "OK" ? 0 : 1;
}

// ─── Rendu ──────────────────────────────────────────────────────────────────

function fmtOctets(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Kio`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mio`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} Gio`;
}

export function formatCensus(report: CensusReport): string {
  const r = report.reconciliation;
  const L: string[] = [];
  L.push(`VERDICT : ${report.verdict}`);
  L.push(`observation complète : ${report.complete ? "oui" : "NON"} · octets d'objet réellement lus : ${fmtOctets(report.octetsLus)}`);
  L.push("");
  L.push("RÉCONCILIATION — condition de validité, pas une décoration");
  L.push(`  recalculés ${r.recalcules} + absents connus ${r.absentsConnus} + non observés ${r.nonObserves} = ${r.somme}`);
  L.push(`  dont chaîne ACTIVE ${r.recalculesChaineActive} · hors chaîne (EXCLUDED, statut inconnu) ${r.recalculesHorsChaine} — jamais fondus`);
  L.push(`  attendus ${r.attendus} → ${r.equilibre ? "ÉQUILIBRÉE" : "ROMPUE — le rapport n'affirme rien"}`);
  if (report.horsPerimetre && report.horsPerimetre.count > 0) {
    L.push(`  ⚠️  HORS PÉRIMÈTRE : ${report.horsPerimetre.count} — ${report.horsPerimetre.reason}`);
  }
  L.push("");
  L.push("PAR VERDICT");
  for (const [v, n] of Object.entries(report.parVerdict).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${String(n).padStart(6)}  ${v}`);
  }
  if (report.problemes.length === 0) {
    L.push("");
    L.push("aucun constat.");
  } else {
    L.push("");
    for (const p of report.problemes) {
      L.push(`${p.severite === "incident" ? "🔴 CONSTAT " : "🟠 NON OBSERVÉ"}  [${p.verdict}] ${p.key}`);
      L.push(`             ${p.detail}`);
    }
  }
  return L.join("\n");
}
