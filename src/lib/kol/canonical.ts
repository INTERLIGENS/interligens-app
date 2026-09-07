// src/lib/kol/canonical.ts
// Single source of truth for KOL profile data consumed by all public surfaces.
// totalDocumented is NEVER recomputed here — always read from KolProfile (Writer A).
//
// P0 containment — totalDocumented devient `number | null`. `null` signifie
// « nous ne publions pas de chiffre », et se distingue de `0` qui affirmerait
// « cette personne n'a rien encaissé ». La bascule est décidée par
// src/lib/kol/proceedsGate.ts et journalisée dans KolProceedsPublicationLog.
// Ce fichier est le point d'étranglement : /api/kol, les snapshots publics, le
// dossier KOL et le scan mobile en dépendent tous.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { redactProceeds } from "@/lib/kol/proceedsGate";
import { redactMonetary, MONETARY_PUBLICATION_SELECT } from "@/lib/publication/monetaryGate";
import {
  deriveAttributionConfidence,
  deriveAttributionSource,
} from "@/lib/kol-memory/attribution";
import {
  buildProceedsProvenance,
  type ProceedsProvenance,
} from "@/lib/kol-memory/proceedsProvenance";
import { resolveCanonicalHandle } from "@/lib/kol-memory/handleResolution";

export type KolSnapshotFreshness = "fresh" | "stale" | "unknown";

export type WalletIdentityConfidence = "exact" | "strong" | "probable" | "candidate";
export type WalletAttributionMode = "manual" | "inferred";

export const SNAPSHOT_VERSION = "1.0.0" as const;
export const IDENTITY_RESOLUTION_VERSION = "1.0.0" as const;

/** Core contract — guaranteed fields on every snapshot */
export type KolCanonicalSnapshot = {
  handle: string;
  displayName: string | null;
  publishStatus: string;
  riskFlag: string | null;
  tier: string | null;
  /** `null` = publication retirée (P0 containment), PAS « zéro encaissé ». */
  totalDocumented: number | null;
  /**
   * État de publication du chiffre — 'published' | 'withdrawn'. Exposé sur le
   * snapshot pour que les consommateurs qui agrègent une SECONDE source de
   * proceeds (KolTokenInvolvement dans /api/watchlist) puissent appliquer la
   * même décision, au lieu de déduire le retrait d'un `totalDocumented === null`
   * qui vaut aussi pour un profil simplement sans montant.
   */
  proceedsPublication: string;
  totalScammed: number | null;
  walletCount: number;
  evidenceCount: number;
  lastScannedAt: Date | null;
  proceedsSource: "KolProceedsEvent";
  /**
   * BUILD 8 / P2 — la provenance du chiffre, DÉRIVÉE.
   *
   * `proceedsSource` ci-dessus est un littéral posé d'avance : le snapshot
   * déclarait sa source sans jamais la consulter. Il est conservé pour ses
   * consommateurs, mais il n'est plus la seule chose que le payload dise.
   *
   * Ce bloc rend l'affirmation FALSIFIABLE : il dit si le chiffre servi se
   * retrouve dans la source qu'on lui attribue, avec quelle règle, et ce que
   * `KolProceedsSummary` savait déjà — 28/28 `coverageStatus='partial'`,
   * 24/28 `pricingQuality='fallback'`, jamais remontés jusqu'ici.
   *
   * `NOT_VERIFIED` tant que la source n'a pas été lue : c'est un état, pas un
   * échec, et surtout pas un succès implicite.
   */
  proceedsProvenance: ProceedsProvenance;
  freshness: KolSnapshotFreshness;
  identityConfidence: WalletIdentityConfidence;
  walletAttributionMode: WalletAttributionMode;
  walletDataFreshAt: Date | null;
  // Versioning
  snapshotVersion: typeof SNAPSHOT_VERSION;
  proceedsComputedAt: Date | null;
  identityResolutionVersion: typeof IDENTITY_RESOLUTION_VERSION;
  builtFromEventId: string | null;
};

/** Extended row — includes all fields needed by API routes (superset of core) */
export type KolProfileRow = KolCanonicalSnapshot & {
  platform: string;
  confidence: string;
  evidenceDepth: string;
  completenessLevel: string;
  profileStrength: string;
  behaviorFlags: string;
  summary: string | null;
  exitDate: Date | null;
  evmAddress: string | null;
  rugCount: number;
  followerCount: number | null;
  verified: boolean;
  proceedsCoverage: string | null;
  updatedAt: Date;
  publishable: boolean;
  bio: string | null;
  _count: {
    evidences: number;
    kolWallets: number;
    kolCases: number;
    tokenLinks: number;
  };
};

const FRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

type WalletRow = {
  confidence: string;
  attributionSource: string | null;
  attributionStatus: string;
  claimType: string | null;
  discoveredAt: Date | null;
};

