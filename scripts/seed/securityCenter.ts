/**
 * Security Center seed — idempotent.
 *
 * Populates:
 *  - SecurityVendor (upsert from src/lib/security/vendors/registry.ts)
 *  - SecuritySource (statuspage sources, one per vendor with statusPageUrl)
 *  - SecurityThreatCatalog (upsert from src/lib/security/threats/catalog.ts)
 *  - SecurityAsset (a small baseline of INTERLIGENS prod assets)
 *  - SecurityIncident #1 — VERCEL BREACH 2026-04-19 (the reference
 *    template for every future incident).
 *  - SecurityExposureAssessment for that incident.
 *  - SecurityActionItem × N for that incident.
 *  - SecurityCommsDraft × 3 (X + public_status + internal) for that
 *    incident.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/seed/securityCenter.ts
 *
 * Safety: upsert-by-slug / upsert-by-unique-key everywhere. Runs fine
 * multiple times. Never deletes.
 *
 * Prereq: the migration at
 *   prisma/migrations/manual_security_center/migration.sql
 * must have been applied in Neon Console first.
 */

// Load .env.local with override BEFORE Prisma reads .env.
require("dotenv").config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { VENDOR_REGISTRY } from "../../src/lib/security/vendors/registry";
import { THREAT_CATALOG } from "../../src/lib/security/threats/catalog";
import { assessExposure } from "../../src/lib/security/assessment/rules";
import { buildDraftSet } from "../../src/lib/security/comms/drafts";

const prisma = new PrismaClient();

async function seedVendors() {
  let created = 0;
  let updated = 0;
  for (const v of VENDOR_REGISTRY) {
    const existing = await prisma.securityVendor.findUnique({
      where: { slug: v.slug },
    });
    if (existing) {
      await prisma.securityVendor.update({
        where: { slug: v.slug },
        data: {
          name: v.name,
          category: v.category,
          websiteUrl: v.websiteUrl ?? null,
          statusPageUrl: v.statusPageUrl ?? null,
          rssUrl: v.rssUrl ?? null,
          atomUrl: v.atomUrl ?? null,
          webhookSupported: v.webhookSupported ?? false,
          emailSupported: v.emailSupported ?? false,
          notes: v.notes ?? null,
        },
      });
      updated += 1;
    } else {
      await prisma.securityVendor.create({
        data: {
          slug: v.slug,
          name: v.name,
          category: v.category,
          websiteUrl: v.websiteUrl ?? null,
          statusPageUrl: v.statusPageUrl ?? null,
          rssUrl: v.rssUrl ?? null,
          atomUrl: v.atomUrl ?? null,
          webhookSupported: v.webhookSupported ?? false,
          emailSupported: v.emailSupported ?? false,
          notes: v.notes ?? null,
        },
      });
      created += 1;
    }
  }
  console.log(`[securityCenter] vendors: ${created} created, ${updated} updated`);
}

async function seedStatusSources() {
  let created = 0;
  for (const v of VENDOR_REGISTRY) {
    if (!v.statusPageUrl) continue;
    const vendor = await prisma.securityVendor.findUnique({
      where: { slug: v.slug },
    });
    if (!vendor) continue;
    // Dedup by (vendorId, sourceType, url).
    const existing = await prisma.securitySource.findFirst({
      where: {
        vendorId: vendor.id,
        sourceType: "statuspage",
        url: v.statusPageUrl,
      },
    });
    if (existing) continue;
    await prisma.securitySource.create({
      data: {
        vendorId: vendor.id,
        sourceType: "statuspage",
        name: `${v.name} status page`,
        url: v.statusPageUrl,
        isActive: true,
        pollIntervalMinutes: 30,
      },
    });
    created += 1;
  }
  console.log(`[securityCenter] sources: ${created} created`);
}

async function seedThreats() {
  let created = 0;
  let updated = 0;
  for (const t of THREAT_CATALOG) {
    const existing = await prisma.securityThreatCatalog.findUnique({
      where: { slug: t.slug },
    });
    if (existing) {
      await prisma.securityThreatCatalog.update({
        where: { slug: t.slug },
        data: {
          title: t.title,
          description: t.description,
          category: t.category,
          targetSurface: t.targetSurface,
          examples: (t.examples ?? null) as unknown as object,
          mitigation: (t.mitigation ?? null) as unknown as object,
        },
      });
      updated += 1;
    } else {
      await prisma.securityThreatCatalog.create({
        data: {
          slug: t.slug,
          title: t.title,
          description: t.description,
          category: t.category,
          targetSurface: t.targetSurface,
          examples: (t.examples ?? null) as unknown as object,
          mitigation: (t.mitigation ?? null) as unknown as object,
        },
      });
      created += 1;
    }
  }
  console.log(`[securityCenter] threats: ${created} created, ${updated} updated`);
}

