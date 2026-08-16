// ─── Watcher Bridge — rollup du reviewStatus d'une campagne ────────────────
//
// Extrait de reviewDraftLink.ts (Sprint 7) pour être partagé avec le chemin de
// DÉPUBLICATION (P0-2, archiveLinkPublication.ts). Un lien archivé doit faire
// redescendre le statut de sa campagne : sans ça, une campagne dont tous les
// liens ont été retirés continue d'afficher « approved_public ».
//
// Comportement strictement préservé quand aucun lien n'est archivé : les
// branches approved_public / rejected / partially_approved / pending sont
// identiques au Sprint 7.

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export type CampaignReviewStatus =
  | "pending"
  | "partially_approved"
  | "approved_public"
  | "rejected"
  | "archived";

export function rollupCampaignReviewStatus(counts: {
  total: number;
  pub: number;
  rej: number;
  arch: number;
}): CampaignReviewStatus {
  const { total, pub, rej, arch } = counts;
  if (total === 0) return "pending";
  if (pub === total) return "approved_public";
  if (rej === total) return "rejected";
  // Plus rien de public, et tout le reste est soit rejeté soit archivé :
  // la campagne est close côté public. `arch > 0` distingue ce cas du
  // `rej === total` traité juste au-dessus.
  if (pub === 0 && arch > 0 && rej + arch === total) return "archived";
  if (pub > 0) return "partially_approved";
  return "pending";
}

/** Recalcule et écrit le reviewStatus de la campagne depuis ses liens bridge. */
export async function recomputeCampaignReviewStatus(
  db: RawDb,
  campaignId: string | null,
): Promise<CampaignReviewStatus | undefined> {
  if (!campaignId) return undefined;
  const rows = await db.$queryRawUnsafe<
    Array<{ total: number; pub: number; rej: number; arch: number }>
  >(
    `SELECT count(*)::int                                          AS total,
            count(*) FILTER (WHERE visibility = 'public')::int     AS pub,
            count(*) FILTER (WHERE visibility = 'rejected')::int   AS rej,
            count(*) FILTER (WHERE visibility = 'archived')::int   AS arch
       FROM "KolTokenLink"
      WHERE "watcherCampaignId" = $1 AND "createdByBridge" = true`,
    campaignId,
  );
  const counts = rows[0] ?? { total: 0, pub: 0, rej: 0, arch: 0 };
  const status = rollupCampaignReviewStatus(counts);
  await db.$queryRawUnsafe(
    `UPDATE "WatcherCampaign" SET "reviewStatus" = $2, "updatedAt" = now() WHERE id = $1`,
    campaignId,
    status,
  );
  return status;
}
