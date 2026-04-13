import { prisma } from "@/lib/prisma";

export type EnrichedEntity = {
  id: string;
  type: string;
  value: string;
  label?: string;
  tigerScore?: number;
  crossIntelligence: {
    inKolRegistry: boolean;
    kolHandle?: string;
    kolRiskFlags?: string[];
    inWatchlist: boolean;
    isKnownBad: boolean;
    proceedsSummary?: {
      totalUSD: number;
      eventCount: number;
      topRoutes: string[];
      alignsWithPromoWindows: boolean;
    };
    laundryTrail?: {
      detected: boolean;
      patternType?: string;
      confidence?: number;
      hopCount?: number;
      summary?: string;
    };
  };
};

export type ConfidenceClaim = {
  claim: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  dependsOn: string[];
  weakPoint: string;
  whatWouldStrengthen: string;
};

export type ContradictionSignal = {
  description: string;
  entityA: string;
  entityB: string;
  severity: "BLOCKING" | "NOTABLE" | "MINOR";
};

export type TimelineCorrelation = {
  hasTimeline: boolean;
  eventCount: number;
  earliestEvent: string | null;
  latestEvent: string | null;
  timespan: string | null;
  proceedsTimestamps: string[];
  correlationSignals: Array<{
    type:
      | "CASHOUT_AFTER_PROMO"
      | "SIMULTANEOUS_ACTIVITY"
      | "RAPID_EXIT"
      | "DELAYED_EXIT"
      | "NO_ALIGNMENT";
    description: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }>;
  largestGap: string | null;
  activityClusters: number;
};

export type CaseIntelligencePack = {
  caseId: string;
  template: string;
  entityCount: number;
  entities: EnrichedEntity[];
  hypotheses: Array<{
    title: string;
    status: string;
    confidence: number;
  }>;
  timeline: Array<{
    date: string;
    title: string;
    description?: string;
  }>;
  networkIntelligence: {
    relatedActors: string[];
    linkedWalletsCount: number;
    observedEventsCount: number;
    networkName?: string;
  };
  intelVaultRefs: Array<{ title: string; summary?: string }>;
  twinState: {
    gaps: string[];
    conflicts: string[];
    publicationReadiness: number;
    nextSuggestedAction: string;
  };
  confidenceAssessment: ConfidenceClaim[];
  contradictions: ContradictionSignal[];
  timelineCorrelation: TimelineCorrelation;
};

function normalizeHandle(v: string): string {
  return v.replace(/^@+/, "").trim().toLowerCase();
}

function emptyCrossIntel(): EnrichedEntity["crossIntelligence"] {
  return {
    inKolRegistry: false,
    inWatchlist: false,
    isKnownBad: false,
  };
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[intelligence-pack] query failed", err);
    return fallback;
  }
}

