// ─── BUILD 10 — LES TROIS GATES AU POINT DE CONSOMMATION ──────────────────
//
// `loadBotifyDbEnrichment` lit la base. Chaque gate retirée doit faire échouer
// au moins un test de ce fichier.

import { describe, it, expect, vi, beforeEach } from "vitest";

const kolCase = { findMany: vi.fn() };
const kolWallet = { findMany: vi.fn() };
const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolCase,
    kolWallet,
    get $queryRaw() {
      return queryRaw;
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

const { loadBotifyDbEnrichment, AMOUNT_WITHHELD, AMOUNT_NOT_MEASURED } = await import(
  "@/scripts/export/botifySpreadsheet"
);

beforeEach(() => {
  kolCase.findMany.mockReset();
  kolWallet.findMany.mockReset();
  queryRaw.mockReset();
  kolCase.findMany.mockResolvedValue([]);
  kolWallet.findMany.mockResolvedValue([]);
  queryRaw.mockResolvedValue([]);
});

describe("AXE 1 — rattachement au dossier, FAIL CLOSED", () => {
  it("aucun handle rattaché → enrichissement OMIS entièrement", async () => {
    kolCase.findMany.mockResolvedValue([]);
    const out = await loadBotifyDbEnrichment("CASE-2024-BOTIFY-001");
    expect(out).toEqual({ wallets: [], proceeds: [] });
  });

  it("aucun handle → la base n'est même pas interrogée pour les wallets", async () => {
    kolCase.findMany.mockResolvedValue([]);
    await loadBotifyDbEnrichment("CASE-2024-BOTIFY-001");
    expect(kolWallet.findMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("le proxy botifyDeal n'est PLUS consulté — KolCase est la seule autorité", async () => {
    kolCase.findMany.mockResolvedValue([{ kolHandle: "bkokoski" }]);
    await loadBotifyDbEnrichment("CASE-2024-BOTIFY-001");
    // Une seule lecture de rattachement, et c'est KolCase.
    expect(kolCase.findMany).toHaveBeenCalledTimes(1);
    const arg = kolCase.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ caseId: "CASE-2024-BOTIFY-001" });
  });
});

describe("AXE 2 — les wallets passent par PUBLISHABLE_WALLET_FILTER", () => {
  beforeEach(() => kolCase.findMany.mockResolvedValue([{ kolHandle: "bkokoski" }]));

  it("le filtre de publiabilité est dans le WHERE", async () => {
    await loadBotifyDbEnrichment("X");
    const where = kolWallet.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("active");
    expect(where.isPubliclyUsable).toBe(true);
  });

  it("isPubliclyUsable et status sont SÉLECTIONNÉS — sinon le prédicat est aveugle", async () => {
    await loadBotifyDbEnrichment("X");
    const select = kolWallet.findMany.mock.calls[0][0].select;
    expect(select.isPubliclyUsable).toBe(true);
    expect(select.status).toBe(true);
  });

  it("un wallet non publiable qui passerait le WHERE est refiltré en mémoire", async () => {
    kolWallet.findMany.mockResolvedValue([
      { kolHandle: "bkokoski", address: "AAA", label: "ok", isPubliclyUsable: true, status: "active" },
      { kolHandle: "bkokoski", address: "BBB", label: "fuite", isPubliclyUsable: false, status: "active" },
      { kolHandle: "bkokoski", address: "CCC", label: "inactif", isPubliclyUsable: true, status: "retired" },
    ]);
    const out = await loadBotifyDbEnrichment("X");
    expect(out.wallets.map((w) => w.address)).toEqual(["AAA"]);
  });
});

describe("AXE 3 — vraie jointure, puis gate monétaire", () => {
  beforeEach(() => kolCase.findMany.mockResolvedValue([{ kolHandle: "OrbitApe" }]));

  it("un montant sur profil WITHDRAWN n'est PAS publié — le motif, pas le chiffre", async () => {
    queryRaw.mockResolvedValue([
      { id: "e1", kolHandle: "OrbitApe", amountUsd: 817000, txHash: "T1", proceedsPublication: "withdrawn" },
    ]);
    const out = await loadBotifyDbEnrichment("X");
    expect(out.proceeds[0].amountUsd).toBe(AMOUNT_WITHHELD);
    expect(out.proceeds[0].amountUsd).not.toContain("817000");
  });

  it("un montant sur profil PUBLISHED sort tel quel — la gate ne sur-corrige pas", async () => {
    queryRaw.mockResolvedValue([
      { id: "e2", kolHandle: "OrbitApe", amountUsd: 2932, txHash: "T2", proceedsPublication: "published" },
    ]);
    const out = await loadBotifyDbEnrichment("X");
    expect(out.proceeds[0].amountUsd).toBe("2932");
  });

  it("un montant absent rend NOT_MEASURED, jamais 0 ni vide", async () => {
    queryRaw.mockResolvedValue([
      { id: "e3", kolHandle: "OrbitApe", amountUsd: null, txHash: "T3", proceedsPublication: "published" },
    ]);
    const out = await loadBotifyDbEnrichment("X");
    expect(out.proceeds[0].amountUsd).toBe(AMOUNT_NOT_MEASURED);
    expect(out.proceeds[0].amountUsd).not.toBe("0");
    expect(out.proceeds[0].amountUsd).not.toBe("");
  });

  it("la requête est une JOINTURE sur KolProfile, sans LIMIT, ordonnée", async () => {
    await loadBotifyDbEnrichment("X");
    const sql = queryRaw.mock.calls[0][0].join("?");
    expect(sql).toContain('JOIN "KolProfile"');
    expect(sql).toContain('p."proceedsPublication"');
    expect(sql).toContain("ORDER BY");
    expect(sql).not.toMatch(/LIMIT\s+\d+/i);
  });

  it("le filtre par sous-chaîne sérialisée a disparu — restriction par mint canonique", async () => {
    await loadBotifyDbEnrichment("X");
    const sql = queryRaw.mock.calls[0][0].join("?");
    expect(sql).toContain('e."tokenAddress"');
    expect(sql).not.toContain("stringify");
  });
});
