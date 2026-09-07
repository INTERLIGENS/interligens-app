// ─── BUILD 8 / P1 — Une adresse ne sort que si son attribution l'autorise ──
//
// Mesuré sur ep-square-band le 2026-09-07, sur les profils publiés :
// 229 wallets servis par /api/kol/[handle] sans aucun filtre, dont 65 en
// `isPubliclyUsable = false`, touchant 21 des 32 profils publiés.

import { describe, it, expect } from "vitest";
import {
  PUBLISHABLE_WALLET_FILTER,
  WALLET_PUBLICATION_SELECT,
  isWalletPublishable,
  publicationRefusalReason,
  assertWalletPublishable,
  walletNature,
  selectPublishableWallets,
  WalletNotPublishableError,
} from "@/lib/kol-memory/walletPublication";
import { UNCLASSIFIED, DATA_NATURES } from "@/lib/data-nature/nature";

const PUBLIABLE = { status: "active", isPubliclyUsable: true };

describe("BUILD 8 / P1 — le prédicat de publiabilité", () => {
  it("publie une ligne active ET explicitement publiable", () => {
    expect(isWalletPublishable(PUBLIABLE)).toBe(true);
  });

  it("le cas mesuré : les 65 lignes `isPubliclyUsable = false` ne sortent pas", () => {
    expect(isWalletPublishable({ status: "active", isPubliclyUsable: false })).toBe(false);
  });

  // ── Fail-closed ──────────────────────────────────────────────────────────
  it("colonne NON SÉLECTIONNÉE → refus, jamais publication silencieuse", () => {
    expect(isWalletPublishable({ status: "active" })).toBe(false);
    expect(publicationRefusalReason({ status: "active" })).toMatch(/non sélectionnée/);
  });

  it("`null`, `0`, `\"true\"`, `1` ne valent PAS `true`", () => {
    for (const v of [null, undefined, 0, 1, "true", "1", "", {}, []]) {
      expect(isWalletPublishable({ status: "active", isPubliclyUsable: v }), JSON.stringify(v)).toBe(
        false,
      );
    }
  });

  it("une ligne inactive ne sort pas, même publiable", () => {
    for (const s of ["inactive", "archived", "", undefined, null]) {
      expect(isWalletPublishable({ status: s, isPubliclyUsable: true }), String(s)).toBe(false);
    }
  });

  it("la raison du refus est nommée, jamais un silence", () => {
    expect(publicationRefusalReason(PUBLIABLE)).toBeNull();
    expect(publicationRefusalReason({ status: "active", isPubliclyUsable: false })).toContain(
      "isPubliclyUsable",
    );
    expect(publicationRefusalReason({ status: "archived", isPubliclyUsable: true })).toContain(
      "status",
    );
  });

  it("`assertWalletPublishable` lève sur tout ce que le prédicat refuse", () => {
    expect(() => assertWalletPublishable(PUBLIABLE, "test")).not.toThrow();
    expect(() => assertWalletPublishable({ status: "active" }, "test")).toThrow(
      WalletNotPublishableError,
    );
  });
});

describe("BUILD 8 / P1 — le filtre Prisma est la même décision", () => {
  it("filtre sur les deux axes, et sur rien d'autre", () => {
    expect(PUBLISHABLE_WALLET_FILTER).toEqual({ status: "active", isPubliclyUsable: true });
  });

  it("N'inclut PAS attributionStatus — deux axes distincts, deux questions", () => {
    // 76 lignes sont `confirmed` mais NON publiables, 5 sont `review` mais
    // publiables. Fusionner les axes retirerait 51 lignes de plus au nom d'un
    // critère que personne n'a ratifié.
    expect(Object.keys(PUBLISHABLE_WALLET_FILTER)).not.toContain("attributionStatus");
  });

  it("le SELECT porte les colonnes sans lesquelles la décision est impossible", () => {
    for (const col of ["status", "isPubliclyUsable"]) {
      expect(WALLET_PUBLICATION_SELECT, col).toHaveProperty(col, true);
    }
  });
});

describe("BUILD 8 / P1 — la nature accompagne, elle ne supprime pas", () => {
  it("une nature valide est rendue telle quelle", () => {
    for (const n of DATA_NATURES) {
      expect(walletNature({ rowNature: n }), n).toBe(n);
    }
  });

  it("une ligne sans nature sort en UNCLASSIFIED — visible, pas supprimée", () => {
    // 200 des 229 wallets servis n'ont pas de rowNature. Les faire lever
    // supprimerait la dette au lieu de la montrer : writeGuard.ts l'interdit
    // explicitement sur un chemin de LECTURE.
    for (const v of [undefined, null, "", "GARBAGE", 3, {}]) {
      expect(walletNature({ rowNature: v }), JSON.stringify(v)).toBe(UNCLASSIFIED);
    }
  });

  it("`selectPublishableWallets` filtre PUIS étiquette", () => {
    const rows = [
      { id: "a", status: "active", isPubliclyUsable: true, rowNature: "THIRD_PARTY_DATA" },
      { id: "b", status: "active", isPubliclyUsable: false, rowNature: "THIRD_PARTY_DATA" },
      { id: "c", status: "active", isPubliclyUsable: true },
      { id: "d", status: "archived", isPubliclyUsable: true },
    ];
    const out = selectPublishableWallets(rows);
    expect(out.map((w) => w.id)).toEqual(["a", "c"]);
    expect(out[0].natureValue).toBe("THIRD_PARTY_DATA");
    expect(out[1].natureValue).toBe(UNCLASSIFIED);
  });

  it("MUTANT — un filtre qui laisserait passer `isPubliclyUsable: false` devient rouge", () => {
    const nonPubliables = [
      { status: "active", isPubliclyUsable: false },
      { status: "active", isPubliclyUsable: null },
      { status: "active" },
    ];
    expect(selectPublishableWallets(nonPubliables)).toHaveLength(0);
  });
});