async function seedAssets() {
  const assets: Array<{
    name: string;
    assetType: string;
    externalRef?: string;
    environment: string;
    isCritical: boolean;
    notes: string;
  }> = [
    {
      name: "app.interligens.com (Vercel production)",
      assetType: "vercel_project",
      externalRef: "prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ",
      environment: "prod",
      isCritical: true,
      notes: "Main production site. Every investigator + retail flow runs here.",
    },
    {
      name: "ep-square-band (Neon prod)",
      assetType: "neon_project",
      externalRef: "ep-square-band-ag2lxpz8",
      environment: "prod",
      isCritical: true,
      notes: "Postgres pooler on port 6543 (Frankfurt).",
    },
    {
      name: "INTERLIGENS GitHub repo",
      assetType: "github_repo",
      externalRef: "INTERLIGENS/interligens-app",
      environment: "prod",
      isCritical: true,
      notes: "Source of truth.",
    },
    {
      name: "interligens.com (Cloudflare zone)",
      assetType: "cloudflare_zone",
      externalRef: "interligens.com",
      environment: "prod",
      isCritical: true,
      notes: "DNS + WAF + Zero Trust.",
    },
    {
      name: "R2 bucket — PDF + RAW docs",
      assetType: "r2_bucket",
      environment: "prod",
      isCritical: true,
      notes: "Encrypted artefacts + signed URLs.",
    },
    {
      name: "Resend account",
      assetType: "email_provider",
      environment: "prod",
      isCritical: false,
      notes: "Transactional email (alerts, digest, welcome).",
    },
  ];
  let created = 0;
  for (const a of assets) {
    const existing = await prisma.securityAsset.findFirst({
      where: { name: a.name, environment: a.environment },
    });
    if (existing) continue;
    await prisma.securityAsset.create({ data: a });
    created += 1;
  }
  console.log(`[securityCenter] assets: ${created} created`);
}