/**
 * ─── BUILD 8 / P0 — la condition qui ne pouvait jamais être vraie ──────────
 *
 * Ce calcul exigeait `attributionSource === "manual"` pour rendre `exact`.
 * Mesuré sur ep-square-band le 2026-09-07 :
 *
 *     SELECT count(*) FROM "KolWallet"
 *      WHERE "attributionSource" IN ('manual','on_chain_footprint',
 *                                    'airdrop','promotion_tx','inferred');
 *     → 0        (sur 482)
 *
 * Aucune ligne ne porte ce vocabulaire — la colonne contient 18 étiquettes de
 * PROVENANCE (`botify_leaked_doc`, `sns`, `arkham_intel`…), c'est-à-dire d'où
 * vient la preuve, pas comment l'attribution a été faite. Le niveau `exact`
 * était donc INATTEIGNABLE pour les 412 profils, silencieusement.
 *
 * La dérivation est désormais celle de kol-memory/attribution, qui lit
 * `claimType` — le vocabulaire Publishing Standard v1, lui réellement peuplé.
 * `exact` exige `confirmed` ET `verified_onchain` : 15 lignes sur 482, un
 * palier réel.
 */
function computeIdentityConfidence(wallets: WalletRow[]): WalletIdentityConfidence {
  if (!wallets.length) return "candidate";
  const rangs = wallets.map(deriveAttributionConfidence);
  if (rangs.includes("exact")) return "exact";
  if (rangs.includes("strong")) return "strong";
  if (rangs.includes("probable")) return "probable";
  return "candidate";
}

/**
 * Même correction : `attributionSource === "manual"` ne pouvait jamais être
 * vrai, donc ce mode rendait `inferred` pour TOUS les profils — la bonne
 * réponse, mais pour la mauvaise raison, et sans qu'on puisse le savoir.
 *
 * Il se lit maintenant sur la catégorie dérivée de `claimType` : un wallet
 * dont le produit déclare l'avoir constaté on-chain est attribué autrement
 * qu'un wallet dont un tiers l'affirme.
 */
function computeAttributionMode(wallets: WalletRow[]): WalletAttributionMode {
  return wallets.some(w => deriveAttributionSource(w) === "on_chain_footprint")
    ? "manual"
    : "inferred";
}