export async function buildCaseIntelligencePack(
  caseId: string,
  workspaceId: string
): Promise<CaseIntelligencePack> {
  const caseRow = await safeQuery(
    () =>
      prisma.vaultCase.findFirst({
        where: { id: caseId, workspaceId },
        select: { caseTemplate: true },
      }),
    null
  );

  const entitiesRaw = await safeQuery(
    () =>
      prisma.vaultCaseEntity.findMany({
        where: { caseId },
        take: 500,
      }),
    [] as Array<{
      id: string;
      type: string;
      value: string;
      label: string | null;
      confidence: number | null;
      tigerScore: number | null;
      sourceFileId: string | null;
    }>
  );

  const hypothesesRaw = await safeQuery(
    () =>
      prisma.vaultHypothesis.findMany({
        where: { caseId },
        select: {
          title: true,
          status: true,
          confidence: true,
          supportingEntityIds: true,
        },
        take: 100,
      }),
    [] as Array<{
      title: string;
      status: string;
      confidence: number;
      supportingEntityIds: string[];
    }>
  );

  const timelineRaw = await safeQuery(
    () =>
      prisma.vaultTimelineEvent.findMany({
        where: { caseId },
        orderBy: { eventDate: "asc" },
        select: { title: true, description: true, eventDate: true },
        take: 200,
      }),
    [] as Array<{ title: string; description: string | null; eventDate: Date }>
  );

  // Wallet/contract enrichment via KolWallet → KolProfile
  const walletValues = entitiesRaw
    .filter((e) => e.type === "WALLET" || e.type === "CONTRACT")
    .map((e) => e.value);

  const handleValues = entitiesRaw
    .filter((e) => e.type === "HANDLE")
    .map((e) => normalizeHandle(e.value));

  const kolWalletMatches = await safeQuery(
    () =>
      walletValues.length === 0
        ? Promise.resolve([])
        : prisma.kolWallet.findMany({
            where: {
              OR: [
                { address: { in: walletValues } },
                { address: { in: walletValues.map((v) => v.toLowerCase()) } },
              ],
            },
            select: { address: true, kolHandle: true, chain: true, label: true },
          }),
    [] as Array<{
      address: string;
      kolHandle: string;
      chain: string;
      label: string | null;
    }>
  );

  const matchedHandlesFromWallets = new Set(
    kolWalletMatches.map((w) => w.kolHandle.toLowerCase())
  );
  const directHandleMatchSet = new Set(handleValues);
  const allMatchedHandles = new Set<string>([
    ...matchedHandlesFromWallets,
    ...directHandleMatchSet,
  ]);

  const kolProfiles = await safeQuery(
    () =>
      allMatchedHandles.size === 0
        ? Promise.resolve([])
        : prisma.kolProfile.findMany({
            where: {
              handle: {
                in: Array.from(allMatchedHandles),
                mode: "insensitive",
              },
            },
            select: {
              handle: true,
              displayName: true,
              rugCount: true,
              totalDocumented: true,
              totalScammed: true,
              riskFlag: true,
              label: true,
              tier: true,
              publishable: true,
            },
          }),
    [] as Array<{
      handle: string;
      displayName: string | null;
      rugCount: number;
      totalDocumented: number | null;
      totalScammed: number | null;
      riskFlag: string;
      label: string;
      tier: string | null;
      publishable: boolean;
    }>
  );

  const profileByHandle = new Map<string, (typeof kolProfiles)[number]>();
  for (const p of kolProfiles) {
    profileByHandle.set(p.handle.toLowerCase(), p);
  }

  // LaundryTrail per matched KOL
  const laundryTrails = await safeQuery(
    () =>
      allMatchedHandles.size === 0
        ? Promise.resolve([])
        : prisma.laundryTrail.findMany({
            where: {
              kolHandle: {
                in: Array.from(allMatchedHandles),
                mode: "insensitive",
              },
            },
            select: {
              kolHandle: true,
              trailType: true,
              laundryRisk: true,
              trailBreakHop: true,
              narrativeText: true,
              walletAddress: true,
            },
            take: 50,
          }),
    [] as Array<{
      kolHandle: string | null;
      trailType: string;
      laundryRisk: string;
      trailBreakHop: number | null;
      narrativeText: string | null;
      walletAddress: string;
    }>
  );

  const trailsByHandle = new Map<string, (typeof laundryTrails)[number]>();
  const trailsByWallet = new Map<string, (typeof laundryTrails)[number]>();
  for (const t of laundryTrails) {
    if (t.kolHandle) {
      trailsByHandle.set(t.kolHandle.toLowerCase(), t);
    }
    trailsByWallet.set(t.walletAddress.toLowerCase(), t);
  }

  // KolCase (intel vault references) per matched KOL
  const intelCases = await safeQuery(
    () =>
      allMatchedHandles.size === 0
        ? Promise.resolve([])
        : prisma.kolCase.findMany({
            where: {
              kolHandle: {
                in: Array.from(allMatchedHandles),
                mode: "insensitive",
              },
            },
            select: {
              caseId: true,
              role: true,
              paidUsd: true,
              evidence: true,
            },
            take: 20,
          }),
    [] as Array<{
      caseId: string;
      role: string;
      paidUsd: number | null;
      evidence: string | null;
    }>
  );

  // Build enriched entities
  const enrichedEntities: EnrichedEntity[] = entitiesRaw.map((e) => {
    const cross = emptyCrossIntel();

    if (e.type === "WALLET" || e.type === "CONTRACT") {
      const matched = kolWalletMatches.find(
        (w) => w.address.toLowerCase() === e.value.toLowerCase()
      );
      if (matched) {
        const profile = profileByHandle.get(matched.kolHandle.toLowerCase());
        cross.inKolRegistry = true;
        cross.kolHandle = matched.kolHandle;
        cross.isKnownBad = true;
        if (profile) {
          const flags: string[] = [];
          if (profile.riskFlag && profile.riskFlag !== "unverified")
            flags.push(profile.riskFlag);
          if (profile.label && profile.label !== "unknown")
            flags.push(profile.label);
          if (profile.tier) flags.push(`tier:${profile.tier}`);
          cross.kolRiskFlags = flags;
          if (profile.totalDocumented || profile.totalScammed) {
            cross.proceedsSummary = {
              totalUSD: profile.totalDocumented ?? profile.totalScammed ?? 0,
              eventCount: profile.rugCount ?? 0,
              topRoutes: [],
              alignsWithPromoWindows: false,
            };
          }
        }
      }
      const trail = trailsByWallet.get(e.value.toLowerCase());
      if (trail) {
        cross.laundryTrail = {
          detected: true,
          patternType: trail.trailType,
          confidence:
            trail.laundryRisk === "HIGH"
              ? 0.9
              : trail.laundryRisk === "MEDIUM"
                ? 0.6
                : 0.3,
          hopCount: trail.trailBreakHop ?? undefined,
          summary: trail.narrativeText ?? undefined,
        };
      }
    } else if (e.type === "HANDLE") {
      const handle = normalizeHandle(e.value);
      const profile = profileByHandle.get(handle);
      if (profile) {
        cross.inKolRegistry = true;
        cross.kolHandle = profile.handle;
        if (profile.publishable) cross.isKnownBad = true;
        const flags: string[] = [];
        if (profile.riskFlag && profile.riskFlag !== "unverified")
          flags.push(profile.riskFlag);
        if (profile.label && profile.label !== "unknown")
          flags.push(profile.label);
        if (profile.tier) flags.push(`tier:${profile.tier}`);
        cross.kolRiskFlags = flags;
        if (profile.totalDocumented || profile.totalScammed) {
          cross.proceedsSummary = {
            totalUSD: profile.totalDocumented ?? profile.totalScammed ?? 0,
            eventCount: profile.rugCount ?? 0,
            topRoutes: [],
            alignsWithPromoWindows: false,
          };
        }
      }
      const trail = trailsByHandle.get(handle);
      if (trail) {
        cross.laundryTrail = {
          detected: true,
          patternType: trail.trailType,
          confidence:
            trail.laundryRisk === "HIGH"
              ? 0.9
              : trail.laundryRisk === "MEDIUM"
                ? 0.6
                : 0.3,
          hopCount: trail.trailBreakHop ?? undefined,
          summary: trail.narrativeText ?? undefined,
        };
      }
    }

    return {
      id: e.id,
      type: e.type,
      value: e.value,
      label: e.label ?? undefined,
      tigerScore: e.tigerScore ?? undefined,
      crossIntelligence: cross,
    };
  });

  // Network intelligence: find other KolProfiles sharing wallets with matched ones
  let networkActors: string[] = [];
  let linkedWalletsCount = 0;
  let observedEventsCount = 0;
  if (allMatchedHandles.size > 0) {
    const allLinkedWallets = await safeQuery(
      () =>
        prisma.kolWallet.findMany({
          where: {
            kolHandle: {
              in: Array.from(allMatchedHandles),
              mode: "insensitive",
            },
          },
          select: { address: true, kolHandle: true },
          take: 500,
        }),
      [] as Array<{ address: string; kolHandle: string }>
    );
    linkedWalletsCount = allLinkedWallets.length;

    const sharedAddresses = allLinkedWallets.map((w) => w.address);
    const counterparts = await safeQuery(
      () =>
        sharedAddresses.length === 0
          ? Promise.resolve([])
          : prisma.kolWallet.findMany({
              where: {
                address: { in: sharedAddresses },
                kolHandle: {
                  notIn: Array.from(allMatchedHandles),
                  mode: "insensitive",
                },
              },
              select: { kolHandle: true },
              take: 200,
            }),
      [] as Array<{ kolHandle: string }>
    );
    networkActors = Array.from(
      new Set(counterparts.map((c) => c.kolHandle))
    ).slice(0, 20);

    observedEventsCount = kolProfiles.reduce(
      (sum, p) => sum + (p.rugCount ?? 0),
      0
    );
  }

  // Intel vault refs from KolCase
  const intelVaultRefs = intelCases.slice(0, 5).map((c) => ({
    title: `KOL Case ${c.caseId} (${c.role})`,
    summary: c.evidence ?? undefined,
  }));

  // Twin state — gap detection (lifted from CaseTwin rules)
  const wallets = entitiesRaw.filter((e) => e.type === "WALLET");
  const txs = entitiesRaw.filter((e) => e.type === "TX_HASH");
  const handles = entitiesRaw.filter((e) => e.type === "HANDLE");
  const gaps: string[] = [];
  if (entitiesRaw.length === 0) gaps.push("No evidence deposited yet");
  if (wallets.length > 0 && txs.length === 0)
    gaps.push("No transaction hashes linked to wallets");
  if (txs.length > 0 && timelineRaw.length === 0)
    gaps.push("No timeline built yet");
  const unlabeled = entitiesRaw.filter((e) => !e.label).length;
  if (unlabeled > 0) gaps.push(`${unlabeled} entities have no analyst label`);
  if (!caseRow?.caseTemplate || caseRow.caseTemplate === "blank")
    gaps.push("No case structure defined");

  // Conflict detection (same value with different types)
  const conflicts: string[] = [];
  const valueTypeMap = new Map<string, Set<string>>();
  for (const e of entitiesRaw) {
    const s = valueTypeMap.get(e.value) ?? new Set<string>();
    s.add(e.type);
    valueTypeMap.set(e.value, s);
  }
  for (const [val, types] of valueTypeMap.entries()) {
    if (types.size > 1) {
      conflicts.push(
        `Entity '${val.slice(0, 24)}' has conflicting types: ${Array.from(types).join(", ")}`
      );
    }
  }

  // Publication readiness
  let readiness = 0;
  if (entitiesRaw.length >= 3) readiness++;
  if (hypothesesRaw.some((h) => h.status === "CONFIRMED")) readiness++;
  if (gaps.length === 0) readiness++;
  if (entitiesRaw.some((e) => e.confidence != null && e.confidence >= 0.8))
    readiness++;
  if (timelineRaw.length > 0) readiness++;

  // Next suggested action
  let nextSuggestedAction = "Review case state.";
  if (entitiesRaw.length === 0) {
    nextSuggestedAction = "Add your first entity — start with a wallet or handle";
  } else if (wallets.length > 0 && txs.length === 0) {
    nextSuggestedAction = "Look for transaction hashes linked to these wallets";
  } else if (handles.length > 0 && kolProfiles.length === 0) {
    nextSuggestedAction = "Check these handles against the KOL Registry";
  } else if (hypothesesRaw.length === 0) {
    nextSuggestedAction = "Add your first working hypothesis";
  } else if (timelineRaw.length === 0) {
    nextSuggestedAction = "Build the case timeline";
  } else {
    nextSuggestedAction = "Review publication readiness — this case may be ready";
  }

  // ============================================================
  // CONFIDENCE ASSESSMENT (auto-generated from pack data)
  // ============================================================
  const confidenceAssessment: ConfidenceClaim[] = [];

  const aggregateProceeds = enrichedEntities.reduce((sum, e) => {
    return sum + (e.crossIntelligence.proceedsSummary?.totalUSD ?? 0);
  }, 0);
  const aggregateProceedsEvents = enrichedEntities.reduce((sum, e) => {
    return sum + (e.crossIntelligence.proceedsSummary?.eventCount ?? 0);
  }, 0);

  if (aggregateProceeds > 0 && aggregateProceedsEvents >= 2) {
    confidenceAssessment.push({
      claim: "Proceeds attribution",
      confidence: "HIGH",
      dependsOn: ["KOL Registry match", "wallet linkage"],
      weakPoint: "No tx-hash level verification",
      whatWouldStrengthen: "DEX transaction hashes + timestamps",
    });
  }

  const strongLaundryTrails = enrichedEntities.filter(
    (e) =>
      e.crossIntelligence.laundryTrail?.detected &&
      (e.crossIntelligence.laundryTrail?.confidence ?? 0) >= 0.7
  );
  if (strongLaundryTrails.length > 0) {
    confidenceAssessment.push({
      claim: "Laundering pattern",
      confidence: "MEDIUM",
      dependsOn: ["hop count", "bridge usage", "relay structure"],
      weakPoint: "Intent to conceal not formally demonstrated",
      whatWouldStrengthen: "Multiple independent routing instances",
    });
  }

  if (networkActors.length >= 3) {
    confidenceAssessment.push({
      claim: "Coordinated network",
      confidence: "MEDIUM",
      dependsOn: ["shared wallet infrastructure", "temporal alignment"],
      weakPoint: "Co-occurrence is not coordination",
      whatWouldStrengthen: "Shared payment routes + synchronized timing",
    });
  }

  const highRiskTigerEntities = entitiesRaw.filter(
    (e) => (e.tigerScore ?? 0) >= 70
  );
  if (highRiskTigerEntities.length > 0) {
    confidenceAssessment.push({
      claim: "High-risk entity confirmed",
      confidence: "HIGH",
      dependsOn: ["TigerScore methodology"],
      weakPoint: "Score reflects past behavior, not current activity",
      whatWouldStrengthen: "Recent on-chain activity corroboration",
    });
  }

  // ============================================================
  // CONTRADICTIONS (auto-detected)
  // ============================================================
  const contradictionSignals: ContradictionSignal[] = [];

  // Rule 1: tigerScore <= 30 (GREEN) but linked to a CONFIRMED hypothesis
  const confirmedHypotheses = hypothesesRaw.filter(
    (h) => h.status === "CONFIRMED"
  );
  for (const h of confirmedHypotheses) {
    for (const eid of h.supportingEntityIds) {
      const entity = entitiesRaw.find((e) => e.id === eid);
      if (entity && (entity.tigerScore ?? 100) <= 30) {
        contradictionSignals.push({
          description:
            "Entity scores LOW risk but is linked to a CONFIRMED suspicious hypothesis",
          entityA: entity.value,
          entityB: h.title,
          severity: "NOTABLE",
        });
      }
    }
  }

  // Rule 2: large proceeds but no laundry trail
  for (const e of enrichedEntities) {
    const proceeds = e.crossIntelligence.proceedsSummary?.totalUSD ?? 0;
    if (proceeds > 50000 && !e.crossIntelligence.laundryTrail?.detected) {
      contradictionSignals.push({
        description:
          "Large proceeds observed but no laundering pattern detected — routing may be direct or untraced",
        entityA: e.value,
        entityB: "(no laundry trail)",
        severity: "NOTABLE",
      });
    }
  }

  // Rule 3: network actors but no HANDLE entities
  if (networkActors.length > 0) {
    const handleEntities = entitiesRaw.filter((e) => e.type === "HANDLE");
    if (handleEntities.length === 0) {
      contradictionSignals.push({
        description:
          "Network actors identified but no handles added to case — attribution chain incomplete",
        entityA: `${networkActors.length} actors`,
        entityB: "(no HANDLE entities)",
        severity: "MINOR",
      });
    }
  }

  // Rule 4: CONFIRMED hypothesis with empty supportingEntityIds
  for (const h of hypothesesRaw) {
    if (h.status === "CONFIRMED" && h.supportingEntityIds.length === 0) {
      contradictionSignals.push({
        description:
          "Hypothesis marked CONFIRMED but no supporting entities linked",
        entityA: h.title,
        entityB: "(no supporting entities)",
        severity: "BLOCKING",
      });
    }
  }

  // ============================================================
  // TIMELINE CORRELATION
  // ============================================================
  const timelineCorrelation: TimelineCorrelation = {
    hasTimeline: timelineRaw.length > 0,
    eventCount: timelineRaw.length,
    earliestEvent: null,
    latestEvent: null,
    timespan: null,
    proceedsTimestamps: [],
    correlationSignals: [],
    largestGap: null,
    activityClusters: 0,
  };

  if (timelineRaw.length >= 2) {
    const sorted = [...timelineRaw].sort(
      (a, b) => a.eventDate.getTime() - b.eventDate.getTime()
    );
    timelineCorrelation.earliestEvent = sorted[0].eventDate.toISOString();
    timelineCorrelation.latestEvent =
      sorted[sorted.length - 1].eventDate.toISOString();
    const spanMs =
      sorted[sorted.length - 1].eventDate.getTime() -
      sorted[0].eventDate.getTime();
    const spanDays = Math.round(spanMs / (1000 * 60 * 60 * 24));
    timelineCorrelation.timespan = `${spanDays} days`;

    let largestGapMs = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap =
        sorted[i].eventDate.getTime() - sorted[i - 1].eventDate.getTime();
      if (gap > largestGapMs) largestGapMs = gap;
    }
    const largestGapDays = Math.round(largestGapMs / (1000 * 60 * 60 * 24));
    timelineCorrelation.largestGap =
      largestGapDays > 0 ? `${largestGapDays} days between events` : null;

    // Cluster detection: events within 48h grouped
    let clusters = 0;
    let lastClusterTime: number | null = null;
    for (const ev of sorted) {
      const t = ev.eventDate.getTime();
      if (lastClusterTime === null || t - lastClusterTime > 48 * 3600 * 1000) {
        clusters++;
      }
      lastClusterTime = t;
    }
    timelineCorrelation.activityClusters = clusters;

    if (clusters >= 2 && spanDays < 30) {
      timelineCorrelation.correlationSignals.push({
        type: "RAPID_EXIT",
        description: `${clusters} activity clusters detected within ${spanDays} days — possible rapid exit pattern`,
        confidence: "MEDIUM",
      });
    }
  }

  // KolProceedsEvent does not exist in this schema. proceedsTimestamps stays
  // empty. Surface this honestly via NO_ALIGNMENT.
  if (timelineCorrelation.proceedsTimestamps.length === 0) {
    timelineCorrelation.correlationSignals.push({
      type: "NO_ALIGNMENT",
      description: "No proceeds timestamp data available for correlation",
      confidence: "LOW",
    });
  }

  return {
    caseId,
    template: caseRow?.caseTemplate ?? "blank",
    entityCount: entitiesRaw.length,
    entities: enrichedEntities,
    hypotheses: hypothesesRaw.map((h) => ({
      title: h.title,
      status: h.status,
      confidence: h.confidence,
    })),
    timeline: timelineRaw.map((t) => ({
      date: t.eventDate.toISOString(),
      title: t.title,
      description: t.description ?? undefined,
    })),
    networkIntelligence: {
      relatedActors: networkActors,
      linkedWalletsCount,
      observedEventsCount,
      networkName: undefined,
    },
    intelVaultRefs,
    twinState: {
      gaps,
      conflicts,
      publicationReadiness: readiness,
      nextSuggestedAction,
    },
    confidenceAssessment,
    contradictions: contradictionSignals,
    timelineCorrelation,
  };
}

