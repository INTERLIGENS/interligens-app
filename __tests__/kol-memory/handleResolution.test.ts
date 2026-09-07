// ─── BUILD 8 / E1 — résoudre un handle sans jamais deviner ─────────────────
//
// 21 des 32 profils publiés étaient injoignables : la route abaissait la casse,
// le lookup était strict. Et une collision de casse existe déjà en base
// (`0xsweep` / `0xSweep`), ce qui interdit la solution facile.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { kolProfile: { findUnique: (...a: unknown[]) => findUnique(...a), findMany: (...a: unknown[]) => findMany(...a) } },
}));

import {
  resolveCanonicalHandle,
  normalizeHandleInput,
} from "@/lib/kol-memory/handleResolution";

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  findUnique.mockResolvedValue(null);
  findMany.mockResolvedValue([]);
});

describe("BUILD 8 / E1 — la normalisation ne touche pas à la casse", () => {
  it("retire l'habillage, jamais la casse", () => {
    expect(normalizeHandleInput("  @GordonGekko ")).toBe("GordonGekko");
    expect(normalizeHandleInput("@@Myrrha")).toBe("Myrrha");
    expect(normalizeHandleInput("0xBossman")).toBe("0xBossman");
  });

  it("une entrée vide ou absente reste vide", () => {
    for (const v of ["", "   ", "@", null, undefined]) {
      expect(normalizeHandleInput(v), String(v)).toBe("");
    }
  });
});

describe("BUILD 8 / E1 — casse exacte", () => {
  it("le handle canonique est rendu tel quel, sans seconde requête", async () => {
    findUnique.mockResolvedValue({ handle: "GordonGekko" });
    const r = await resolveCanonicalHandle("GordonGekko");
    expect(r).toEqual({ handle: "GordonGekko", kind: "EXACT", candidates: ["GordonGekko"] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("l'exactitude l'emporte sur l'ambiguïté — `0xsweep` demandé rend `0xsweep`", async () => {
    // La collision réelle : `0xsweep` ET `0xSweep` existent. Demander
    // exactement l'un des deux doit rendre exactement celui-là.
    findUnique.mockResolvedValue({ handle: "0xsweep" });
    const r = await resolveCanonicalHandle("0xsweep");
    expect(r.handle).toBe("0xsweep");
    expect(r.kind).toBe("EXACT");
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("BUILD 8 / E1 — casse mixte et minuscule", () => {
  it("le cas mesuré : `gordongekko` retrouve `GordonGekko`", async () => {
    findMany.mockResolvedValue([{ handle: "GordonGekko" }]);
    const r = await resolveCanonicalHandle("gordongekko");
    expect(r.handle).toBe("GordonGekko");
    expect(r.kind).toBe("CASE_INSENSITIVE");
  });

  it("rend TOUJOURS l'identité canonique de la base, pas l'entrée reçue", async () => {
    findMany.mockResolvedValue([{ handle: "SolanaRockets" }]);
    for (const saisie of ["solanarockets", "SOLANAROCKETS", "SoLaNaRoCkEtS", "@solanarockets"]) {
      findMany.mockResolvedValue([{ handle: "SolanaRockets" }]);
      const r = await resolveCanonicalHandle(saisie);
      expect(r.handle, saisie).toBe("SolanaRockets");
    }
  });

  it("les 21 handles injoignables se résolvent tous", async () => {
    const LES_21 = [
      "0xBossman", "Barbie", "Blackbeard", "Brommy", "CoachTY", "CryptoZin",
      "DonWedge", "EduRio", "ElonTrades", "Exy", "Geppetto", "GordonGekko",
      "HalieyWelch", "HaydenDavis", "JMilei", "James", "Myrrha", "Nekoz",
      "OrbitApe", "Ronnie", "SolanaRockets",
    ];
    for (const canonique of LES_21) {
      findUnique.mockResolvedValue(null);
      findMany.mockResolvedValue([{ handle: canonique }]);
      const r = await resolveCanonicalHandle(canonique.toLowerCase());
      expect(r.handle, canonique).toBe(canonique);
    }
  });
});

describe("BUILD 8 / E1 — handle absent", () => {
  it("aucune correspondance → null, jamais une devinette", async () => {
    const r = await resolveCanonicalHandle("personne-nexiste-pas");
    expect(r).toEqual({ handle: null, kind: "NONE", candidates: [] });
  });

  it("une entrée vide ne déclenche AUCUNE requête", async () => {
    expect((await resolveCanonicalHandle("  @  ")).kind).toBe("NONE");
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("BUILD 8 / E1 — l'ambiguïté est REFUSÉE, jamais arbitrée", () => {
  it("deux variantes de casse → refus, aucune identité choisie", async () => {
    // Servir l'une des deux attribuerait à une personne le dossier d'une autre.
    findMany.mockResolvedValue([{ handle: "0xSweep" }, { handle: "0xsweep" }]);
    const r = await resolveCanonicalHandle("0xSWEEP");
    expect(r.handle).toBeNull();
    expect(r.kind).toBe("AMBIGUOUS");
    expect(r.candidates).toEqual(["0xSweep", "0xsweep"]);
  });

  it("MUTANT — prendre la première correspondance devient rouge", async () => {
    findMany.mockResolvedValue([{ handle: "0xSweep" }, { handle: "0xsweep" }]);
    const r = await resolveCanonicalHandle("0xSWEEP");
    expect(r.handle).not.toBe("0xSweep");
    expect(r.handle).not.toBe("0xsweep");
  });

  it("AUCUNE recherche floue — la requête est une égalité, pas un `contains`", async () => {
    await resolveCanonicalHandle("gordon");
    const where = findMany.mock.calls[0]?.[0]?.where?.handle ?? {};
    expect(where).toHaveProperty("equals", "gordon");
    expect(where).not.toHaveProperty("contains");
    expect(where).not.toHaveProperty("startsWith");
    expect(where).not.toHaveProperty("search");
  });
});
