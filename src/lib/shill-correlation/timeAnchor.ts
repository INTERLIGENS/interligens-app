// --- T1/T2/T3 — L'ANCRE TEMPORELLE : UTC, ET DÉMONTRÉE ------------------
//
// ██ CE QUE CE MODULE REMPLACE, ET POURQUOI ██
//
// B4 avait introduit `onChainAnchorFromCorpus`, qui AJOUTAIT l'offset
// Europe/Paris à tout timestamp du corpus. La justification était une mesure :
// « timestamp on-chain − firstSeenAt = 7 200 s, 896 signatures, variance
// nulle ». La constance était réelle. La conclusion était fausse.
//
// L'écart ne venait pas des données : il venait du LECTEUR. Les sondes
// interrogeaient la base avec le driver `pg`, qui interprète une colonne
// `timestamp without time zone` dans le fuseau LOCAL du process — Europe/Paris
// sur cette machine. Prisma, lui, l'interprète en UTC. Mesuré le 2026-09-04
// sur la même ligne :
//
//   valeur en base        2026-09-02 21:26:00
//   snowflake (vérité)    2026-09-02T21:26:00.192Z
//   lue par pg            2026-09-02T19:26:00.000Z   ← écart 2 h
//   lue par Prisma        2026-09-02T21:26:00.000Z   ← écart 0
//
// Relu via Prisma, le corpus de juin est à ZÉRO d'écart sur 148 des 169 lignes
// à tweetId exploitable. Il n'y avait rien à compenser. La compensation, elle,
// décalait de 2 h des instants qui étaient justes.
//
// ─── LA CORRECTION EST UNE SOURCE DE VÉRITÉ, PAS UN OFFSET ──────────────
//
// Un ID de post X est un « snowflake » : ses 42 bits de poids fort ENCODENT
// l'instant de publication, en millisecondes depuis l'epoch Twitter. Il ne
// dépend d'aucun fuseau, d'aucun driver, d'aucune convention de stockage.
// C'est la seule ancre que rien ne peut décaler.
//
// D'où la hiérarchie : le snowflake quand il existe, le timestamp source
// sinon — et la provenance dit toujours lequel a été retenu.
//
// AUCUNE CONSTANTE DE CORRECTION dans ce fichier. Ni 7200, ni 3600, ni fuseau.
// Un décalage qu'on compense est un décalage qu'on cesse de voir.

/** Epoch Twitter/X, en millisecondes. Constante du protocole, pas un réglage. */
const X_SNOWFLAKE_EPOCH_MS = 1288834974657n;

/** Un ID X exploitable : que des chiffres, longueur plausible. */
const SNOWFLAKE_RE = /^[0-9]{15,25}$/;

export type AnchorProvenance =
  /** Dérivée du tweetId — indépendante de tout fuseau. La meilleure. */
  | "snowflake"
  /** Le timestamp source, faute de snowflake exploitable. */
  | "source_timestamp";

export interface ResolvedAnchor {
  /** L'instant, en UTC vrai. */
  at: Date;
  provenance: AnchorProvenance;
  /**
   * Écart, en secondes, entre le timestamp source et le snowflake.
   * `null` quand l'un des deux manque. C'est le nombre que l'invariant lit.
   */
  driftSeconds: number | null;
}

/**
 * L'instant encodé dans un ID X. `null` si l'ID n'est pas un snowflake.
 *
 * Aucune dépendance au fuseau du process : c'est de l'arithmétique sur des
 * bits, et le résultat est un instant absolu.
 */
