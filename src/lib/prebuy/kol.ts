/**
 * PRE-BUY GUARD — KOL referral layer.
 *
 * Two read-only lookups:
 *
 *   getReferralRisk(handle)        — given the referring account, what
 *                                    documented risk flags does the rich
 *                                    KolProfile carry?
 *   getTokenKolInvolvement(chain,  — reuse buildKolAlert: which PUBLISHED
 *                          mint)     KOLs are documented on this token, and
 *                                    did any front-run their own promotion?
 *
 * Visibility: we read the rich `KolProfile` model (prisma.kolProfile) — NOT
 * an IntelEntityType.PERSON entity. PERSON-type entities never score and are
 * never retail-visible; that protection lives inside REFLEX's intelligence
 * overlay, which we call separately, so it is inherited for free here. We
 * surface a `published` flag so downstream consumers know the visibility
 * state of any referring profile, and we never read internalNote / restricted
 * narrative into the verdict.
 *
 * Fail-soft: never throws on data issues — degrades to an unavailable summary.
 */
import { buildKolAlertSafe } from "@/lib/kol/alert";
import { prisma } from "@/lib/prisma";

export interface ReferralRiskSummary {
  /** false = no handle supplied, or lookup degraded. */
  available: boolean;
  handle: string | null;
  /** A matching KolProfile row exists. */
  found: boolean;
  /** riskFlag === "flagged" — the documented escalation trigger. */
  flagged: boolean;
  riskFlag: string | null;
  label: string | null;
  tier: string | null;
  rugCount: number;
  behaviorFlags: string[];
  /** Visibility state of the profile (published vs draft/restricted). */
  published: boolean;
  reason: string;
}

export interface TokenKolInvolvement {
  /** false = lookup degraded. (No involvement is `available:true, involvedCount:0`.) */
  available: boolean;
  involvedCount: number;
  /** A documented promoter sold before their own promotion of this token. */
  hasFrontRunner: boolean;
  /** Highest retail risk tier among involved published KOLs. */
  worstTier: string | null;
  handles: string[];
}

function noReferral(reason: string, handle: string | null = null): ReferralRiskSummary {
  return {
    available: false,
    handle,
    found: false,
    flagged: false,
    riskFlag: null,
    label: null,
    tier: null,
    rugCount: 0,
    behaviorFlags: [],
    published: false,
    reason,
  };
}

function parseFlags(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normHandle(handle: string): string {
  return handle.trim().replace(/^@/, "");
}

export async function getReferralRisk(
  handle?: string | null,
): Promise<ReferralRiskSummary> {
  if (!handle || !handle.trim()) return noReferral("no referring handle supplied");
  const h = normHandle(handle);

  try {
    // Case-insensitive match: handle is the unique key but casing varies
    // across watcher sources.
    const kol = await prisma.kolProfile.findFirst({
      where: { handle: { equals: h, mode: "insensitive" } },
      select: {
        handle: true,
        label: true,
        riskFlag: true,
        tier: true,
        rugCount: true,
        behaviorFlags: true,
        publishStatus: true,
        publishable: true,
      },
    });

    if (!kol) {
      return {
        ...noReferral(`no KolProfile for @${h}`, h),
        available: true,
      };
    }

    return {
      available: true,
      handle: kol.handle,
      found: true,
      flagged: kol.riskFlag === "flagged",
      riskFlag: kol.riskFlag ?? null,
      label: kol.label ?? null,
      tier: kol.tier ?? null,
      rugCount: kol.rugCount ?? 0,
      behaviorFlags: parseFlags(kol.behaviorFlags),
      published:
        kol.publishStatus === "published" ||
        (!!kol.publishable && kol.publishStatus === "draft"),
      reason: `profile found; riskFlag=${kol.riskFlag ?? "?"}, label=${kol.label ?? "?"}`,
    };
  } catch (err) {
    return noReferral(
      `referral lookup failed (degraded): ${
        err instanceof Error ? err.message : String(err)
      }`,
      h,
    );
  }
}

export async function getTokenKolInvolvement(
  chain: string,
  tokenMint: string,
): Promise<TokenKolInvolvement> {
  try {
    // buildKolAlertSafe is itself fail-soft and filters to published KOLs.
    const alert = await buildKolAlertSafe(chain, tokenMint);
    return {
      available: true,
      involvedCount: alert.kols.length,
      hasFrontRunner: alert.kols.some((k) => k.isFrontRun),
      worstTier:
        alert.kols.length > 0
          ? alert.kols.reduce((a, b) => (a.tigerScore >= b.tigerScore ? a : b)).tier
          : null,
      handles: alert.kols.map((k) => k.handle),
    };
  } catch {
    return {
      available: false,
      involvedCount: 0,
      hasFrontRunner: false,
      worstTier: null,
      handles: [],
    };
  }
}
