/**
 * Rapport hebdomadaire unifié — INTERLIGENS.
 *
 * Fusionne les trois digests historiques en UN SEUL email FRANÇAIS :
 *   - Security Digest      (src/lib/security/email/digest.ts)
 *   - Weekly Digest        (src/lib/email/weeklyDigest.ts)
 *   - Intelligence Digest  (src/lib/digest/*)
 *
 * Expéditeur : alerts@interligens.com
 * Destinataire : admin@interligens.com
 * Envoyé chaque lundi 08:00 UTC par le cron /api/cron/weekly-digest.
 *
 * Ne lève jamais d'exception : chaque requête est protégée par `safe()`,
 * et l'envoi Resend renvoie un statut structuré.
 */

import { prisma } from "@/lib/prisma";
import { gatherStats } from "@/lib/email/weeklyDigest";
import { buildDigestInputForPeriod } from "@/lib/security/queries";

// ── Types ────────────────────────────────────────────────────────────

export interface FlaggedKol {
  handle: string;
  tier: string;
  rugCount: number;
  signalCount: number;
  tokens: string[];
}

export interface DigestCampaign {
  tokenSymbol: string | null;
  contractAddress: string | null;
  priority: string;
  kolHandles: string[];
  signalCount: number;
  claimPatterns: string[];
}

export interface DigestIncident {
  title: string;
  severity: string;
  detectedAt: Date;
  impact: string;
  status: string;
}

export interface SecurityActionItem {
  title: string;
  priority: string;
  incidentTitle: string | null;
}

export interface SecurityExposure {
  incidentTitle: string;
  level: string;
  summary: string;
}

export interface UnifiedStats {
  windowStart: Date;
  windowEnd: Date;
  // Résumé
  totalKol: number;
  newKolCount: number;
  newKolHandles: string[];
  proceedsUsd: number;
  proceedsEvents: number;
  newCandidates: number;
  newAlerts: number;
  activeCampaignCount: number;
  highPriorityCount: number;
  securityIncidentCount: number;
  securityActionCount: number;
  // Sections détaillées
  flaggedKols: FlaggedKol[];
  topCampaigns: DigestCampaign[];
  criticalIncidents: DigestIncident[];
  newIncidents: DigestIncident[];
  openActionItems: SecurityActionItem[];
  exposureHighlights: SecurityExposure[];
}