async function seedVercelBreachIncident() {
  const vercel = await prisma.securityVendor.findUnique({
    where: { slug: "vercel" },
  });
  if (!vercel) throw new Error("vendor `vercel` missing — run seedVendors first");

  // Dedup by (vendorId, externalId).
  const externalId = "vercel-breach-shinyhunters-2026-04-19";
  const existing = await prisma.securityIncident.findFirst({
    where: { vendorId: vercel.id, externalId },
  });
  if (existing) {
    console.log(
      `[securityCenter] Vercel breach incident already present (id=${existing.id})`,
    );
    return;
  }

  const detectedAt = new Date("2026-04-19T19:00:00Z"); // Sunday evening Paris

  const incident = await prisma.securityIncident.create({
    data: {
      vendorId: vercel.id,
      externalId,
      title: "Vercel internal systems breach (ShinyHunters / BreachForums)",
      summaryShort:
        "ShinyHunters claimed unauthorized access to Vercel internal systems on BreachForums and asked $2M for the dataset. API keys, env vars and potentially source code of customer projects may have been exposed.",
      summaryLong: [
        "On 2026-04-19 the actor group ShinyHunters posted on BreachForums claiming unauthorized access to Vercel internal systems with a $2M price tag for the dataset.",
        "",
        "What this means for INTERLIGENS:",
        "- Every env var hosted in Vercel Production (ADMIN_TOKEN, RESEND_API_KEY, HELIUS_API_KEY, ETHERSCAN_API_KEY, DATABASE_URL, ADMIN_BASIC_PASS, CRON_SECRET, investigator session signing key, R2 credentials) is potentially exposed.",
        "- Source code of every INTERLIGENS deploy (prod + preview) is potentially exposed.",
        "",
        "Actions already completed on the INTERLIGENS side (2026-04-19 evening):",
        "- Helius API key rotated.",
        "- Neon DATABASE_URL password reset (ep-square-band).",
        "- ADMIN_TOKEN and ADMIN_BASIC_PASS replaced.",
        "- Beta access code `dood-test` reset to sha256(TIGRE2026) via Neon SQL Editor.",
        "- Production redeploy triggered (vercel --prod).",
        "- Upstash reviewed — marketplace add-on inactive, no rotation needed.",
        "- Birdeye + Arkham API keys not in production — out of scope.",
        "",
        "This incident is the V1 reference template for every future vendor incident the Security Center records.",
      ].join("\n"),
      incidentType: "breach",
      severity: "critical",
      status: "mitigated",
      detectedAt,
      occurredAt: detectedAt,
      sourceUrl: "https://breachforums.st/",
      rawPayload: {
        actor: "ShinyHunters",
        asking_price_usd: 2_000_000,
        claimed_assets: [
          "customer API keys",
          "customer env vars",
          "customer source code",
        ],
        disclosure_channel: "BreachForums",
        interligens_rotation_timestamp_iso: detectedAt.toISOString(),
      } as unknown as object,
    },
  });

  const assessment = assessExposure({
    incidentType: "breach",
    severity: "critical",
    vendorSlug: "vercel",
    vendorIsLive: true,
  });

  await prisma.securityExposureAssessment.create({
    data: {
      incidentId: incident.id,
      exposureLevel: "possible", // rotated fast — downgrade from "probable" per analyst note
      affectedSurface: {
        assetTypes: assessment.affectedSurface.assetTypes,
        summary: assessment.affectedSurface.summary,
        enumeratedSecrets: [
          "ADMIN_TOKEN",
          "ADMIN_BASIC_PASS",
          "RESEND_API_KEY",
          "HELIUS_API_KEY",
          "ETHERSCAN_API_KEY",
          "DATABASE_URL",
          "DATABASE_URL_UNPOOLED",
          "CRON_SECRET",
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
        ],
      } as unknown as object,
      requiresKeyRotation: assessment.requiresKeyRotation,
      requiresAccessReview: assessment.requiresAccessReview,
      requiresInfraLogReview: assessment.requiresInfraLogReview,
      requiresPublicStatement: false, // analyst decision 2026-04-19: no public statement required for V1
      actionChecklist: assessment.actionChecklist as unknown as object,
      analystNote:
        "Rotated within hours. Downgraded from probable → possible because attacker would need to have pulled our specific secrets from the dataset AND used them before our rotation window. No anomaly detected in Neon logs or Vercel audit log at time of writing.",
    },
  });

  // ── Action items ────────────────────────────────────────────────
  const actions: Array<{
    title: string;
    description: string;
    priority: "p1" | "p2" | "p3" | "p4";
    status: "done" | "todo" | "in_progress";
  }> = [
    {
      title: "Rotate Helius API key",
      description: "HELIUS_API_KEY regenerated via Helius dashboard and updated in Vercel env.",
      priority: "p1",
      status: "done",
    },
    {
      title: "Reset Neon DATABASE_URL password",
      description:
        "Password reset via Neon Console on ep-square-band; both pooled and unpooled URLs updated in Vercel env.",
      priority: "p1",
      status: "done",
    },
    {
      title: "Replace ADMIN_TOKEN + ADMIN_BASIC_PASS",
      description:
        "Both rotated to fresh random values. admin_session cookies signed with the old token are invalidated on next deploy.",
      priority: "p1",
      status: "done",
    },
    {
      title: "Reset beta access code dood-test",
      description:
        "Access code replaced with sha256(TIGRE2026) via Neon SQL Editor UPDATE on InvestigatorAccess.",
      priority: "p1",
      status: "done",
    },
    {
      title: "Production redeploy",
      description:
        "vercel --prod triggered to load rotated env vars into the running edge + serverless functions.",
      priority: "p1",
      status: "done",
    },
    {
      title: "Review 30 days of Vercel audit log",
      description:
        "Pull deploys, collaborators, env-var changes and webhook invocations for anomalies. TODO if Vercel exposes an audit export API on our plan.",
      priority: "p2",
      status: "todo",
    },
    {
      title: "Review 30 days of Neon access log",
      description:
        "Confirm no unknown IPs connected to ep-square-band between 2026-04-15 and 2026-04-19.",
      priority: "p2",
      status: "todo",
    },
  ];

  for (const a of actions) {
    await prisma.securityActionItem.create({
      data: {
        incidentId: incident.id,
        title: a.title,
        description: a.description,
        priority: a.priority,
        status: a.status,
      },
    });
  }

  // ── Comms drafts ────────────────────────────────────────────────
  const drafts = buildDraftSet({
    incident: {
      title: incident.title,
      summaryShort: incident.summaryShort,
      incidentType: incident.incidentType,
      severity: incident.severity as
        | "info"
        | "low"
        | "medium"
        | "high"
        | "critical",
      detectedAt: incident.detectedAt,
      vendorName: vercel.name,
      sourceUrl: incident.sourceUrl,
    },
    exposure: {
      exposureLevel: "possible",
      affectedSummary:
        "Every production env var + potentially the repo source code.",
      rotatedKeys: true,
      reviewedAccess: false,
      reviewedLogs: false,
    },
  });

  for (const d of drafts) {
    await prisma.securityCommsDraft.create({
      data: {
        incidentId: incident.id,
        channel: d.channel,
        tone: d.tone,
        title: d.title ?? null,
        body: d.body,
      },
    });
  }

  console.log(
    `[securityCenter] Vercel breach seeded as incident ${incident.id} (${actions.length} actions, ${drafts.length} comms drafts)`,
  );
}

async function main() {
  console.log("=== Security Center seed ===");
  await seedVendors();
  await seedStatusSources();
  await seedThreats();
  await seedAssets();
  await seedVercelBreachIncident();
  console.log("=== done ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
