/**
 * __tests__/api/cronWatcherBridge.test.ts
 *
 * Comportement de la porte du cron watcher-bridge. runBridgeJob est mocké :
 * on ne teste ici que le gate et le passage des plafonds, pas le métier.
 *
 * Ce qui compte : la route ne doit JAMAIS lancer le job sans secret valide, et
 * elle doit transmettre un plafond par KOL. Sans ce plafond, le rattrapage du
 * 2026-08-14 a montré 42 drafts sur 44 concentrés sur un seul handle — la file
 * de revue devient inexploitable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface BridgeOpts {
  limit?: number;
  maxPerKol?: number;
}

const runBridgeJob = vi.fn(async (_db: unknown, _opts?: BridgeOpts) => ({
  jobRunLogId: "run-1",
  status: "disabled" as const,
  dryRun: false,
  summary: null,
  reason: "WATCHER_BRIDGE_ENABLED is not true — job disabled (no-op)",
}));

vi.mock("@/lib/watcher-bridge/runBridgeJob", () => ({ runBridgeJob }));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $disconnect = vi.fn(async () => {});
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(authorization?: string): any {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? authorization ?? null : null) },
  };
}

const ENV = process.env;
beforeEach(() => {
  vi.resetModules();
  runBridgeJob.mockClear();
  process.env = { ...ENV };
});
afterEach(() => {
  process.env = ENV;
});

describe("GET /api/cron/watcher-bridge — porte", () => {
  it("401 et job jamais lancé quand CRON_SECRET est absente", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/watcher-bridge/route");
    const res = await GET(req("Bearer whatever"));
    expect(res.status).toBe(401);
    expect(runBridgeJob).not.toHaveBeenCalled();
  });

  it("401 quand CRON_SECRET est vide — 'Bearer ' ne doit pas devenir un secret valide", async () => {
    process.env.CRON_SECRET = "";
    const { GET } = await import("@/app/api/cron/watcher-bridge/route");
    const res = await GET(req("Bearer "));
    expect(res.status).toBe(401);
    expect(runBridgeJob).not.toHaveBeenCalled();
  });

  it("401 sur mauvais secret", async () => {
    process.env.CRON_SECRET = "bon-secret";
    const { GET } = await import("@/app/api/cron/watcher-bridge/route");
    const res = await GET(req("Bearer mauvais-secret"));
    expect(res.status).toBe(401);
    expect(runBridgeJob).not.toHaveBeenCalled();
  });

  it("200 avec le bon secret, et transmet limit + maxPerKol", async () => {
    process.env.CRON_SECRET = "bon-secret";
    delete process.env.WATCHER_BRIDGE_LIMIT;
    delete process.env.WATCHER_BRIDGE_MAX_PER_KOL;
    const { GET } = await import("@/app/api/cron/watcher-bridge/route");
    const res = await GET(req("Bearer bon-secret"));
    expect(res.status).toBe(200);
    expect(runBridgeJob).toHaveBeenCalledTimes(1);
    const opts = runBridgeJob.mock.calls[0][1];
    expect(opts?.limit).toBe(150);
    expect(opts?.maxPerKol).toBe(10);
  });

  it("remonte le kill switch tel quel — câblé n'est pas armé", async () => {
    process.env.CRON_SECRET = "bon-secret";
    const { GET } = await import("@/app/api/cron/watcher-bridge/route");
    const res = await GET(req("Bearer bon-secret"));
    const body = await res.json();
    expect(body.status).toBe("disabled");
    expect(body.summary).toBeNull();
  });
});