export function snowflakeToDate(tweetId: string | null | undefined): Date | null {
  const id = (tweetId ?? "").trim();
  if (!SNOWFLAKE_RE.test(id)) return null;
  try {
    const ms = (BigInt(id) >> 22n) + X_SNOWFLAKE_EPOCH_MS;
    const d = new Date(Number(ms));
    // Un snowflake antérieur à l'epoch, ou absurdement futur, n'est pas une
    // ancre : mieux vaut rendre null que de propager une date impossible.
    if (!Number.isFinite(d.getTime())) return null;
    if (d.getTime() < Date.UTC(2006, 0, 1)) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * L'ANCRE CANONIQUE d'un post.
 *
 * Le snowflake d'abord — il ne peut pas être décalé. Le timestamp source
 * ensuite, et sa provenance est alors DITE, pour qu'un lecteur sache que
 * l'ancre dépend de la façon dont la colonne a été lue.
 */
export function resolvePostAnchor(input: {
  tweetId?: string | null;
  sourceTimestamp?: Date | null;
}): ResolvedAnchor | null {
  const snow = snowflakeToDate(input.tweetId);
  const src = input.sourceTimestamp ?? null;

  const driftSeconds =
    snow && src ? Math.round((snow.getTime() - src.getTime()) / 1000) : null;

  if (snow) return { at: snow, provenance: "snowflake", driftSeconds };
  if (src) return { at: new Date(src.getTime()), provenance: "source_timestamp", driftSeconds };
  return null;
}

// ═══ T2 — L'INVARIANT SNOWFLAKE ═══════════════════════════════════════════

/**
 * Tolérance de l'invariant, en secondes.
 *
 * L'ordre de grandeur compte : à la SECONDE, pas à la minute. Un décalage de
 * fuseau vaut 3 600 s ou 7 200 s ; une troncature de millisecondes vaut moins
 * d'une seconde. 2 s laisse passer la seconde, refuse le fuseau, et refuse
 * aussi les décalages fins qu'une tolérance en minutes aurait absorbés sans
 * qu'on les voie.
 */
export const SNOWFLAKE_DRIFT_TOLERANCE_SECONDS = 2;

export class SnowflakeDriftError extends Error {
  readonly tweetId: string;
  readonly stored: Date;
  readonly snowflake: Date;
  readonly driftSeconds: number;

  constructor(tweetId: string, stored: Date, snowflake: Date, driftSeconds: number, where: string) {
    super(
      `[shill] ${where} — REFUS D'ÉCRITURE : tweetTimestamp diverge du snowflake ` +
        `de ${driftSeconds} s (tolérance ${SNOWFLAKE_DRIFT_TOLERANCE_SECONDS} s).\n` +
        `  tweetId    ${tweetId}\n` +
        `  stocké     ${stored.toISOString()}\n` +
        `  snowflake  ${snowflake.toISOString()}\n` +
        `L'ID du post encode son instant de publication : il ne dépend d'aucun ` +
        `fuseau. Une divergence signale un aller-retour de fuseau à la lecture, ` +
        `pas une donnée douteuse. La ligne n'est PAS corrigée en silence — ` +
        `corriger ici masquerait la cause et la laisserait produire d'autres lignes.`,
    );
    this.name = "SnowflakeDriftError";
    this.tweetId = tweetId;
    this.stored = stored;
    this.snowflake = snowflake;
    this.driftSeconds = driftSeconds;
  }
}

/**
 * ██ L'INVARIANT, À LA FRONTIÈRE D'ÉCRITURE ██
 *
 * Lève quand le timestamp diverge du snowflake au-delà de la tolérance.
 * Ne corrige RIEN : ni ici, ni ailleurs. Un accept-puis-compense ferait
 * exactement ce que B4 a fait — traiter le symptôme et perdre la cause.
 *
 * Sans snowflake exploitable, l'invariant ne s'applique pas : il ne peut pas
 * juger ce qu'il ne peut pas vérifier, et prétendre le contraire refuserait
 * des lignes légitimes.
 *
 * Coût externe : zéro. C'est de l'arithmétique locale.
 */
export function assertSnowflakeConsistency(
  row: { tweetId: string | null | undefined; tweetTimestamp: Date | null | undefined },
  where = "assertSnowflakeConsistency",
): { checked: boolean; driftSeconds: number | null } {
  const snow = snowflakeToDate(row.tweetId);
  const ts = row.tweetTimestamp ?? null;
  if (!snow || !ts) return { checked: false, driftSeconds: null };

  const drift = Math.round((snow.getTime() - ts.getTime()) / 1000);
  if (Math.abs(drift) > SNOWFLAKE_DRIFT_TOLERANCE_SECONDS) {
    throw new SnowflakeDriftError(String(row.tweetId), ts, snow, drift, where);
  }
  return { checked: true, driftSeconds: drift };
}

/** Forme non levante — pour compter, auditer, rapporter. */
export function checkSnowflakeConsistency(row: {
  tweetId: string | null | undefined;
  tweetTimestamp: Date | null | undefined;
}): { checked: boolean; ok: boolean; driftSeconds: number | null } {
  const snow = snowflakeToDate(row.tweetId);
  const ts = row.tweetTimestamp ?? null;
  if (!snow || !ts) return { checked: false, ok: true, driftSeconds: null };
  const drift = Math.round((snow.getTime() - ts.getTime()) / 1000);
  return { checked: true, ok: Math.abs(drift) <= SNOWFLAKE_DRIFT_TOLERANCE_SECONDS, driftSeconds: drift };
}