// ============================================================================
// LIGHT SUMMARY — for /intelligence-summary route
// ============================================================================
// Returns only the counters shown in the assistant indicator strip. Does NOT
// run timeline correlation, confidence rules, contradiction detection, or
// twin state computation. Saves ~4 heavy DB queries per call compared to the
// full buildCaseIntelligencePack().

export type CaseIntelligenceSummary = {
  entityCount: number;
  kolMatches: number;
  proceedsTotal: number;
  networkActors: number;
  laundryTrails: number;
  intelVaultRefs: number;
};

export async function buildCaseIntelligenceSummary(
  caseId: string,
  _workspaceId: string
): Promise<CaseIntelligenceSummary> {
  const entities = await safeQuery(
    () =>
      prisma.vaultCaseEntity.findMany({
        where: { caseId },
        select: { type: true, value: true },
        take: 500,
      }),
    [] as Array<{ type: string; value: string }>
  );
  const entityCount = entities.length;

  const walletValues = entities
    .filter((e) => e.type === "WALLET" || e.type === "CONTRACT")
    .map((e) => e.value);
  const handleValues = entities
    .filter((e) => e.type === "HANDLE")
    .map((e) => normalizeHandle(e.value));

  const walletMatches = await safeQuery(
    () =>
      walletValues.length === 0
        ? Promise.resolve([])
        : prisma.kolWallet.findMany({
            where: {
              OR: [
                { address: { in: walletValues } },
                { address: { in: walletValues.map((v) => v.toLowerCase()) } },
              ],
            },
            select: { kolHandle: true },
          }),
    [] as Array<{ kolHandle: string }>
  );

  const matchedHandlesFromWallets = new Set(
    walletMatches.map((w) => w.kolHandle.toLowerCase())
  );
  const allMatchedHandles = new Set<string>([
    ...matchedHandlesFromWallets,
    ...handleValues,
  ]);
  const handlesArray = Array.from(allMatchedHandles);

  const profiles = await safeQuery(
    () =>
      handlesArray.length === 0
        ? Promise.resolve([])
        : prisma.kolProfile.findMany({
            where: { handle: { in: handlesArray, mode: "insensitive" } },
            select: {
              handle: true,
              totalDocumented: true,
              totalScammed: true,
            },
          }),
    [] as Array<{
      handle: string;
      totalDocumented: number | null;
      totalScammed: number | null;
    }>
  );

  const kolMatches = profiles.length;
  const proceedsTotal = profiles.reduce(
    (sum, p) => sum + (p.totalDocumented ?? p.totalScammed ?? 0),
    0
  );

  // Network actor discovery — shared wallet address overlap only.
  let networkActors = 0;
  if (handlesArray.length > 0) {
    const allLinkedWallets = await safeQuery(
      () =>
        prisma.kolWallet.findMany({
          where: {
            kolHandle: { in: handlesArray, mode: "insensitive" },
          },
          select: { address: true },
          take: 500,
        }),
      [] as Array<{ address: string }>
    );
    const sharedAddresses = allLinkedWallets.map((w) => w.address);
    if (sharedAddresses.length > 0) {
      const counterparts = await safeQuery(
        () =>
          prisma.kolWallet.findMany({
            where: {
              address: { in: sharedAddresses },
              kolHandle: { notIn: handlesArray, mode: "insensitive" },
            },
            select: { kolHandle: true },
            take: 200,
          }),
        [] as Array<{ kolHandle: string }>
      );
      networkActors = new Set(
        counterparts.map((c) => c.kolHandle.toLowerCase())
      ).size;
    }
  }

  const laundryTrails =
    handlesArray.length === 0
      ? 0
      : await safeQuery(
          () =>
            prisma.laundryTrail.count({
              where: {
                kolHandle: { in: handlesArray, mode: "insensitive" },
              },
            }),
          0
        );

  const intelVaultRefs =
    handlesArray.length === 0
      ? 0
      : await safeQuery(
          () =>
            prisma.kolCase.count({
              where: {
                kolHandle: { in: handlesArray, mode: "insensitive" },
              },
            }),
          0
        );

  return {
    entityCount,
    kolMatches,
    proceedsTotal,
    networkActors,
    laundryTrails,
    intelVaultRefs,
  };
}
