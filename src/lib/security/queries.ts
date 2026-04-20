/**
 * Read-side helpers for the Security Center.
 *
 * All server-only. No mutations here. Route handlers + server components
 * import these to render overview / detail pages. Lives in its own module
 * so the big client pages stay lightweight and testable.
 */

import { prisma } from "@/lib/prisma";

export interface SecurityOverview {
  vendorCount: number;
  activeSourceCount: number;
  openIncidentCount: number;
  criticalOpenIncidentCount: number;
  exposedIncidentCount: number; // exposure probable or confirmed
  lastIncidentAt: Date | null;
  lastDigest: {
    generatedAt: Date;
    subject: string;
    deliveryStatus: string;
    sentAt: Date | null;
  } | null;
  openActionItemCount: number;
  openP1ActionItemCount: number;
}

export async function getSecurityOverview(): Promise<SecurityOverview> {
  const [
    vendorCount,
    activeSourceCount,
    openIncidentCount,
    criticalOpenIncidentCount,
    exposedIncidentCount,
    lastIncident,
    lastDigest,
    openActionItemCount,
    openP1ActionItemCount,
  ] = await Promise.all([
    prisma.securityVendor.count({ where: { isActive: true } }),
    prisma.securitySource.count({ where: { isActive: true } }),
    prisma.securityIncident.count({
      where: { status: { notIn: ["resolved", "archived"] } },
    }),
    prisma.securityIncident.count({
      where: {
        severity: { in: ["critical", "high"] },
        status: { notIn: ["resolved", "archived"] },
      },
    }),
    prisma.securityExposureAssessment.count({
      where: { exposureLevel: { in: ["probable", "confirmed"] } },
    }),
    prisma.securityIncident.findFirst({
      orderBy: { detectedAt: "desc" },
      select: { detectedAt: true },
    }),
    prisma.securityWeeklyDigest.findFirst({
      orderBy: { generatedAt: "desc" },
      select: {
        generatedAt: true,
        subject: true,
        deliveryStatus: true,
        sentAt: true,
      },
    }),
    prisma.securityActionItem.count({
      where: { status: { notIn: ["done", "dismissed"] } },
    }),
    prisma.securityActionItem.count({
      where: {
        priority: "p1",
        status: { notIn: ["done", "dismissed"] },
      },
    }),
  ]);

  return {
    vendorCount,
    activeSourceCount,
    openIncidentCount,
    criticalOpenIncidentCount,
    exposedIncidentCount,
    lastIncidentAt: lastIncident?.detectedAt ?? null,
    lastDigest,
    openActionItemCount,
    openP1ActionItemCount,
  };
}

export async function listIncidents(opts: {
  limit?: number;
  status?: string[];
  severity?: string[];
} = {}) {
  const { limit = 50, status, severity } = opts;
  return prisma.securityIncident.findMany({
    where: {
      ...(status ? { status: { in: status } } : {}),
      ...(severity ? { severity: { in: severity } } : {}),
    },
    orderBy: { detectedAt: "desc" },
    take: Math.min(200, Math.max(1, limit)),
    include: {
      vendor: { select: { name: true, slug: true, category: true } },
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function listVendors() {
  return prisma.securityVendor.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { incidents: true, sources: true } },
      incidents: {
        orderBy: { detectedAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          detectedAt: true,
        },
      },
    },
  });
}

export async function listOpenActionItems(limit = 30) {
  return prisma.securityActionItem.findMany({
    where: { status: { notIn: ["done", "dismissed"] } },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      incident: {
        select: { id: true, title: true, severity: true, status: true },
      },
    },
  });
}

export async function listThreats() {
  return prisma.securityThreatCatalog.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
}

export async function getIncidentDetail(id: string) {
  return prisma.securityIncident.findUnique({
    where: { id },
    include: {
      vendor: true,
      source: true,
      assessments: { orderBy: { createdAt: "desc" } },
      actionItems: { orderBy: [{ priority: "asc" }, { createdAt: "desc" }] },
      comms: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function buildDigestInputForPeriod(
  periodStart: Date,
  periodEnd: Date,
) {
  const [newIncidents, criticalIncidents, openActionItems, exposed] =
    await Promise.all([
      prisma.securityIncident.findMany({
        where: {
          detectedAt: { gte: periodStart, lt: periodEnd },
        },
        orderBy: { detectedAt: "desc" },
        include: {
          vendor: { select: { name: true } },
          assessments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { exposureLevel: true },
          },
        },
      }),
      prisma.securityIncident.findMany({
        where: {
          severity: { in: ["critical", "high"] },
          status: { notIn: ["resolved", "archived"] },
        },
        orderBy: { detectedAt: "desc" },
        take: 10,
        include: {
          vendor: { select: { name: true } },
          assessments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { exposureLevel: true },
          },
        },
      }),
      prisma.securityActionItem.findMany({
        where: { status: { notIn: ["done", "dismissed"] } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 20,
        include: { incident: { select: { title: true } } },
      }),
      prisma.securityExposureAssessment.findMany({
        where: { exposureLevel: { in: ["possible", "probable", "confirmed"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { incident: { select: { title: true } } },
      }),
    ]);

  type IncidentWithVendor = (typeof newIncidents)[number];
  const mapIncident = (r: IncidentWithVendor) => ({
    id: r.id,
    title: r.title,
    summaryShort: r.summaryShort,
    incidentType: r.incidentType,
    severity: r.severity as "info" | "low" | "medium" | "high" | "critical",
    status: r.status,
    detectedAt: r.detectedAt,
    vendorName: r.vendor?.name ?? null,
    exposureLevel: (r.assessments[0]?.exposureLevel ?? null) as
      | "none"
      | "unlikely"
      | "possible"
      | "probable"
      | "confirmed"
      | null,
  });

  return {
    periodStart,
    periodEnd,
    newIncidents: newIncidents.map(mapIncident),
    criticalIncidents: criticalIncidents.map(mapIncident),
    openActionItems: openActionItems.map((a) => ({
      title: a.title,
      priority: a.priority,
      incidentTitle: a.incident?.title ?? null,
    })),
    exposureHighlights: exposed.map((e) => {
      const surface = (e.affectedSurface as { summary?: string } | null) ?? {};
      return {
        incidentTitle: e.incident?.title ?? "(unlinked)",
        level: e.exposureLevel,
        summary: surface.summary ?? "Vendor surface unmapped.",
      };
    }),
  };
}
