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

const store: {
  batches: Batch[];
  entities: Entity[];
  observations: Obs[];
  auditLog: AuditEntry[];
} = { batches: [], entities: [], observations: [], auditLog: [] };

type Range = { gte?: Date; lt?: Date; gt?: Date };
type WhereBatch = { status?: string; startedAt?: Range; sourceSlug?: string; id?: string };
type AuditEntry = {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
};

function inRange(v: Date, r: Range): boolean {
  if (r.gte && v < r.gte) return false;
  if (r.gt && v <= r.gt) return false;
  if (r.lt && v >= r.lt) return false;
  return true;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intelIngestionBatch: {
      findMany: vi.fn(async ({ where }: { where: WhereBatch }) => {
        return store.batches
          .filter((b) => b.status === where.status)
          .filter((b) => (where.startedAt ? inRange(b.startedAt, where.startedAt) : true))
          .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      }),
      findFirst: vi.fn(
        async ({ where }: { where: WhereBatch & { startedAt: Range } }) => {
        const hits = store.batches
          .filter((b) => b.sourceSlug === where.sourceSlug)
          .filter((b) => inRange(b.startedAt, where.startedAt))
          .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
        return hits[0] ?? null;
        }
      ),
      updateMany: vi.fn(
        async ({ where, data }: { where: WhereBatch; data: Partial<Batch> }) => {
        // fidèle au vrai updateMany : n'affecte que les lignes qui matchent
        // TOUS les critères — c'est le garde d'idempotence.
        const rows = store.batches.filter(
          (b) => b.id === where.id && b.status === where.status
        );
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    },
    intelAuditLog: {
      create: vi.fn(async ({ data }: { data: AuditEntry }) => {
        store.auditLog.push(data);
        return data;
      }),
    },
    canonicalEntity: {
      count: vi.fn(async ({ where }: { where: { createdAt: Range } }) =>
        store.entities.filter((e) => inRange(e.createdAt, where.createdAt)).length
      ),
    },
    sourceObservation: {
      count: vi.fn(
        async ({ where }: { where: { sourceSlug: string; ingestedAt: Range } }) =>
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
  EMITTED_STATUSES,
  RESERVED_STATUS_NO_WRITES_VERIFIED,
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
  store.auditLog = [];
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
    expect(store.batches.find((b) => b.id === "zombie")!.status).toMatch(/^TIMED_OUT_/);
  });
});

describe("C2b — writes et no-writes reçoivent des statuts DISTINCTS", () => {
  it("écritures prouvées par observations => timed_out_with_writes", async () => {
    const started = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(batch({ id: "avec", startedAt: started }));
    store.observations.push({ sourceSlug: "scamsniffer", ingestedAt: new Date(started.getTime() + 10_000) });

    await reapZombieBatches({ dryRun: false, now: NOW });

    expect(store.batches.find((b) => b.id === "avec")!.status).toBe("TIMED_OUT_WITH_WRITES");
  });

  it("aucune trace durable => timed_out_unknown_writes", async () => {
    store.batches.push(batch({ id: "sans", startedAt: ago(REAPER_TTL_SECONDS + 600) }));

    await reapZombieBatches({ dryRun: false, now: NOW });

    const row = store.batches.find((b) => b.id === "sans")!;
    expect(row.status).toBe("TIMED_OUT_UNKNOWN_WRITES");
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

    expect(store.batches.find((b) => b.id === "ofac")!.status).toBe("TIMED_OUT_WITH_WRITES");
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
    expect(zombie.status).toBe("TIMED_OUT_UNKNOWN_WRITES");
    // et le suivant, lui, la revendique
    const suiv = report.verdicts.find((v) => v.batchId === "suivant")!;
    expect(suiv.observationsCreated).toBe(1);
    expect(suiv.status).toBe("TIMED_OUT_WITH_WRITES");
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

    expect(report.verdicts[0].status).toBe("TIMED_OUT_WITH_WRITES");
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

describe("C5 — idempotence : rejouer ne double rien", () => {
  it("deux passes consécutives ne ferment qu'une fois et ne journalisent qu'une fois", async () => {
    store.batches.push(batch({ id: "zombie", startedAt: ago(REAPER_TTL_SECONDS + 600) }));

    const first = await reapZombieBatches({ dryRun: false, now: NOW });
    const second = await reapZombieBatches({ dryRun: false, now: NOW });

    expect(first.reaped).toBe(1);
    // au 2e passage le batch n'est plus 'running' : il n'est même plus scanné
    expect(second.scanned).toBe(0);
    expect(second.reaped).toBe(0);
    expect(store.auditLog).toHaveLength(1);
  });

  it("un batch fermé ENTRE le scan et l'écriture n'est ni réécrit ni journalisé", async () => {
    // La course réelle : le fondateur ferme les zombies à la main dans Neon
    // pendant que le cron tourne. Le garde `status: 'running'` de l'updateMany
    // doit absorber ça sans rien écraser.
    const started = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(batch({ id: "zombie", startedAt: started }));

    const { prisma } = await import("@/lib/prisma");
    const vraiUpdateMany = prisma.intelIngestionBatch.updateMany;
    let premierAppel = true;
    prisma.intelIngestionBatch.updateMany = vi.fn(async (args: never) => {
      if (premierAppel) {
        premierAppel = false;
        // simule la fermeture manuelle concurrente, juste avant notre écriture
        const row = store.batches.find((b) => b.id === "zombie")!;
        row.status = "closed_by_hand";
        row.errorMessage = "fermé à la main dans Neon";
      }
      return vraiUpdateMany(args);
    });

    const report = await reapZombieBatches({ dryRun: false, now: NOW });

    expect(report.scanned).toBe(1);
    expect(report.reaped).toBe(0);
    expect(report.alreadyClosed).toEqual(["zombie"]);
    // la fermeture manuelle n'est PAS écrasée
    const row = store.batches.find((b) => b.id === "zombie")!;
    expect(row.status).toBe("closed_by_hand");
    expect(row.errorMessage).toBe("fermé à la main dans Neon");
    // et rien n'est journalisé pour une fermeture qu'on n'a pas faite
    expect(store.auditLog).toHaveLength(0);

    prisma.intelIngestionBatch.updateMany = vraiUpdateMany;
  });
});

describe("C6 — journal : raison · durée · type de source · état d'écriture", () => {
  it("consigne les quatre dimensions exigées", async () => {
    const started = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(
      batch({ id: "z", startedAt: started, sourceSlug: "ofac", recordsFetched: null })
    );
    store.observations.push({
      sourceSlug: "ofac",
      ingestedAt: new Date(started.getTime() + 5_000),
    });

    await reapZombieBatches({ dryRun: false, now: NOW });

    expect(store.auditLog).toHaveLength(1);
    const e = store.auditLog[0];
    expect(e.actor).toBe("cron:reaper");
    expect(e.action).toBe("ingest.batch.reaped");
    expect(e.targetType).toBe("IntelIngestionBatch");
    expect(e.targetId).toBe("z");

    // raison
    expect(e.detail.reason).toBe("serverless_timeout_no_finalize");
    // durée
    expect(e.detail.stuckSeconds).toBe(REAPER_TTL_SECONDS + 600);
    expect(e.detail.maxDurationSeconds).toBe(300);
    expect(e.detail.ttlSeconds).toBe(REAPER_TTL_SECONDS);
    // type de source — ofac = tier 1 = réglementaire
    expect(e.detail.sourceSlug).toBe("ofac");
    expect(e.detail.sourceTier).toBe(1);
    expect(e.detail.sourceType).toBe("regulatory");
    // état d'écriture
    expect(e.detail.writeState).toBe("TIMED_OUT_WITH_WRITES");
    expect(e.detail.writesProven).toBe(true);
    expect(e.detail.recordsRemoved).toBe("UNKNOWN_LOST_WITH_RUN");
  });

  it("distingue le type de source technique (scamsniffer = tier 2)", async () => {
    store.batches.push(batch({ id: "z", startedAt: ago(REAPER_TTL_SECONDS + 600) }));

    await reapZombieBatches({ dryRun: false, now: NOW });

    const e = store.auditLog[0];
    expect(e.detail.sourceTier).toBe(2);
    expect(e.detail.sourceType).toBe("technical");
    // scamsniffer : le marquage stale est sauté, rien n'a été « perdu »
    expect(e.detail.recordsRemoved).toBe("NOT_APPLICABLE_STALE_MARKING_SKIPPED");
    expect(e.detail.writeState).toBe("TIMED_OUT_UNKNOWN_WRITES");
    expect(e.detail.writesProven).toBe(false);
  });

  it("le dry-run ne journalise RIEN", async () => {
    store.batches.push(batch({ id: "z", startedAt: ago(REAPER_TTL_SECONDS + 600) }));

    await reapZombieBatches({ now: NOW });

    expect(store.auditLog).toHaveLength(0);
  });

  it("aucune suppression de ligne historique n'est possible", async () => {
    // Le reaper ne doit exposer AUCUN chemin de suppression. Le mock prisma
    // ne fournit ni delete ni deleteMany : si le code en appelait un, il
    // planterait. Ce test verrouille l'absence.
    store.batches.push(batch({ id: "z", startedAt: ago(REAPER_TTL_SECONDS + 600) }));
    store.batches.push(batch({ id: "vieux", startedAt: ago(999_999), status: "success" }));

    await reapZombieBatches({ dryRun: false, now: NOW });

    expect(store.batches).toHaveLength(2);
    expect(store.batches.find((b) => b.id === "vieux")!.status).toBe("success");
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/intelligence/reaper.ts", "utf8")
    );
    expect(src).not.toMatch(/\.delete\(|\.deleteMany\(/);
  });
});

describe("C4 — TIMED_OUT_NO_WRITES_VERIFIED est réservé, jamais émis", () => {
  it("n'est produit par aucun chemin, quelles que soient les preuves", async () => {
    // avec écritures, sans écritures, petite source, grosse source
    const t = ago(REAPER_TTL_SECONDS + 600);
    store.batches.push(batch({ id: "a", startedAt: t }));
    store.batches.push(batch({ id: "b", startedAt: ago(REAPER_TTL_SECONDS + 500), sourceSlug: "ofac" }));
    store.batches.push(
      batch({ id: "c", startedAt: ago(REAPER_TTL_SECONDS + 400), recordsFetched: 260000 })
    );
    store.observations.push({ sourceSlug: "scamsniffer", ingestedAt: new Date(t.getTime() + 1_000) });

    const report = await reapZombieBatches({ dryRun: false, now: NOW });

    for (const v of report.verdicts) {
      expect(v.status).not.toBe(RESERVED_STATUS_NO_WRITES_VERIFIED);
      expect(EMITTED_STATUSES).toContain(v.status as (typeof EMITTED_STATUSES)[number]);
    }
    for (const row of store.batches) {
      expect(row.status).not.toBe("TIMED_OUT_NO_WRITES_VERIFIED");
    }
  });

  it("le code source ne contient aucune AFFECTATION de ce statut", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/intelligence/reaper.ts", "utf8")
    );
    // il apparaît dans le type et la constante réservée, mais jamais
    // comme valeur choisie pour un verdict
    expect(src).not.toMatch(/status\s*[:=]\s*"TIMED_OUT_NO_WRITES_VERIFIED"/);
    expect(src).not.toMatch(/\?\s*"TIMED_OUT_NO_WRITES_VERIFIED"/);
    // Hors commentaires, il ne subsiste que ses deux emplacements légitimes :
    // le membre de l'union de types, et la valeur de la constante réservée.
    // Toute occurrence supplémentaire dans du code exécutable signalerait
    // une émission.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const occurrences = code.match(/TIMED_OUT_NO_WRITES_VERIFIED/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });
});
