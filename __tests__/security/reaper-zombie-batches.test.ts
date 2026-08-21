// __tests__/security/reaper-zombie-batches.test.ts
//
// LE REAPER DOIT MORDRE — ET NE MORDRE QUE CE QUI EST MORT.
//
// Le défaut couvert n'est pas « des lignes traînent en base ». C'est qu'un
// batch tué par le timeout serverless reste `running` POUR TOUJOURS, et qu'un
// `running` éternel est indiscernable d'un import en cours. Le tableau de bord
// affiche « ingestion en cours » sur un processus mort depuis 140 jours.
//
// Ce fichier vérifie quatre propriétés, dont deux sont des refus :
//
//   C2  un batch `running` AU-DELÀ du TTL est fermé, au bon statut.
//   C3  un batch `running` DANS le TTL est laissé STRICTEMENT tranquille.
//   C2b writes vs pas-de-preuve-de-writes donnent des statuts DISTINCTS.
//   C2c le reaper n'écrit RIEN par défaut (dry-run est le défaut).
//
// Un test qui ne vérifierait que C2 serait satisfait par un reaper qui ferme
// TOUT, y compris les runs vivants. C3 est la moitié qui compte.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Faux Prisma en mémoire ───────────────────────────────────────────────────
// Assez fidèle pour que les sondes du reaper aient un sens : on stocke de
// vraies lignes, avec de vraies dates, et on filtre comme Postgres le ferait.

interface Batch {
  id: string;
  sourceSlug: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  recordsFetched: number | null;
  errorMessage: string | null;
}
interface Entity { createdAt: Date }
interface Obs { sourceSlug: string; ingestedAt: Date }

const store: { batches: Batch[]; entities: Entity[]; observations: Obs[] } = {
  batches: [],
  entities: [],
  observations: [],
};

function inRange(v: Date, r: { gte?: Date; lt?: Date; gt?: Date }): boolean {
  if (r.gte && v < r.gte) return false;
  if (r.gt && v <= r.gt) return false;
  if (r.lt && v >= r.lt) return false;
  return true;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intelIngestionBatch: {
      findMany: vi.fn(async ({ where }: any) => {
        return store.batches
          .filter((b) => b.status === where.status)
          .filter((b) => (where.startedAt ? inRange(b.startedAt, where.startedAt) : true))
          .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const hits = store.batches
          .filter((b) => b.sourceSlug === where.sourceSlug)
          .filter((b) => inRange(b.startedAt, where.startedAt))
          .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
        return hits[0] ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.batches.find((b) => b.id === where.id);
        if (!row) throw new Error(`no batch ${where.id}`);
        Object.assign(row, data);
        return row;
      }),
    },
    canonicalEntity: {
      count: vi.fn(async ({ where }: any) =>
        store.entities.filter((e) => inRange(e.createdAt, where.createdAt)).length
      ),
    },
    sourceObservation: {
      count: vi.fn(async ({ where }: any) =>
        store.observations
          .filter((o) => o.sourceSlug === where.sourceSlug)
          .filter((o) => inRange(o.ingestedAt, where.ingestedAt)).length
      ),
    },
  },
}));

import {
  reapZombieBatches,
  recordsRemovedWasComputable,
  REAPER_TTL_SECONDS,
} from "@/lib/intelligence/reaper";

