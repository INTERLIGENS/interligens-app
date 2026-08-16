// Harnais SQL en mémoire pour le cycle de publication (P0-2).
//
// Ce n'est PAS un mock par fonction : c'est un mini-moteur qui reconnaît les
// instructions RÉELLEMENT émises par candidateStateMachine.ts,
// reviewDraftLink.ts, archiveLinkPublication.ts et campaignReviewStatus.ts, et
// les exécute sur des tables en mémoire. Le code de production tourne donc
// inchangé — c'est le moteur Postgres qui est remplacé, pas la logique.
//
// Il applique AUSSI les deux contraintes CHECK de
// migrations/MIGRATION_publication_lifecycle_v1.sql (reason non vide,
// reasonCode dans la liste autorisée). Une divergence entre le code et la
// migration se voit donc ici, sans attendre l'exécution sur ep-square-band.
//
// LIMITE ASSUMÉE : ce harnais ne prouve pas le comportement de Postgres
// (transactions, concurrence réelle, types). Il prouve le comportement du CODE.
// L'exécution sur ep-square-band exige la migration, qui n'est pas appliquée.

export interface LinkRow {
  id: string;
  kolHandle: string;
  contractAddress: string;
  chain: string;
  tokenSymbol: string | null;
  caseId: string | null;
  role: string;
  documentationStatus: string;
  createdAt: Date;
  visibility: string;
  reviewStatus: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  canonicalMint: string | null;
  tokenResolutionConfidence: string | null;
  socialPostCandidateId: string | null;
  watcherCampaignId: string | null;
  createdByBridge: boolean;
}

export interface CandidateRow {
  id: string;
  status: string;
}

export interface CampaignRow {
  id: string;
  reviewStatus: string;
}

export interface StatusLogRow {
  id: string;
  linkId: string;
  kolHandle: string;
  tokenSymbol: string | null;
  canonicalMint: string | null;
  fromVisibility: string;
  toVisibility: string;
  fromReviewStatus: string | null;
  toReviewStatus: string | null;
  reasonCode: string;
  reason: string;
  actorId: string;
  contestationRef: string | null;
  createdAt: Date;
}

export interface CandidateLogRow {
  id: string;
  candidateId: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  actorId: string;
  createdAt: Date;
}

export interface Store {
  links: LinkRow[];
  candidates: CandidateRow[];
  campaigns: CampaignRow[];
  linkStatusLog: StatusLogRow[];
  candidateStatusLog: CandidateLogRow[];
}

/** Miroir de la contrainte CHECK KolTokenLinkStatusLog_reasonCode_allowed. */
const SQL_ALLOWED_REASON_CODES = [
  "approved",
  "rejected",
  "contested",
  "erratum",
  "evidence_withdrawn",
  "legal",
  "duplicate",
  "other",
];

