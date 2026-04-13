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
        select: { title: true, status: true, confidence: true },
        take: 100,
      }),
    [] as Array<{ title: string; status: string; confidence: number }>
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

  return {
    caseId,
    template: caseRow?.caseTemplate ?? "blank",
    entityCount: entitiesRaw.length,
    entities: enrichedEntities,
    hypotheses: hypothesesRaw,
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
  };
}
