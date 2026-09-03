// --- B3 — LE BRIDGE FORWARD : il COMPOSE, il n'implémente rien -----------
//
// ██ ÉTAT : ÉCRITURES RÉELLES NON ARMÉES. `dryRun` par défaut. ██
//
// Aucun appel Helius nulle part dans ce module. Le bridge relie une source
// sociale déjà capturée à `ShillEvent` ; le on-chain vient après, ailleurs.
//
// ─── LA COMPOSITION, ET RIEN D'AUTRE ─────────────────────────────────────
//
//   qualifyPromotion        (B2) — une mention n'est pas une promotion
//        ↓ qualifié
//   resolveTokenIdentity    (B1) — une adresse est une identité, pas un ticker
//        ↓
//   draft ShillEvent
//        ↓
//   persistShillEventDrafts (ingestion réutilisée) — createMany skipDuplicates
//
// Ce module ne REFAIT aucune des trois. C'est la seule raison d'être des trois
// builds précédents : une qualification réécrite ici et l'autre dans le cron
// auraient divergé au premier cas limite, et personne n'aurait su laquelle
// faisait foi.
//
// ─── KolPromotionMention EST COURT-CIRCUITÉE ─────────────────────────────
//
// Ni lue, ni écrite. Elle reste dormante (73 lignes, dernière écriture
// 2026-05-15). L'analyse de l'étape A l'a montré : elle ne porte aucun champ
// que `social_post_candidates` n'ait déjà, et y écrire des mentions dérivées
// par résolution contredirait sa déclaration au registre Data Nature
// (DECLARED / PRIMARY_OBSERVATION).
//
// ─── L'IDEMPOTENCE N'EST PAS DANS CE FICHIER ─────────────────────────────
//
// Elle est dans la base : UNIQUE (kolHandle, tweetId, tokenMint)
// NULLS NOT DISTINCT + `skipDuplicates`. Le bridge peut donc rejouer une
// fenêtre chevauchante sans précaution — et c'est voulu : une idempotence qui
// dépendrait d'un curseur exact casserait au premier redémarrage à froid.

import { qualifyPromotion, type PromotionQualification } from "./qualify";
import { resolveTokenIdentity } from "./tokenIdentity";
import { persistShillEventDrafts, type PersistDraftsResult } from "./ingest";
import { normalizeHandle } from "./ingest";
import { eligibleForSolanaEngine } from "./eligibility";
import { parseDetectedTokens } from "./parsing";
import type { ShillEventDraft } from "./types";
import type { QualifyCriterion } from "./qualify";

/** Une ligne de `social_post_candidates`, réduite à ce que le bridge lit. */
export interface ForwardCandidate {
  id: string;
  postId: string | null;
  postedAtUtc: Date | null;
  discoveredAtUtc: Date | null;
  chain: string | null;
  campaignId: string | null;
  ingestionMode: string | null;
  signalTypes: unknown;
  signalScore: number | null;
  detectedTokens: unknown;
  detectedAddresses: unknown;
  rawText: string | null;
  handle: string | null;
}

/**
 * LECTURE INJECTÉE. Le bridge ne choisit pas sa source : les tests lui passent
 * un tableau, la production un lecteur Prisma. Aucun `findMany` n'est écrit
 * ici, donc aucun test n'a besoin d'une base pour exercer le pipeline.
 */
export type ForwardCandidateReader = (args: {
  since: Date | null;
  limit: number;
}) => Promise<ForwardCandidate[]>;

/**
 * WATERMARK DÉRIVÉ, jamais stocké.
 *
 * Il se déduit d'un état DÉJÀ existant : le plus récent `discoveredAtUtc`
 * parmi les candidats qu'un `ShillEvent` référence déjà
 * (`ShillEvent.sourcePostCandidateId`). Aucune table de curseur, donc aucune
 * DDL, donc aucun chemin gelé.
 *
 * Un curseur persistant aurait été plus rapide et plus fragile : il peut
 * mentir après un rollback, alors qu'un watermark dérivé de l'état réel ne
 * peut pas être en avance sur ce qui a été écrit.
 */
export type WatermarkReader = () => Promise<Date | null>;

export interface ForwardBridgeOptions {
  readCandidates: ForwardCandidateReader;
  readWatermark?: WatermarkReader;
  /** Force la fenêtre. Prend le pas sur le watermark dérivé. */
  since?: Date | null;
  limit?: number;
  /** ██ DÉFAUT `true` : rien n'est écrit sans le dire. ██ */
  dryRun?: boolean;
  /** Recouvrement volontaire de la fenêtre, en minutes. */
  overlapMinutes?: number;
  persist?: typeof persistShillEventDrafts;
}

