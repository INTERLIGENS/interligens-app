// ─── BUILD 12 · P0 — LE CHEMIN PRÉ-ACHAT NE S'OUVRE PLUS PAR DÉFAUT ───────
//
// Ce fichier portait un test nommé « fail-open (GREEN) when computeVerdict
// throws ». Il ne bénissait pas un accident : il documentait le comportement
// voulu de l'époque. Il est RETOURNÉ, pas supprimé — la preuve doit garder le
// nouveau contrat.
//
// Le module consomme désormais `computeVerdictMeasured` : la dégradation qu'il
// produit existait déjà et n'avait aucun consommateur.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { preSwapScan } from "../preSwapScan";
import type { SwapVerdict } from "../types";

vi.mock("@/lib/publicScore/computeVerdict", () => ({
  computeVerdictMeasured: vi.fn(),
}));

import { computeVerdictMeasured } from "@/lib/publicScore/computeVerdict";
const mockMeasured = vi.mocked(computeVerdictMeasured);

const FROM = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const TO = "So11111111111111111111111111111111111111112";

const mesure = (v: SwapVerdict) => ({ verdict: v, degraded: [] });
const mesurePartielle = (v: SwapVerdict) => ({
  verdict: v,
  degraded: [{ field: "market", reason: "PROVIDER_UNAVAILABLE" as const }],
});

function setVerdicts(fromV: SwapVerdict, toV: SwapVerdict) {
  mockMeasured.mockResolvedValueOnce(mesure(fromV)).mockResolvedValueOnce(mesure(toV));
}

describe("preSwapScan — les cas mesurés, inchangés", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("les deux côtés GREEN et mesurés : aucun avertissement", async () => {
    setVerdicts("GREEN", "GREEN");
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(false);
    expect(r.fromVerdict).toBe("GREEN");
    expect(r.toVerdict).toBe("GREEN");
    expect(r.warning).toBeUndefined();
    expect(r.degraded).toBe(false);
    expect(r.coverage.expectedMeasured).toBe(2);
  });

  it("source RED → bloqué", async () => {
    setVerdicts("RED", "GREEN");
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("RED");
  });

  it("destination RED → bloqué", async () => {
    setVerdicts("GREEN", "RED");
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(true);
    expect(r.toVerdict).toBe("RED");
  });

  it("source ORANGE → avertit sans bloquer", async () => {
    setVerdicts("ORANGE", "GREEN");
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(false);
    expect(r.warning).toContain("ORANGE");
    expect(r.fromVerdict).toBe("ORANGE");
  });

  it("destination ORANGE → avertit sans bloquer", async () => {
    setVerdicts("GREEN", "ORANGE");
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(false);
    expect(r.warning).toContain("ORANGE");
  });
});

describe("BUILD 12 — une panne ne produit plus une autorisation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("RETOURNÉ — une panne ne rend PLUS GREEN/GREEN/non averti", async () => {
    // L'ancien contrat : `catch { return { GREEN, GREEN, blocked: false } }`.
    mockMeasured
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(mesure("GREEN"));
    const r = await preSwapScan(FROM, TO);
    expect(r.fromVerdict).toBeNull();
    expect(r.fromVerdict).not.toBe("GREEN");
    expect(r.degraded).toBe(true);
    expect(r.warning).toBeDefined();
    expect(r.coverage.sides.find((s) => s.side === "from")?.state).toBe("FAILURE");
    expect(r.coverage.sides.find((s) => s.side === "from")?.detail).toContain("Network error");
  });

  it("MUTANT — un RED mesuré SURVIT à l'échec de son voisin", async () => {
    // `Promise.all` ne rendait que la première rejection : le RED disparaissait
    // parce qu'un provider sans rapport avait échoué de l'autre côté.
    mockMeasured
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce(mesure("RED"));
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(true);
    expect(r.toVerdict).toBe("RED");
    expect(r.fromVerdict).toBeNull();
  });

  it("MUTANT — le RED survit aussi quand c'est le SECOND qui échoue", async () => {
    mockMeasured
      .mockResolvedValueOnce(mesure("RED"))
      .mockRejectedValueOnce(new Error("provider down"));
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(true);
    expect(r.fromVerdict).toBe("RED");
  });

  it("les deux côtés en panne : aucun verdict, jamais un résultat propre", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"));
    const r = await preSwapScan(FROM, TO);
    expect(r.fromVerdict).toBeNull();
    expect(r.toVerdict).toBeNull();
    expect(r.blocked).toBe(false);
    expect(r.warning).toBeDefined();
    expect(r.degraded).toBe(true);
    expect(r.coverage.expectedMeasured).toBe(0);
  });

  it("une mesure PARTIELLE n'est pas un résultat propre", async () => {
    // `computeVerdictMeasured` nomme ses entrées manquantes ; elles voyagent.
    mockMeasured
      .mockResolvedValueOnce(mesurePartielle("GREEN"))
      .mockResolvedValueOnce(mesure("GREEN"));
    const r = await preSwapScan(FROM, TO);
    expect(r.degraded).toBe(true);
    expect(r.warning).toBeDefined();
    expect(r.coverage.sides.find((s) => s.side === "from")?.detail).toContain("market");
  });

  it("MUTANT DE SUR-CORRECTION — un résultat PROPRE n'est pas dégradé pour autant", async () => {
    // Le signal doit rester capable de distinguer. Avertir toujours ne vaut
    // pas mieux qu'autoriser toujours.
    setVerdicts("GREEN", "GREEN");
    const r = await preSwapScan(FROM, TO);
    expect(r.degraded).toBe(false);
    expect(r.warning).toBeUndefined();
  });

  it("MUTANT DE SUR-CORRECTION — une panne ne BLOQUE pas non plus", async () => {
    // Ne pas conclure n'est pas conclure au pire : le contrat legacy n'a pas
    // d'état neutre, et bloquer sur une panne inventerait une gravité.
    mockMeasured
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"));
    const r = await preSwapScan(FROM, TO);
    expect(r.blocked).toBe(false);
    expect(r.blockReason).toBeUndefined();
  });
});