export interface SendResult {
  delivered: boolean;
  skipped?: "no_api_key";
  error?: string;
  stats?: UnifiedStats;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[unifiedDigest] requête échouée", err);
    return fallback;
  }
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function parseClaimPatterns(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ── Collecte des données ─────────────────────────────────────────────

export async function gatherUnifiedStats(): Promise<UnifiedStats> {
  const base = await gatherStats();
  const { windowStart, windowEnd } = base;

  const totalKol = await safe(() => prisma.kolProfile.count(), 0);

  // NOUVELLES MENACES — profils KOL flaggés cette semaine.
  const flaggedRaw = await safe(
    () =>
      prisma.kolProfile.findMany({
        where: {
          createdAt: { gte: windowStart },
          riskFlag: { not: "unverified" },
        },
        select: { handle: true, tier: true, rugCount: true },
        orderBy: { rugCount: "desc" },
        take: 15,
      }),
    [] as Array<{ handle: string; tier: string | null; rugCount: number }>,
  );

  const flaggedHandles = flaggedRaw.map((k) => k.handle);

  // Signaux + tokens par handle, via les campagnes du watcher.
  const campaignLinks =
    flaggedHandles.length > 0
      ? await safe(
          () =>
            prisma.watcherCampaignKOL.findMany({
              where: { kolHandle: { in: flaggedHandles } },
              select: {
                kolHandle: true,
                signalCount: true,
                campaign: { select: { primaryTokenSymbol: true } },
              },
            }),
          [] as Array<{
            kolHandle: string;
            signalCount: number;
            campaign: { primaryTokenSymbol: string | null } | null;
          }>,
        )
      : [];

  const byHandle = new Map<string, { signals: number; tokens: Set<string> }>();
  for (const link of campaignLinks) {
    const entry = byHandle.get(link.kolHandle) ?? {
      signals: 0,
      tokens: new Set<string>(),
    };
    entry.signals += link.signalCount;
    const sym = link.campaign?.primaryTokenSymbol;
    if (sym) entry.tokens.add(sym);
    byHandle.set(link.kolHandle, entry);
  }

  const flaggedKols: FlaggedKol[] = flaggedRaw.map((k) => {
    const agg = byHandle.get(k.handle);
    return {
      handle: k.handle,
      tier: k.tier ?? "UNKNOWN",
      rugCount: k.rugCount ?? 0,
      signalCount: agg?.signals ?? 0,
      tokens: agg ? [...agg.tokens] : [],
    };
  });

  // CAMPAGNES HAUTE PRIORITÉ.
  const activeCampaignCount = await safe(
    () => prisma.watcherCampaign.count({ where: { status: "ACTIVE" } }),
    0,
  );
  const highPriorityCount = await safe(
    () =>
      prisma.watcherCampaign.count({
        where: { status: "ACTIVE", priority: { in: ["HIGH", "CRITICAL"] } },
      }),
    0,
  );

  const campaignsRaw = await safe(
    () =>
      prisma.watcherCampaign.findMany({
        where: { status: "ACTIVE" },
        select: {
          primaryTokenSymbol: true,
          primaryContractAddress: true,
          priority: true,
          signalCount: true,
          claimPatterns: true,
          campaignKols: { select: { kolHandle: true }, take: 6 },
        },
        take: 80,
      }),
    [] as Array<{
      primaryTokenSymbol: string | null;
      primaryContractAddress: string | null;
      priority: string;
      signalCount: number;
      claimPatterns: string;
      campaignKols: Array<{ kolHandle: string }>;
    }>,
  );

  const topCampaigns: DigestCampaign[] = campaignsRaw
    .map((c) => ({
      tokenSymbol: c.primaryTokenSymbol,
      contractAddress: c.primaryContractAddress,
      priority: c.priority,
      kolHandles: c.campaignKols.map((k) => k.kolHandle),
      signalCount: c.signalCount,
      claimPatterns: parseClaimPatterns(c.claimPatterns),
    }))
    .sort((a, b) => {
      const pr =
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (pr !== 0) return pr;
      return b.signalCount - a.signalCount;
    })
    .slice(0, 10);

  // SÉCURITÉ — tout le contenu de l'ex-Security Digest standalone est
  // désormais intégré ici (incidents critiques, nouveaux incidents,
  // actions ouvertes, expositions). Le cron security-weekly-digest est
  // déprécié — ce digest unifié est le seul email hebdomadaire.
  const securityInput = await safe(
    () => buildDigestInputForPeriod(windowStart, windowEnd),
    null,
  );
  const mapIncident = (r: {
    title: string;
    severity: string;
    detectedAt: Date;
    summaryShort: string;
    status: string;
  }): DigestIncident => ({
    title: r.title,
    severity: r.severity,
    detectedAt: r.detectedAt,
    impact: r.summaryShort,
    status: r.status,
  });
  const criticalIncidents: DigestIncident[] = securityInput
    ? securityInput.criticalIncidents.map(mapIncident)
    : [];
  const newIncidents: DigestIncident[] = securityInput
    ? securityInput.newIncidents.map(mapIncident)
    : [];
  const openActionItems: SecurityActionItem[] = securityInput
    ? securityInput.openActionItems
    : [];
  const exposureHighlights: SecurityExposure[] = securityInput
    ? securityInput.exposureHighlights
    : [];

  return {
    windowStart,
    windowEnd,
    totalKol,
    newKolCount: base.newKolCount,
    newKolHandles: base.newKolHandles,
    proceedsUsd: base.proceedsUsd,
    proceedsEvents: base.proceedsEvents,
    newCandidates: base.newCandidates,
    newAlerts: base.newAlerts,
    activeCampaignCount,
    highPriorityCount,
    securityIncidentCount: newIncidents.length,
    securityActionCount: openActionItems.length,
    flaggedKols,
    topCampaigns,
    criticalIncidents,
    newIncidents,
    openActionItems,
    exposureHighlights,
  };
}

// ── Rendu HTML ───────────────────────────────────────────────────────

const C = {
  bg: "#000000",
  surface: "#0d0d0d",
  border: "#1c1c1c",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.45)",
  dim: "rgba(255,255,255,0.3)",
  accent: "#FF6B00",
  critical: "#FF3B5C",
  warning: "#FFB800",
} as const;

function severityColor(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "critical") return C.critical;
  if (s === "high") return C.accent;
  if (s === "medium") return C.warning;
  return C.muted;
}