export interface ForwardBridgeReport {
  dryRun: boolean;
  windowSince: Date | null;
  watermarkBefore: Date | null;
  watermarkAfter: Date | null;
  examined: number;
  qualified: number;
  rejected: number;
  /** Refus par critère — l'observabilité compte les causes, pas les totaux. */
  rejectedByCriterion: Partial<Record<QualifyCriterion, number>>;
  resolved: number;
  unresolved: number;
  /** Éligibles au moteur Solana (chain solana + mint non null). */
  solanaEligible: number;
  drafts: ShillEventDraft[];
  ingested: number;
  alreadyPresent: number;
  errors: string[];
}

const DEFAULT_LIMIT = 500;
const DEFAULT_OVERLAP_MINUTES = 30;

/**
 * UN PASSAGE. Pas de boucle, pas de cron, pas d'auto-relance.
 *
 * `dryRun` vaut `true` par défaut : appeler cette fonction sans réfléchir
 * n'écrit rien. Armer les écritures est un geste explicite.
 */
export async function runForwardBridge(
  opts: ForwardBridgeOptions,
): Promise<ForwardBridgeReport> {
  const dryRun = opts.dryRun ?? true;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const persist = opts.persist ?? persistShillEventDrafts;

  const watermarkBefore = opts.readWatermark ? await opts.readWatermark() : null;

  // FENÊTRE AVEC RECOUVREMENT VOLONTAIRE. Reprendre exactement au watermark
  // perdrait tout candidat découvert dans la même seconde que le dernier
  // ingéré. Le recouvrement est sûr parce que la base déduplique — c'est la
  // contrainte qui autorise l'imprécision, pas l'inverse.
  const since =
    opts.since !== undefined
      ? opts.since
      : watermarkBefore
        ? new Date(watermarkBefore.getTime() - (opts.overlapMinutes ?? DEFAULT_OVERLAP_MINUTES) * 60_000)
        : null;

  const candidates = await opts.readCandidates({ since, limit });

  const report: ForwardBridgeReport = {
    dryRun,
    windowSince: since,
    watermarkBefore,
    watermarkAfter: watermarkBefore,
    examined: candidates.length,
    qualified: 0,
    rejected: 0,
    rejectedByCriterion: {},
    resolved: 0,
    unresolved: 0,
    solanaEligible: 0,
    drafts: [],
    ingested: 0,
    alreadyPresent: 0,
    errors: [],
  };

  const drafts: ShillEventDraft[] = [];

  for (const c of candidates) {
    // ── 1. QUALIFICATION (B2) — mentionner n'est pas promouvoir ──────────
    const q: PromotionQualification = qualifyPromotion(c);
    if (!q.qualified) {
      report.rejected++;
      const k = q.failedCriterion;
      if (k) report.rejectedByCriterion[k] = (report.rejectedByCriterion[k] ?? 0) + 1;
      continue;
    }
    report.qualified++;

    // Un candidat qualifié sans handle, sans postId ou sans date ne peut pas
    // devenir un événement : la clé unique le porte.
    const kolHandle = normalizeHandle(c.handle);
    const tweetId = (c.postId ?? "").trim();
    if (!kolHandle || !tweetId || !c.postedAtUtc) {
      report.errors.push(`candidat ${c.id} qualifié mais incomplet (handle/postId/postedAt)`);
      continue;
    }

    // ── 2. RÉSOLUTION (B1) — une adresse est une identité, pas un ticker ─
    const r = resolveTokenIdentity({
      detectedTokens: parseDetectedTokens(c.detectedTokens),
      detectedAddresses: parseDetectedTokens(c.detectedAddresses),
      text: c.rawText,
    });
    if (r.tokenMint) report.resolved++;
    else report.unresolved++;

    // ── 3. LE DRAFT ─────────────────────────────────────────────────────
    // `chain` vient de la RÉSOLUTION, pas de la colonne source : `chain` est
    // NULL sur 7 603/7 603 lignes de social_post_candidates. La prendre
    // aurait produit une chaîne inventée ou vide.
    const draft: ShillEventDraft = {
      kolHandle,
      tweetId,
      tweetTimestamp: c.postedAtUtc,
      tokenMint: r.tokenMint,
      rawToken: r.ticker ?? r.tokenMint ?? "",
      resolutionStatus: r.resolutionStatus,
      chain: r.chain ?? "",
      sourcePostCandidateId: c.id,
      campaignId: c.campaignId ?? null,
    };
    drafts.push(draft);

    // Compté, PAS filtré : B3 ne décide pas de l'éligibilité on-chain, il la
    // rend visible. Le moteur Solana applique sa propre garde (eligibility.ts).
    if (eligibleForSolanaEngine(draft)) report.solanaEligible++;

    const discovered = c.discoveredAtUtc;
    if (discovered && (!report.watermarkAfter || discovered > report.watermarkAfter)) {
      report.watermarkAfter = discovered;
    }
  }

  report.drafts = drafts;

  // ── 4. PERSISTANCE (ingestion réutilisée) ───────────────────────────────
  const persisted: PersistDraftsResult = await persist(drafts, { dryRun });
  report.ingested = persisted.created;
  report.alreadyPresent = persisted.skippedDuplicates;
  report.errors.push(...persisted.errors);

  return report;
}
