// @pr2:bootstrap-sources
import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedDefaultSources, DEFAULT_SOURCES, SeedSourceDef } from "../seedSources";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockUpsert   = vi.fn();
const mockFindUniq = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sourceRegistry: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUniq(...args),
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFreshSource(name: string) {
  const now = new Date();
  return { name, createdAt: now, updatedAt: now };
}

function makeExistingSource(name: string) {
  const createdAt = new Date(Date.now() - 60_000); // créé il y a 1 min
  const updatedAt = new Date();
  return { name, createdAt, updatedAt };
}

const ONE_SOURCE: SeedSourceDef[] = [DEFAULT_SOURCES[0]];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("seedDefaultSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Idempotence ─────────────────────────────────────────────────────────────

  it("crée la source si absente (created)", async () => {
    mockUpsert.mockResolvedValue(makeFreshSource(ONE_SOURCE[0].name));

    const report = await seedDefaultSources(ONE_SOURCE);

    expect(report.created).toBe(1);
    expect(report.skipped).toBe(0);
    expect(report.failed).toBe(0);
    expect(report.details[0].status).toBe("created");
  });

  it("skipped si la source existe déjà (upsert update:{})", async () => {
    mockUpsert.mockResolvedValue(makeExistingSource(ONE_SOURCE[0].name));

    const report = await seedDefaultSources(ONE_SOURCE);

    expect(report.skipped).toBe(1);
    expect(report.created).toBe(0);
    expect(report.details[0].status).toBe("skipped");
  });

  it("idempotent : 2 appels successifs → created puis skipped", async () => {
    // Premier appel : source fraîche
    mockUpsert.mockResolvedValueOnce(makeFreshSource(ONE_SOURCE[0].name));
    const r1 = await seedDefaultSources(ONE_SOURCE);
    expect(r1.created).toBe(1);

    // Deuxième appel : source existante
    mockUpsert.mockResolvedValueOnce(makeExistingSource(ONE_SOURCE[0].name));
    const r2 = await seedDefaultSources(ONE_SOURCE);
    expect(r2.skipped).toBe(1);
    expect(r2.created).toBe(0);
  });

  // ── Gestion d'erreur isolée ─────────────────────────────────────────────────

  it("isole les erreurs : une source failed n'affecte pas les autres", async () => {
    const two: SeedSourceDef[] = [DEFAULT_SOURCES[0], DEFAULT_SOURCES[1]];
    mockUpsert
      .mockRejectedValueOnce(new Error("DB constraint"))
      .mockResolvedValueOnce(makeFreshSource(two[1].name));

    const report = await seedDefaultSources(two);

    expect(report.failed).toBe(1);
    expect(report.created).toBe(1);
    expect(report.details[0].status).toBe("failed");
    expect(report.details[0].error).toContain("DB constraint");
    expect(report.details[1].status).toBe("created");
  });

  it("rapport total correct avec toutes les DEFAULT_SOURCES", async () => {
    mockUpsert.mockResolvedValue(makeFreshSource("any"));

    const report = await seedDefaultSources();

    expect(report.total).toBe(DEFAULT_SOURCES.length);
    expect(report.created + report.skipped + report.failed).toBe(DEFAULT_SOURCES.length);
  });

  // ── Dry run ─────────────────────────────────────────────────────────────────

  it("dry-run : ne pas appeler upsert, simuler created si absent", async () => {
    mockFindUniq.mockResolvedValue(null); // source absente

    const report = await seedDefaultSources(ONE_SOURCE, true);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(report.created).toBe(1);
    expect(report.details[0].status).toBe("created");
  });

  it("dry-run : simuler skipped si source présente", async () => {
    mockFindUniq.mockResolvedValue({ name: ONE_SOURCE[0].name }); // existe

    const report = await seedDefaultSources(ONE_SOURCE, true);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(report.skipped).toBe(1);
    expect(report.details[0].status).toBe("skipped");
  });

  // ── Sécurité ────────────────────────────────────────────────────────────────

  it("DEFAULT_SOURCES : tous les handles sont uniques", () => {
    const handles = DEFAULT_SOURCES.map(s => s.handle);
    const unique  = new Set(handles);
    expect(unique.size).toBe(handles.length);
  });

  it("DEFAULT_SOURCES : tous les names sont uniques", () => {
    const names  = DEFAULT_SOURCES.map(s => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("DEFAULT_SOURCES : aucune source sans name ou handle", () => {
    for (const src of DEFAULT_SOURCES) {
      expect(src.name.length).toBeGreaterThan(0);
      expect(src.handle.length).toBeGreaterThan(0);
    }
  });
});
