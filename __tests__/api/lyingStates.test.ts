/**
 * __tests__/api/lyingStates.test.ts
 *
 * Trois états qui annonçaient une chose et en faisaient une autre. Chacun était
 * invisible parce que le mensonge portait justement sur le signal qu'on aurait
 * regardé pour s'en apercevoir.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";

// ── 1. identity.review_required ────────────────────────────────────────────
// processEvent tombait dans un `case` vide puis marquait l'événement
// `processed` par l'update de fin de switch. La file admin ne liste que les
// `pending` : le cron quotidien la vidait donc avant qu'un humain la voie.
// Au 2026-08-14 : 160 événements, tous `processed`, aucun arbitré.

const update = vi.fn(async () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    domainEvent: { update: (...a: unknown[]) => update(...a), create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/kol/proceeds", () => ({ computeProceedsForHandle: vi.fn(async () => ({})) }));
vi.mock("@/lib/kol/canonical", () => ({ buildKolCanonicalSnapshot: vi.fn(async () => ({})) }));
vi.mock("@/lib/kol/identity", () => ({ resolveWalletToKol: vi.fn(async () => ({ confidence: "none" })) }));
vi.mock("@/lib/ops/alerting", () => ({
  alertDeadLetter: vi.fn(), alertEventBacklog: vi.fn(), alertIdentityBacklog: vi.fn(),
}));
vi.mock("@/lib/intelligence/crossCaseLinker", () => ({
  findCrossLinks: vi.fn(async () => []), persistCrossLinks: vi.fn(async () => {}),
}));
vi.mock("@/lib/intelligence/contradictionDetector", () => ({
  detectAndPersistContradictions: vi.fn(async () => {}),
}));
vi.mock("@/lib/events/producer", () => ({ emitKolUpdated: vi.fn() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evt(type: string): any {
  return {
    id: "e1", type, payload: {}, status: "pending", createdAt: new Date(),
    processedAt: null, error: null, retryCount: 0, nextRetryAt: null,
    deadLetteredAt: null, correlationId: null, causationId: null, idempotencyKey: null,
  };
}

beforeEach(() => update.mockClear());

describe("identity.review_required — la file de revue ne doit pas se vider seule", () => {
  it("processEvent n'acquitte JAMAIS un événement en attente d'arbitrage humain", async () => {
    const { processEvent } = await import("@/lib/events/processor");
    await processEvent(evt("identity.review_required"));
    expect(update).not.toHaveBeenCalled();
  });

  it("les autres types restent acquittés normalement", async () => {
    const { processEvent } = await import("@/lib/events/processor");
    await processEvent(evt("proceeds.recomputed"));
    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0] as { data: { status: string } };
    expect(arg.data.status).toBe("processed");
  });

  it("le cron exclut ces types de son batch — sinon 160 lignes affameraient un batch de 50", () => {
    const src = fs.readFileSync("src/app/api/cron/process-events/route.ts", "utf8");
    expect(src).toContain("HUMAN_REVIEW_TYPES");
    expect(src).toMatch(/type:\s*\{\s*notIn:/);
  });
});

// ── 2. ERROR_RETRYABLE ─────────────────────────────────────────────────────
// Le statut était posé par process-queue mais listQueuedRetail ne relisait que
// QUEUED : le nom promettait une reprise que rien n'implémentait.

describe("ERROR_RETRYABLE — le statut doit dire ce qui va réellement se passer", () => {
  const src = () => fs.readFileSync("src/lib/osint/retail/retailStore.ts", "utf8");

  it("listQueuedRetail reprend les ERROR_RETRYABLE non épuisés", () => {
    const s = src();
    const fn = s.slice(s.indexOf("export async function listQueuedRetail"));
    expect(fn).toContain("ERROR_RETRYABLE");
    expect(fn).toContain("processingAttempts");
  });

  it("la reprise est bornée — sans plafond une image toxique brûlerait le budget vision en boucle", () => {
    expect(src()).toContain("MAX_PROCESSING_ATTEMPTS = 3");
  });

  it("le compteur s'incrémente à la PRISE DU VERROU, pas à l'erreur", () => {
    const s = src();
    const fn = s.slice(s.indexOf("export async function markProcessing"), s.indexOf("export async function markError"));
    expect(fn).toMatch(/"processingAttempts"\s*=\s*COALESCE\("processingAttempts",\s*0\)\s*\+\s*1/);
  });

  it("markError bascule en ERROR_FINAL quand les tentatives sont épuisées", () => {
    const s = src();
    const fn = s.slice(s.indexOf("export async function markError"));
    expect(fn).toContain("ERROR_FINAL");
    expect(fn).toContain("MAX_PROCESSING_ATTEMPTS");
  });

  it("le préflight refuse de traiter si la colonne de comptage manque", () => {
    expect(src()).toContain("processingAttempts missing");
  });
});

// ── 3. process-queue sans déclencheur ──────────────────────────────────────

describe("file retail — un déclencheur automatique existe", () => {
  it("la route cron existe et partage l'implémentation de la route admin", () => {
    const cron = fs.readFileSync("src/app/api/cron/retail-process-queue/route.ts", "utf8");
    const admin = fs.readFileSync("src/app/api/admin/osint/retail/process-queue/route.ts", "utf8");
    expect(cron).toContain("runProcessQueueBatch");
    expect(admin).toContain("runProcessQueueBatch");
  });

  it("elle est planifiée dans vercel.json", () => {
    const v = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
    const entry = v.crons.find((c: { path: string }) => c.path === "/api/cron/retail-process-queue");
    expect(entry).toBeDefined();
    // Plan Hobby : jamais de cadence infra-quotidienne, le deploy échouerait.
    expect(entry.schedule.split(" ")[1]).not.toBe("*");
  });

  it("elle reste derrière le kill switch — câbler n'est pas armer", () => {
    const cron = fs.readFileSync("src/app/api/cron/retail-process-queue/route.ts", "utf8");
    expect(cron).toContain("verifyCronSecret");
    // Le kill switch retail est porté par runProcessQueueBatch, que le cron
    // n'a aucun moyen de contourner : il ne lit pas la variable lui-même.
    expect(cron).not.toContain("OSINT_RETAIL_PROCESSING_ENABLED =");
  });
});

// ── 4. UI qui annonce un cron inexistant ───────────────────────────────────

describe("page admin sécurité — ne plus annoncer une automatisation supprimée", () => {
  it("n'affirme plus que security-weekly-digest tourne chaque lundi", () => {
    const src = fs.readFileSync("src/app/admin/security/page.tsx", "utf8");
    const code = src.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    expect(code).not.toMatch(/security-weekly-digest<\/code> runs every/);
    expect(code).toContain("deprecated");
  });
});

afterEach(() => vi.clearAllMocks());