const NOW = new Date("2026-08-21T12:00:00.000Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

function batch(over: Partial<Batch> & { id: string; startedAt: Date }): Batch {
  return {
    sourceSlug: "scamsniffer",
    completedAt: null,
    status: "running",
    recordsFetched: null,
    errorMessage: null,
    ...over,
  };
}

beforeEach(() => {
  store.batches = [];
  store.entities = [];
  store.observations = [];
});

describe("C2 — le reaper mord", () => {
  it("ferme un batch `running` au-delà du TTL", async () => {
    store.batches.push(batch({ id: "zombie", startedAt: ago(REAPER_TTL_SECONDS + 60) }));

    const report = await reapZombieBatches({ dryRun: false, now: NOW });

    expect(report.reaped).toBe(1);
    const row = store.batches.find((b) => b.id === "zombie")!;
    expect(row.status).not.toBe("running");
    expect(row.completedAt).not.toBeNull();
  });

  it("ne prétend JAMAIS que le run a réussi", async () => {
    store.batches.push(batch({ id: "zombie", startedAt: ago(REAPER_TTL_SECONDS + 60) }));
    store.observations.push({ sourceSlug: "scamsniffer", ingestedAt: ago(REAPER_TTL_SECONDS + 50) });

    await reapZombieBatches({ dryRun: false, now: NOW });

    const row = store.batches.find((b) => b.id === "zombie")!;
    expect(row.status).not.toBe("success");
    expect(row.status).not.toBe("running");
    expect(row.errorMessage).toMatch(/Reaper/);
  });

  it("ancre completedAt à la mort réelle, pas à l'heure du reaper", async () => {
    const started = ago(REAPER_TTL_SECONDS + 3600);
    store.batches.push(batch({ id: "zombie", startedAt: started }));

    await reapZombieBatches({ dryRun: false, now: NOW });

    const row = store.batches.find((b) => b.id === "zombie")!;
    // Le run est mort au plafond serverless (300 s), il y a longtemps —
    // surtout pas « maintenant ».
    expect(row.completedAt!.getTime()).toBe(started.getTime() + 300_000);
    expect(row.completedAt!.getTime()).toBeLessThan(NOW.getTime());
  });
});

describe("C3 — le reaper épargne les vivants", () => {
  it("laisse STRICTEMENT tranquille un batch `running` dans le TTL", async () => {
    const started = ago(REAPER_TTL_SECONDS - 60);
    store.batches.push(batch({ id: "vivant", startedAt: started }));

    const report = await reapZombieBatches({ dryRun: false, now: NOW });

    expect(report.scanned).toBe(0);
    expect(report.reaped).toBe(0);
    const row = store.batches.find((b) => b.id === "vivant")!;
    expect(row.status).toBe("running");
    expect(row.completedAt).toBeNull();
    expect(row.errorMessage).toBeNull();
  });

  it("ne touche pas aux batches déjà terminés", async () => {
    store.batches.push(
      batch({ id: "fini", startedAt: ago(999_999), status: "success", completedAt: ago(999_000) })
    );

    const report = await reapZombieBatches({ dryRun: false, now: NOW });

    expect(report.scanned).toBe(0);
    expect(store.batches.find((b) => b.id === "fini")!.status).toBe("success");
  });

  it("un run vivant ET un zombie : seul le zombie tombe", async () => {
    store.batches.push(batch({ id: "vivant", startedAt: ago(120) }));
    store.batches.push(batch({ id: "zombie", startedAt: ago(REAPER_TTL_SECONDS + 1) }));

    await reapZombieBatches({ dryRun: false, now: NOW });

    expect(store.batches.find((b) => b.id === "vivant")!.status).toBe("running");
    expect(store.batches.find((b) => b.id === "zombie")!.status).toMatch(/^timed_out_/);
  });
});

describe("C2b — writes et no-writes reçoivent des statuts DISTINCTS", () => {
  it("écritures prouvées par observations => timed_out_with_writes", async () => {
    const started = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(batch({ id: "avec", startedAt: started }));
    store.observations.push({ sourceSlug: "scamsniffer", ingestedAt: new Date(started.getTime() + 10_000) });

    await reapZombieBatches({ dryRun: false, now: NOW });

    expect(store.batches.find((b) => b.id === "avec")!.status).toBe("timed_out_with_writes");
  });

  it("aucune trace durable => timed_out_unknown_writes", async () => {
    store.batches.push(batch({ id: "sans", startedAt: ago(REAPER_TTL_SECONDS + 600) }));

    await reapZombieBatches({ dryRun: false, now: NOW });

    const row = store.batches.find((b) => b.id === "sans")!;
    expect(row.status).toBe("timed_out_unknown_writes");
    // Le statut ne doit pas AFFIRMER l'absence d'écriture.
    expect(row.status).not.toContain("no_writes");
    expect(row.errorMessage).toMatch(/absence de preuve, PAS preuve d'absence/i);
  });

  it("les deux statuts diffèrent réellement", async () => {
    const s1 = ago(REAPER_TTL_SECONDS + 600);
    const s2 = ago(REAPER_TTL_SECONDS + 500);
    store.batches.push(batch({ id: "avec", startedAt: s1 }));
    store.batches.push(batch({ id: "sans", startedAt: s2, sourceSlug: "ofac" }));
    store.observations.push({ sourceSlug: "scamsniffer", ingestedAt: new Date(s1.getTime() + 5_000) });

    await reapZombieBatches({ dryRun: false, now: NOW });

    const a = store.batches.find((b) => b.id === "avec")!.status;
    const b = store.batches.find((b) => b.id === "sans")!.status;
    expect(a).not.toBe(b);
  });

  it("recordsFetched=NULL sur petite source n'est PAS lu comme « rien écrit »", async () => {
    // Le piège mesuré : les zombies ofac d'avril (864 lignes) n'atteignent
    // jamais le jalon de progression (5000) — recordsFetched reste NULL — et
    // ont pourtant écrit des centaines d'observations.
    const started = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(batch({ id: "ofac", startedAt: started, sourceSlug: "ofac", recordsFetched: null }));
    for (let i = 0; i < 225; i++) {
      store.observations.push({ sourceSlug: "ofac", ingestedAt: new Date(started.getTime() + i * 100) });
    }

    const report = await reapZombieBatches({ dryRun: false, now: NOW });

    expect(store.batches.find((b) => b.id === "ofac")!.status).toBe("timed_out_with_writes");
    expect(report.verdicts[0].observationsCreated).toBe(225);
  });

  it("n'attribue pas au zombie les écritures du run SUIVANT", async () => {
    // Sans borne sur la fenêtre, un zombie s'attribue les écritures du run
    // d'après. Le cas n'est pas théorique : les 2 batches ofac zombies
    // d'avril 2026 ne sont séparés que de 136 s — bien à l'intérieur de la
    // fenêtre dure (maxDuration + marge = 420 s). Seule la borne « démarrage
    // du batch suivant » les sépare.
    const started = ago(50_000);
    store.batches.push(batch({ id: "zombie", startedAt: started, sourceSlug: "ofac" }));
    const suivant = new Date(started.getTime() + 136_000); // 136 s plus tard
    store.batches.push(
      batch({ id: "suivant", startedAt: suivant, sourceSlug: "ofac", status: "running" })
    );
    // Écriture postérieure au démarrage du SUIVANT, mais dans les 420 s du
    // zombie : elle appartient au suivant, pas au zombie.
    store.observations.push({
      sourceSlug: "ofac",
      ingestedAt: new Date(suivant.getTime() + 20_000),
    });

    const report = await reapZombieBatches({ now: NOW });

    const zombie = report.verdicts.find((v) => v.batchId === "zombie")!;
    expect(zombie.observationsCreated).toBe(0);
    expect(zombie.status).toBe("timed_out_unknown_writes");
    // et le suivant, lui, la revendique
    const suiv = report.verdicts.find((v) => v.batchId === "suivant")!;
    expect(suiv.observationsCreated).toBe(1);
    expect(suiv.status).toBe("timed_out_with_writes");
  });
});

describe("C2c — le reaper n'écrit rien sans qu'on le lui demande", () => {
  it("dry-run est le DÉFAUT", async () => {
    store.batches.push(batch({ id: "zombie", startedAt: ago(REAPER_TTL_SECONDS + 600) }));

    const report = await reapZombieBatches({ now: NOW });

    expect(report.dryRun).toBe(true);
    expect(report.scanned).toBe(1);
    expect(report.reaped).toBe(0);
    expect(store.batches.find((b) => b.id === "zombie")!.status).toBe("running");
  });

  it("le dry-run rend malgré tout le verdict complet", async () => {
    const started = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(batch({ id: "zombie", startedAt: started, recordsFetched: 260000 }));

    const report = await reapZombieBatches({ now: NOW });

    expect(report.verdicts[0].status).toBe("timed_out_with_writes");
    expect(report.verdicts[0].evidence).toContain("recordsFetched=260000");
  });
});

describe("recordsRemoved — perdu, ou jamais calculé", () => {
  it("scamsniffer : JAMAIS calculé (marquage stale sauté >=10000)", () => {
    expect(recordsRemovedWasComputable("scamsniffer", 260000)).toBe(false);
  });

  it("ofac : calculable, donc réellement perdu par le timeout", () => {
    expect(recordsRemovedWasComputable("ofac", null)).toBe(true);
  });
});