function priorityColor(p: string): string {
  if (p === "CRITICAL") return C.critical;
  if (p === "HIGH") return C.accent;
  if (p === "MEDIUM") return C.warning;
  return C.muted;
}

function summaryCard(value: string, label: string, accent = false): string {
  return `<td style="text-align:center;padding:14px 6px;background:${C.surface};border:1px solid ${
    accent ? C.accent : C.border
  };border-radius:8px;">
    <div style="font-size:26px;font-weight:800;color:${accent ? C.accent : C.text};">${escapeHtml(value)}</div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};margin-top:5px;">${escapeHtml(label)}</div>
  </td>`;
}

function sectionTitle(label: string): string {
  return `<tr><td style="padding:26px 0 12px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:${C.accent};font-weight:700;">${label}</div>
  </td></tr>`;
}

export function buildUnifiedDigestHtml(s: UnifiedStats): string {
  const periode = `${formatDate(s.windowStart)} → ${formatDate(s.windowEnd)}`;

  // 🔴 SÉCURITÉ — contenu intégral de l'ex-Security Digest standalone.
  const subHeader = (label: string): string =>
    `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:${C.muted};font-weight:700;margin:14px 0 8px;">${escapeHtml(label)}</div>`;

  const incidentTable = (incidents: DigestIncident[], border: string): string =>
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};border:1px solid ${border};border-radius:8px;">
      <tr style="background:#141414;">
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Incident</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Sévérité</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Date</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Statut</th>
      </tr>
      ${incidents
        .map(
          (i) => `<tr>
        <td style="padding:10px 12px;border-top:1px solid ${C.border};font-size:12px;color:${C.text};">
          <div style="font-weight:600;">${escapeHtml(i.title)}</div>
          <div style="font-size:11px;color:${C.muted};margin-top:3px;">${escapeHtml(i.impact)}</div>
        </td>
        <td style="padding:10px 12px;border-top:1px solid ${C.border};font-size:11px;font-weight:700;text-transform:uppercase;color:${severityColor(i.severity)};">${escapeHtml(i.severity)}</td>
        <td style="padding:10px 12px;border-top:1px solid ${C.border};font-size:11px;color:${C.muted};">${formatDate(i.detectedAt)}</td>
        <td style="padding:10px 12px;border-top:1px solid ${C.border};font-size:11px;color:${C.muted};">${escapeHtml(i.status)}</td>
      </tr>`,
        )
        .join("")}
    </table>`;

  const hasSecurity =
    s.criticalIncidents.length > 0 ||
    s.newIncidents.length > 0 ||
    s.openActionItems.length > 0 ||
    s.exposureHighlights.length > 0;

  const alertesSection = `${sectionTitle("🔴 Sécurité")}
      <tr><td>
        ${
          s.criticalIncidents.length > 0
            ? subHeader("Incidents critiques / élevés ouverts") +
              incidentTable(s.criticalIncidents, `${C.critical}40`)
            : ""
        }
        ${
          s.newIncidents.length > 0
            ? subHeader("Nouveaux incidents (7 jours)") +
              incidentTable(s.newIncidents, C.border)
            : ""
        }
        ${
          s.openActionItems.length > 0
            ? subHeader("Actions de sécurité ouvertes") +
              `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;">
                ${s.openActionItems
                  .map(
                    (a) => `<tr><td style="padding:9px 12px;border-top:1px solid ${C.border};font-size:12px;color:${C.text};">
                  <span style="color:${C.accent};font-weight:700;text-transform:uppercase;font-size:10px;margin-right:8px;">${escapeHtml(a.priority)}</span>${escapeHtml(a.title)}${a.incidentTitle ? `<span style="color:${C.muted};font-size:11px;"> · ${escapeHtml(a.incidentTitle)}</span>` : ""}
                </td></tr>`,
                  )
                  .join("")}
              </table>`
            : ""
        }
        ${
          s.exposureHighlights.length > 0
            ? subHeader("Exposition INTERLIGENS") +
              `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;">
                ${s.exposureHighlights
                  .map(
                    (e) => `<tr><td style="padding:9px 12px;border-top:1px solid ${C.border};font-size:12px;color:${C.text};">
                  <div style="font-weight:600;">${escapeHtml(e.incidentTitle)} <span style="color:${C.warning};font-size:10px;text-transform:uppercase;"> · ${escapeHtml(e.level)}</span></div>
                  <div style="font-size:11px;color:${C.muted};margin-top:3px;">${escapeHtml(e.summary)}</div>
                </td></tr>`,
                  )
                  .join("")}
              </table>`
            : ""
        }
        ${
          hasSecurity
            ? ""
            : `<div style="font-size:12px;color:${C.muted};padding:4px 0;">Aucun incident ni action de sécurité en attente cette semaine.</div>`
        }
      </td></tr>`;

  // 🟠 NOUVELLES MENACES
  const menacesRows =
    s.flaggedKols.length > 0
      ? s.flaggedKols
          .map(
            (k) => `<tr>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};font-family:monospace;font-size:12px;color:${C.accent};">@${escapeHtml(k.handle)}</td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};font-size:11px;font-weight:700;color:${k.tier === "RED" ? C.critical : C.warning};">${escapeHtml(k.tier)}</td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};text-align:center;font-size:12px;color:${C.text};">${k.signalCount}</td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};font-size:11px;color:${C.muted};">${k.tokens.length ? escapeHtml(k.tokens.slice(0, 4).join(", ")) : "—"}</td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};text-align:center;font-size:12px;color:${k.rugCount > 0 ? C.critical : C.muted};">${k.rugCount > 0 ? k.rugCount : "—"}</td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="5" style="padding:12px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">Aucun nouveau profil flaggé cette semaine.</td></tr>`;

  // 🟢 CAMPAGNES HAUTE PRIORITÉ
  const campagnesRows =
    s.topCampaigns.length > 0
      ? s.topCampaigns
          .map((c) => {
            const token = c.tokenSymbol ? `$${escapeHtml(c.tokenSymbol)}` : "—";
            const kols = c.kolHandles.length
              ? escapeHtml(
                  c.kolHandles
                    .slice(0, 4)
                    .map((h) => `@${h}`)
                    .join(" "),
                )
              : "—";
            const claims = c.claimPatterns.length
              ? escapeHtml(c.claimPatterns.slice(0, 3).join(", "))
              : "—";
            return `<tr>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};">
          <span style="font-size:9px;font-weight:700;text-transform:uppercase;color:${priorityColor(c.priority)};">${escapeHtml(c.priority)}</span>
          <div style="font-size:13px;font-weight:700;color:${C.text};">${token}</div>
        </td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};font-size:11px;color:${C.accent};">${kols}</td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};text-align:center;font-size:12px;color:${C.text};">${c.signalCount}</td>
        <td style="padding:9px 12px;border-top:1px solid ${C.border};font-size:11px;color:${C.warning};">${claims}</td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="4" style="padding:12px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">Aucune campagne active cette semaine.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${C.text};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- En-tête -->
  <tr><td style="padding-bottom:20px;border-bottom:2px solid ${C.accent};">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:${C.accent};font-weight:700;">🐯 INTERLIGENS</div>
    <div style="font-size:26px;font-weight:800;color:${C.text};margin-top:10px;">Rapport hebdomadaire</div>
    <div style="font-size:11px;color:${C.dim};margin-top:6px;">Période : ${escapeHtml(periode)}</div>
  </td></tr>

  <!-- 📊 RÉSUMÉ -->
  ${sectionTitle("📊 Résumé")}
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${summaryCard(String(s.totalKol), "KOL surveillés")}
        <td width="8"></td>
        ${summaryCard(String(s.newKolCount), "Nouveaux profils")}
        <td width="8"></td>
        ${summaryCard(String(s.newCandidates), "Signaux détectés")}
      </tr>
      <tr><td colspan="5" height="8"></td></tr>
      <tr>
        ${summaryCard(String(s.activeCampaignCount), "Campagnes actives")}
        <td width="8"></td>
        ${summaryCard(String(s.highPriorityCount), "Priorité haute", s.highPriorityCount > 0)}
        <td width="8"></td>
        ${summaryCard(formatUsd(s.proceedsUsd), "Fonds tracés", true)}
      </tr>
    </table>
  </td></tr>

  ${alertesSection}

  <!-- 🟠 NOUVELLES MENACES -->
  ${sectionTitle("🟠 Nouvelles menaces")}
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;">
      <tr style="background:#141414;">
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Handle</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Tier</th>
        <th style="padding:8px 12px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Signaux</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Tokens</th>
        <th style="padding:8px 12px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Rugs</th>
      </tr>
      ${menacesRows}
    </table>
  </td></tr>

  <!-- 🟢 CAMPAGNES HAUTE PRIORITÉ -->
  ${sectionTitle("🟢 Campagnes haute priorité")}
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;">
      <tr style="background:#141414;">
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Token</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">KOLs impliqués</th>
        <th style="padding:8px 12px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Signaux</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.dim};">Claims</th>
      </tr>
      ${campagnesRows}
    </table>
  </td></tr>

  <!-- 📈 CHIFFRES -->
  ${sectionTitle("📈 Chiffres")}
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;">
      <tr>
        <td style="padding:10px 14px;font-size:12px;color:${C.muted};">Posts analysés</td>
        <td style="padding:10px 14px;text-align:right;font-size:14px;font-weight:700;color:${C.text};">${s.newCandidates}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">Fonds observés</td>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};text-align:right;font-size:14px;font-weight:700;color:${C.accent};">${formatUsd(s.proceedsUsd)} <span style="font-size:11px;color:${C.dim};">(${s.proceedsEvents} évén.)</span></td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">Alertes watcher</td>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};text-align:right;font-size:14px;font-weight:700;color:${C.text};">${s.newAlerts}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">Incidents sécurité (7 j)</td>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};text-align:right;font-size:14px;font-weight:700;color:${C.text};">${s.securityIncidentCount}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">Actions sécurité ouvertes</td>
        <td style="padding:10px 14px;border-top:1px solid ${C.border};text-align:right;font-size:14px;font-weight:700;color:${C.text};">${s.securityActionCount}</td>
      </tr>
    </table>
  </td></tr>

  <!-- 🔗 ACTIONS -->
  ${sectionTitle("🔗 Actions")}
  <tr><td style="padding-bottom:8px;">
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:8px;padding-bottom:8px;">
          <a href="https://app.interligens.com/admin" style="display:inline-block;background:${C.accent};color:#000000;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:12px;font-weight:700;">Ouvrir le Dashboard →</a>
        </td>
        <td style="padding-right:8px;padding-bottom:8px;">
          <a href="https://app.interligens.com/admin/watcher" style="display:inline-block;background:#111;color:${C.text};text-decoration:none;padding:10px 16px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #2a2a2a;">Voir les Signaux →</a>
        </td>
        <td style="padding-bottom:8px;">
          <a href="https://app.interligens.com/en/kol-registry" style="display:inline-block;background:#111;color:${C.text};text-decoration:none;padding:10px 16px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #2a2a2a;">KOL Registry →</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Pied de page -->
  <tr><td style="padding-top:20px;border-top:1px solid ${C.border};color:${C.dim};font-size:10px;line-height:1.7;">
    INTERLIGENS · Rapport automatique.<br>
    Ce mail est envoyé chaque lundi à 10h UTC.<br>
    <a href="mailto:admin@interligens.com" style="color:${C.accent};text-decoration:none;">admin@interligens.com</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Rendu texte brut ─────────────────────────────────────────────────

export function buildUnifiedDigestText(s: UnifiedStats): string {
  const lines: string[] = [];
  lines.push("INTERLIGENS — RAPPORT HEBDOMADAIRE");
  lines.push(`Période : ${formatDate(s.windowStart)} → ${formatDate(s.windowEnd)}`);
  lines.push("");
  lines.push("RÉSUMÉ");
  lines.push(`  KOL surveillés     : ${s.totalKol}`);
  lines.push(`  Nouveaux profils   : ${s.newKolCount}`);
  lines.push(`  Signaux détectés   : ${s.newCandidates}`);
  lines.push(`  Campagnes actives  : ${s.activeCampaignCount}`);
  lines.push(`  Priorité haute     : ${s.highPriorityCount}`);
  lines.push(`  Fonds tracés       : ${formatUsd(s.proceedsUsd)}`);
  lines.push("");

  lines.push("SÉCURITÉ");
  if (s.criticalIncidents.length > 0) {
    lines.push("  Incidents critiques / élevés ouverts :");
    for (const i of s.criticalIncidents) {
      lines.push(`    · [${i.severity.toUpperCase()}] ${i.title} — ${formatDate(i.detectedAt)} (${i.status})`);
      lines.push(`      ${i.impact}`);
    }
  }
  if (s.newIncidents.length > 0) {
    lines.push("  Nouveaux incidents (7 jours) :");
    for (const i of s.newIncidents) {
      lines.push(`    · [${i.severity.toUpperCase()}] ${i.title} — ${formatDate(i.detectedAt)} (${i.status})`);
    }
  }
  if (s.openActionItems.length > 0) {
    lines.push("  Actions de sécurité ouvertes :");
    for (const a of s.openActionItems) {
      lines.push(`    · [${a.priority.toUpperCase()}] ${a.title}${a.incidentTitle ? ` (${a.incidentTitle})` : ""}`);
    }
  }
  if (s.exposureHighlights.length > 0) {
    lines.push("  Exposition INTERLIGENS :");
    for (const e of s.exposureHighlights) {
      lines.push(`    · ${e.incidentTitle} — exposition : ${e.level}`);
      lines.push(`      ${e.summary}`);
    }
  }
  if (
    s.criticalIncidents.length === 0 &&
    s.newIncidents.length === 0 &&
    s.openActionItems.length === 0 &&
    s.exposureHighlights.length === 0
  ) {
    lines.push("  Aucun incident ni action de sécurité en attente cette semaine.");
  }
  lines.push("");

  lines.push("NOUVELLES MENACES");
  if (s.flaggedKols.length > 0) {
    for (const k of s.flaggedKols) {
      lines.push(
        `  · @${k.handle} [${k.tier}] — ${k.signalCount} signaux · ${k.rugCount} rugs · ${k.tokens.join(", ") || "—"}`,
      );
    }
  } else {
    lines.push("  Aucun nouveau profil flaggé cette semaine.");
  }
  lines.push("");

  lines.push("CAMPAGNES HAUTE PRIORITÉ");
  if (s.topCampaigns.length > 0) {
    for (const c of s.topCampaigns) {
      lines.push(
        `  · [${c.priority}] ${c.tokenSymbol ? `$${c.tokenSymbol}` : "—"} — ${c.signalCount} signaux · ${c.kolHandles.slice(0, 4).map((h) => `@${h}`).join(" ") || "—"}`,
      );
    }
  } else {
    lines.push("  Aucune campagne active cette semaine.");
  }
  lines.push("");

  lines.push("CHIFFRES");
  lines.push(`  Posts analysés            : ${s.newCandidates}`);
  lines.push(`  Fonds observés            : ${formatUsd(s.proceedsUsd)} (${s.proceedsEvents} événements)`);
  lines.push(`  Alertes watcher           : ${s.newAlerts}`);
  lines.push(`  Incidents sécurité (7 j)  : ${s.securityIncidentCount}`);
  lines.push(`  Actions sécurité ouvertes : ${s.securityActionCount}`);
  lines.push("");
  lines.push("ACTIONS");
  lines.push("  Dashboard    : https://app.interligens.com/admin");
  lines.push("  Signaux      : https://app.interligens.com/admin/watcher");
  lines.push("  KOL Registry : https://app.interligens.com/en/kol-registry");
  lines.push("");
  lines.push("INTERLIGENS · Rapport automatique · admin@interligens.com");

  return lines.join("\n");
}

// ── Envoi (Resend) ───────────────────────────────────────────────────

export async function sendUnifiedDigest(): Promise<SendResult> {
  const stats = await gatherUnifiedStats();
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      "[unifiedDigest] RESEND_API_KEY manquant — aurait envoyé le rapport hebdo",
    );
    return { delivered: false, skipped: "no_api_key", stats };
  }

  const from =
    process.env.ALERT_FROM_EMAIL ??
    process.env.DIGEST_FROM_EMAIL ??
    "alerts@interligens.com";
  const to =
    process.env.DIGEST_TO_EMAIL ??
    process.env.ALERT_EMAIL ??
    "admin@interligens.com";

  const subject = `🐯 INTERLIGENS — Rapport hebdomadaire — ${formatDate(stats.windowEnd)}`;
  const html = buildUnifiedDigestHtml(stats);
  const text = buildUnifiedDigestText(stats);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[unifiedDigest] erreur Resend",
        res.status,
        body.slice(0, 200),
      );
      return { delivered: false, error: `resend_${res.status}`, stats };
    }

    return { delivered: true, stats };
  } catch (err) {
    console.error("[unifiedDigest] échec fetch", err);
    return { delivered: false, error: "fetch_failed", stats };
  }
}