export function makeStore(partial: Partial<Store> = {}): Store {
  return {
    links: partial.links ?? [],
    candidates: partial.candidates ?? [],
    campaigns: partial.campaigns ?? [],
    linkStatusLog: partial.linkStatusLog ?? [],
    candidateStatusLog: partial.candidateStatusLog ?? [],
  };
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

/** Horloge déterministe : chaque écriture avance d'une seconde. */
let clock = Date.parse("2026-08-15T00:00:00.000Z");
function now(): Date {
  clock += 1000;
  return new Date(clock);
}

export function resetHarnessClock(): void {
  clock = Date.parse("2026-08-15T00:00:00.000Z");
  seq = 0;
}

function squash(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

export class UnsupportedStatementError extends Error {
  constructor(sql: string) {
    super(`Harnais SQL : instruction non reconnue → ${squash(sql).slice(0, 160)}`);
    this.name = "UnsupportedStatementError";
  }
}

export class CheckViolationError extends Error {
  constructor(constraint: string) {
    super(`new row violates check constraint "${constraint}"`);
    this.name = "CheckViolationError";
  }
}

export function makeRawDb(store: Store) {
  return {
    store,
    async $queryRawUnsafe<T = unknown>(sql: string, ...v: unknown[]): Promise<T> {
      const q = squash(sql);

      // ── social_post_candidates ────────────────────────────────────────
      if (/^SELECT status FROM "social_post_candidates" WHERE id = \$1/.test(q)) {
        const row = store.candidates.find((c) => c.id === v[0]);
        return (row ? [{ status: row.status }] : []) as T;
      }
      if (/^UPDATE "social_post_candidates" SET status = \$2/.test(q)) {
        const row = store.candidates.find((c) => c.id === v[0] && c.status === v[2]);
        if (!row) return [] as T;
        row.status = String(v[1]);
        return [{ id: row.id }] as T;
      }
      if (/^INSERT INTO "CandidateStatusLog"/.test(q)) {
        store.candidateStatusLog.push({
          id: nextId("candlog"),
          candidateId: String(v[0]),
          fromStatus: String(v[1]),
          toStatus: String(v[2]),
          reason: v[3] === null ? null : String(v[3]),
          actorId: String(v[4]),
          createdAt: now(),
        });
        return [] as T;
      }
      if (/^SELECT id FROM "CandidateStatusLog"/.test(q)) {
        const hit = store.candidateStatusLog.find(
          (l) => l.candidateId === v[0] && l.toStatus === v[1] && l.fromStatus === v[1] && l.reason === v[2],
        );
        return (hit ? [{ id: hit.id }] : []) as T;
      }

      // ── KolTokenLink ──────────────────────────────────────────────────
      if (/^SELECT id, "kolHandle", "tokenSymbol", visibility, "reviewStatus"/.test(q)) {
        const l = store.links.find((x) => x.id === v[0]);
        return (l
          ? [{
              id: l.id,
              kolHandle: l.kolHandle,
              tokenSymbol: l.tokenSymbol,
              visibility: l.visibility,
              reviewStatus: l.reviewStatus,
              canonicalMint: l.canonicalMint,
              tokenResolutionConfidence: l.tokenResolutionConfidence,
              socialPostCandidateId: l.socialPostCandidateId,
              watcherCampaignId: l.watcherCampaignId,
            }]
          : []) as T;
      }
      if (/^SELECT id, "kolHandle", "tokenSymbol", "canonicalMint", visibility/.test(q)) {
        const l = store.links.find((x) => x.id === v[0]);
        return (l
          ? [{
              id: l.id,
              kolHandle: l.kolHandle,
              tokenSymbol: l.tokenSymbol,
              canonicalMint: l.canonicalMint,
              visibility: l.visibility,
              reviewStatus: l.reviewStatus,
              socialPostCandidateId: l.socialPostCandidateId,
              watcherCampaignId: l.watcherCampaignId,
            }]
          : []) as T;
      }
      if (/^UPDATE "KolTokenLink" SET visibility = 'public'/.test(q)) {
        const l = store.links.find((x) => x.id === v[0]);
        if (!l) return [] as T;
        l.visibility = "public";
        l.reviewStatus = "approved_public";
        l.reviewedBy = String(v[1]);
        l.reviewedAt = now();
        return [{ id: l.id }] as T;
      }
      if (/^UPDATE "KolTokenLink" SET visibility = 'rejected'/.test(q)) {
        const l = store.links.find((x) => x.id === v[0]);
        if (!l) return [] as T;
        l.visibility = "rejected";
        l.reviewStatus = "rejected";
        l.reviewedBy = String(v[1]);
        l.reviewedAt = now();
        l.reviewNote = String(v[2]);
        return [{ id: l.id }] as T;
      }
      if (/^UPDATE "KolTokenLink" SET visibility = 'archived'/.test(q)) {
        // WHERE id = $1 AND visibility = $4 — écriture optimiste.
        const l = store.links.find((x) => x.id === v[0] && x.visibility === v[3]);
        if (!l) return [] as T;
        l.visibility = "archived";
        l.reviewStatus = "archived";
        l.reviewedBy = String(v[1]);
        l.reviewedAt = now();
        l.reviewNote = String(v[2]);
        return [{ id: l.id }] as T;
      }

      // ── KolTokenLinkStatusLog ─────────────────────────────────────────
      if (/^INSERT INTO "KolTokenLinkStatusLog"/.test(q)) {
        const reasonCode = String(v[8]);
        const reason = String(v[9]);
        // Contraintes CHECK de la migration, appliquées ici à l'identique.
        if (reason.trim().length === 0) {
          throw new CheckViolationError("KolTokenLinkStatusLog_reason_not_blank");
        }
        if (!SQL_ALLOWED_REASON_CODES.includes(reasonCode)) {
          throw new CheckViolationError("KolTokenLinkStatusLog_reasonCode_allowed");
        }
        const row: StatusLogRow = {
          id: nextId("linklog"),
          linkId: String(v[0]),
          kolHandle: String(v[1]),
          tokenSymbol: v[2] === null ? null : String(v[2]),
          canonicalMint: v[3] === null ? null : String(v[3]),
          fromVisibility: String(v[4]),
          toVisibility: String(v[5]),
          fromReviewStatus: v[6] === null ? null : String(v[6]),
          toReviewStatus: v[7] === null ? null : String(v[7]),
          reasonCode,
          reason,
          actorId: String(v[10]),
          contestationRef: v[11] === null ? null : String(v[11]),
          createdAt: now(),
        };
        store.linkStatusLog.push(row);
        return [{ id: row.id }] as T;
      }
      if (/FROM "KolTokenLinkStatusLog" WHERE "linkId" = \$1/.test(q)) {
        return store.linkStatusLog
          .filter((r) => r.linkId === v[0])
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) as T;
      }
      if (/FROM "KolTokenLinkStatusLog" WHERE lower\("kolHandle"\) = lower\(\$1\)/.test(q)) {
        return store.linkStatusLog
          .filter((r) => r.kolHandle.toLowerCase() === String(v[0]).toLowerCase())
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) as T;
      }

      // ── WatcherCampaign ───────────────────────────────────────────────
      if (/^SELECT count\(\*\)::int AS total/.test(q)) {
        const rows = store.links.filter((l) => l.watcherCampaignId === v[0] && l.createdByBridge);
        return [{
          total: rows.length,
          pub: rows.filter((l) => l.visibility === "public").length,
          rej: rows.filter((l) => l.visibility === "rejected").length,
          arch: rows.filter((l) => l.visibility === "archived").length,
        }] as T;
      }
      if (/^UPDATE "WatcherCampaign" SET "reviewStatus" = \$2/.test(q)) {
        const c = store.campaigns.find((x) => x.id === v[0]);
        if (c) c.reviewStatus = String(v[1]);
        return [] as T;
      }

      throw new UnsupportedStatementError(sql);
    },
  };
}