function computeWalletDataFreshAt(wallets: WalletRow[]): Date | null {
  const dates = wallets.map(w => w.discoveredAt).filter((d): d is Date => d !== null);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

function computeFreshness(lastHeliusScan: Date | null): KolSnapshotFreshness {
  if (!lastHeliusScan) return "unknown";
  return Date.now() - new Date(lastHeliusScan).getTime() < FRESH_THRESHOLD_MS
    ? "fresh"
    : "stale";
}

const KOL_SELECT = {
  handle: true,
  displayName: true,
  publishStatus: true,
  riskFlag: true,
  tier: true,
  totalDocumented: true,
  // P0 containment — sans cette sélection, redactProceeds fail-close et le
  // chiffre disparaît partout. C'est volontaire : l'oubli ne publie jamais.
  // A14 — `monetaryClaimsPublication`. Le cast temporaire qui vivait ici a été
  // RETIRÉ le 2026-08-19 : la colonne est désormais déclarée dans
  // schema.prod.prisma, donc connue du client généré. Sans ce retrait, le
  // typecheck restait vert quelle que soit la réalité du schéma — c'est
  // exactement ce qui a laissé passer le défaut. Sans cette sélection, le garde
  // fail-close et AUCUN montant d'ampleur n'est servi : c'est le sens du refus,
  // pas un bug.
  ...MONETARY_PUBLICATION_SELECT,
  totalScammed: true,
  lastHeliusScan: true,
  platform: true,
  confidence: true,
  evidenceDepth: true,
  completenessLevel: true,
  profileStrength: true,
  behaviorFlags: true,
  summary: true,
  exitDate: true,
  evmAddress: true,
  rugCount: true,
  followerCount: true,
  verified: true,
  proceedsCoverage: true,
  updatedAt: true,
  publishable: true,
  bio: true,
  _count: {
    select: {
      evidences: true,
      kolWallets: true,
      kolCases: true,
      tokenLinks: true,
    },
  },
  kolWallets: {
    where: { status: "active" },
    select: {
      confidence: true,
      attributionSource: true,
      attributionStatus: true,
      // BUILD 8 / P0 — sans cette colonne, la dérivation retombe en
      // `candidate` pour tout le monde (fail-closed). Elle est le vocabulaire
      // réellement peuplé ; `attributionSource` ne l'est pas.
      claimType: true,
      discoveredAt: true,
    },
  },
} as const;

type RawRow = Prisma.KolProfileGetPayload<{ select: typeof KOL_SELECT }>;

function toSnapshot(row: RawRow): KolProfileRow {
  return {
    handle: row.handle,
    displayName: row.displayName,
    publishStatus: row.publishStatus,
    riskFlag: row.riskFlag,
    tier: row.tier,
    // `?? 0` supprimé : un profil sans montant et un profil dont le montant est
    // retiré rendent tous deux `null`. Zéro serait une affirmation.
    totalDocumented: redactProceeds(row, row.totalDocumented),
    // A14 — même traitement pour l'ampleur du préjudice. Avant ce correctif,
    // `totalScammed` était servi brut À CÔTÉ d'un champ redacted : sur
    // bkokoski, 210 900 $ retirés et 4 500 000 $ servis par la même ligne.
    // Famille `scam_scale` : ce n'est pas la même affirmation que
    // l'encaissement, et elle a son propre interrupteur.
    proceedsPublication: row.proceedsPublication,
    totalScammed: redactMonetary(row, row.totalScammed, "scam_scale") as number | null,
    walletCount: row._count.kolWallets,
    evidenceCount: row._count.evidences,
    lastScannedAt: row.lastHeliusScan,
    proceedsSource: "KolProceedsEvent",
    // BUILD 8 / P2 — `sourceUsd` n'est volontairement PAS fourni ici :
    // `toSnapshot` est une projection pure, elle n'interroge pas la base. La
    // provenance ressort donc en `NOT_VERIFIED` — l'état exact de ce qui s'est
    // passé, et non un `REPRODUCIBLE` que rien n'aurait vérifié. Un appelant
    // qui veut la vérification lit KolProceedsEvent et appelle
    // `buildProceedsProvenance` lui-même.
    proceedsProvenance: buildProceedsProvenance({
      servedUsd: redactProceeds(row, row.totalDocumented) ?? undefined,
    }),
    freshness: computeFreshness(row.lastHeliusScan),
    identityConfidence: computeIdentityConfidence(row.kolWallets),
    walletAttributionMode: computeAttributionMode(row.kolWallets),
    walletDataFreshAt: computeWalletDataFreshAt(row.kolWallets),
    snapshotVersion: SNAPSHOT_VERSION,
    proceedsComputedAt: row.lastHeliusScan,
    identityResolutionVersion: IDENTITY_RESOLUTION_VERSION,
    builtFromEventId: null,
    platform: row.platform,
    confidence: row.confidence,
    evidenceDepth: row.evidenceDepth,
    completenessLevel: row.completenessLevel,
    profileStrength: row.profileStrength,
    behaviorFlags: row.behaviorFlags,
    summary: row.summary,
    exitDate: row.exitDate,
    evmAddress: row.evmAddress,
    rugCount: row.rugCount,
    followerCount: row.followerCount,
    verified: row.verified,
    proceedsCoverage: row.proceedsCoverage,
    updatedAt: row.updatedAt,
    publishable: row.publishable,
    bio: row.bio,
    _count: row._count,
  };
}

/**
 * ─── BUILD 8 / E1 — 21 des 32 profils publiés étaient injoignables ─────────
 *
 * Ce lookup était un `findUnique({ handle })`, égalité STRICTE, alors que
 * `/api/kol/[handle]` abaisse la casse de ce qu'il reçoit. Tout profil dont le
 * handle porte une majuscule était donc structurellement introuvable :
 * la route cherchait `gordongekko`, la base porte `GordonGekko`.
 *
 * Mesuré sur ep-square-band le 2026-09-07 : 32 profils publiés, 21 avec
 * majuscule → injoignables, et 126 des 164 wallets publiables jamais servis.
 *
 * La résolution vit dans kol-memory/handleResolution : égalité exacte d'abord,
 * puis insensible à la casse SEULEMENT si elle désigne une seule ligne, et
 * REFUS si plusieurs. Ce n'est pas de la prudence rhétorique — `0xsweep` et
 * `0xSweep` sont deux lignes distinctes en base, et servir l'une pour l'autre
 * attribuerait à une personne le dossier d'une autre.
 */
export async function buildKolCanonicalSnapshot(
  handle: string
): Promise<KolProfileRow | null> {
  const resolved = await resolveCanonicalHandle(handle);
  // `null` couvre les trois refus : introuvable, entrée vide, et ambigu. Aucun
  // n'est rattrapé par un repli — un handle qu'on ne sait pas identifier ne
  // rend pas un profil approchant.
  if (!resolved.handle) return null;

  const row = await prisma.kolProfile.findUnique({
    where: { handle: resolved.handle },
    select: KOL_SELECT,
  });
  if (!row) return null;
  return toSnapshot(row);
}

export async function buildKolCanonicalSnapshotBatch(
  where: Prisma.KolProfileWhereInput,
  orderBy?:
    | Prisma.KolProfileOrderByWithRelationInput
    | Prisma.KolProfileOrderByWithRelationInput[]
): Promise<KolProfileRow[]> {
  const rows = await prisma.kolProfile.findMany({
    where,
    select: KOL_SELECT,
    orderBy,
  });
  return rows.map(toSnapshot);
}
