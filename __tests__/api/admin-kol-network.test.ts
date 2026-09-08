// ─── BUILD 10 / FENÊTRE 2 — LE GRAPHE ADMIN EST UNE FRONTIÈRE DE PUBLICATION ─
//
// Mesuré le 2026-09-08 sur ep-square-band :
//
//   482  KolWallet servis BRUTS par `SELECT *`, dont 303 NON publiables
//     2  labels sous PROHIBITED_PUBLIC_STRINGS — et les DEUX portent
//        isPubliclyUsable=true ET status='active' : le filtre de publiabilité
//        ne les arrête pas, les deux gates sont indépendantes
//     3  profils confirmed_scammer, dont 1 totalScammed NULL et 0 vrai zéro
//
// « Admin contrôle QUI PEUT PRODUIRE l'artefact. Cela ne gouverne pas CE QUE
//   L'ARTEFACT PEUT PUBLIER. »

import { describe, it, expect, vi, beforeEach } from "vitest";
import { monetaryState, monetaryValue, MONETARY_ABSENCE } from "@/lib/publication/absenceVocabulary";

const kolProfile = { findMany: vi.fn() };
const kolWallet = { findMany: vi.fn() };
const kolCase = { findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { kolProfile, kolWallet, kolCase } }));

const { GET } = await import("@/app/api/admin/kol/network/route");

const PROFIL = {
  handle: "bkokoski",
  displayName: "bk",
  rugCount: 4,
  totalScammed: 4500000,
  status: "active",
  verified: true,
  proceedsPublication: "published",
  monetaryClaimsPublication: "published",
};

const WALLET = {
  id: "w1",
  kolHandle: "bkokoski",
  address: "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj",
  chain: "SOL",
  label: "cold storage",
  isPubliclyUsable: true,
  status: "active",
  rowNature: null,
};

beforeEach(() => {
  for (const m of [kolProfile, kolWallet, kolCase]) m.findMany.mockReset();
  kolProfile.findMany.mockResolvedValue([PROFIL]);
  kolWallet.findMany.mockResolvedValue([WALLET]);
  kolCase.findMany.mockResolvedValue([]);
  process.env.ADMIN_TOKEN = "jeton-de-test";
});

const appel = async () => {
  const res = await GET(
    new Request("http://x/api/admin/kol/network", {
      headers: { authorization: "Bearer jeton-de-test" },
    }) as never,
  );
  return { status: res.status, body: await res.json() };
};

describe("l'authentification n'est pas touchée", () => {
  it("sans jeton, 401 — et rien du corps n'est calculé", async () => {
    const res = await GET(new Request("http://x/api/admin/kol/network") as never);
    expect(res.status).toBe(401);
    expect(kolWallet.findMany).not.toHaveBeenCalled();
  });
});

// ─────────────────── B · LES LABELS ────────────────────

describe("B · le RENDU est gaté, la DONNÉE n'est pas touchée", () => {
  const AVEC_LABEL_BLOQUE = {
    ...WALLET,
    label: "Mom wallet — received GHOST + BOTIFY insider supply, sold",
  };

  it("MUTANT · gate labels retirée → « Mom wallet » ressortirait", async () => {
    kolWallet.findMany.mockResolvedValue([AVEC_LABEL_BLOQUE]);
    const { body } = await appel();
    expect(JSON.stringify(body).toLowerCase()).not.toContain("mom wallet");
    expect(body.wallets[0].label).toContain("WITHHELD");
  });

  it("« Dad wallet » aussi — les deux mesurés en base", async () => {
    kolWallet.findMany.mockResolvedValue([
      { ...WALLET, label: "Dad wallet — received insider supply, dumped" },
    ]);
    const { body } = await appel();
    expect(JSON.stringify(body).toLowerCase()).not.toContain("dad wallet");
  });

  it("la gate mord sur un wallet PUBLIABLE — c'est le cas mesuré", async () => {
    // Les deux labels bloqués portent isPubliclyUsable=true et status='active'.
    // Le filtre de publiabilité ne les arrête pas : la seconde gate est requise.
    kolWallet.findMany.mockResolvedValue([AVEC_LABEL_BLOQUE]);
    const { body } = await appel();
    expect(body.wallets).toHaveLength(1);
    expect(body.wallets[0].label).not.toContain("Mom");
  });

  it("MUTANT DE SUR-CORRECTION · un label ANODIN n'est pas censuré", async () => {
    const { body } = await appel();
    expect(body.wallets[0].label).toBe("cold storage");
  });

  it("un label absent reste null, il ne devient pas un motif de blocage", async () => {
    kolWallet.findMany.mockResolvedValue([{ ...WALLET, label: null }]);
    const { body } = await appel();
    expect(body.wallets[0].label).toBeNull();
  });

  it("la liste interdite n'est PAS recopiée dans la route", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/admin/kol/network/route.ts", "utf8"),
    );
    expect(src).toContain("checkPublishability");
    expect(src.toLowerCase()).not.toContain("'mom wallet'");
    expect(src.toLowerCase()).not.toContain("serial scammer");
  });

  it("l'evidence d'un dossier passe par la même gate", async () => {
    kolCase.findMany.mockResolvedValue([
      { id: "c1", kolHandle: "bkokoski", caseId: "X", role: "promoter", paidUsd: 10, evidence: "confirmed scammer, stole funds" },
    ]);
    const { body } = await appel();
    expect(JSON.stringify(body).toLowerCase()).not.toContain("confirmed scammer");
  });
});

// ─────────────────── C · NULL ≠ 0 ────────────────────

describe("C · sur un champ de PRÉJUDICE, l'absence ne devient pas zéro", () => {
  it("MUTANT · coercition `?? 0` réintroduite → totalScammed vaudrait 0", async () => {
    kolProfile.findMany.mockResolvedValue([{ ...PROFIL, totalScammed: null }]);
    const { body } = await appel();
    expect(body.kols[0].totalScammed).toBeNull();
    expect(body.kols[0].totalScammed).not.toBe(0);
    expect(body.kols[0].totalScammedState).toBe(MONETARY_ABSENCE.NOT_MEASURED);
  });

  it("MUTANT DE SUR-CORRECTION · une valeur MESURÉE n'est pas omise", async () => {
    const { body } = await appel();
    expect(body.kols[0].totalScammed).toBe(4500000);
    expect(body.kols[0].totalScammedState).toBe("PUBLISHED");
  });

  it("un vrai zéro se distingue d'une absence", async () => {
    kolProfile.findMany.mockResolvedValue([{ ...PROFIL, totalScammed: 0 }]);
    const { body } = await appel();
    expect(body.kols[0].totalScammed).toBe(0);
    expect(body.kols[0].totalScammedState).toBe("PUBLISHED");
  });

  it("interrupteur d'ampleur retiré → WITHHELD, et non NOT_MEASURED", async () => {
    kolProfile.findMany.mockResolvedValue([
      { ...PROFIL, monetaryClaimsPublication: "withdrawn" },
    ]);
    const { body } = await appel();
    expect(body.kols[0].totalScammed).toBeNull();
    expect(body.kols[0].totalScammedState).toBe(MONETARY_ABSENCE.WITHHELD);
  });

  it("paidUsd suit la décision d'ENCAISSEMENT du profil porteur", async () => {
    kolProfile.findMany.mockResolvedValue([{ ...PROFIL, proceedsPublication: "withdrawn" }]);
    kolCase.findMany.mockResolvedValue([
      { id: "c1", kolHandle: "bkokoski", caseId: "X", role: "promoter", paidUsd: 42000, evidence: null },
    ]);
    const { body } = await appel();
    expect(body.cases[0].paidUsd).toBeNull();
    expect(body.cases[0].paidUsdState).toBe(MONETARY_ABSENCE.WITHHELD);
    expect(JSON.stringify(body)).not.toContain("42000");
  });

  it("un dossier dont le porteur est inconnu est fail-closed", async () => {
    kolCase.findMany.mockResolvedValue([
      { id: "c1", kolHandle: "inconnu", caseId: "X", role: "promoter", paidUsd: 99, evidence: null },
    ]);
    const { body } = await appel();
    expect(body.cases[0].paidUsdState).toBe(MONETARY_ABSENCE.WITHHELD);
  });

  it("le vocabulaire est celui du CSV — aucun troisième mot", () => {
    expect(Object.values(MONETARY_ABSENCE).sort()).toEqual([
      "NOT_APPLICABLE",
      "NOT_MEASURED",
      "WITHHELD",
    ]);
    expect(monetaryState(false, 5)).toBe("WITHHELD");
    expect(monetaryState(true, null)).toBe("NOT_MEASURED");
    expect(monetaryState(true, 5)).toBe("PUBLISHED");
    expect(monetaryValue("WITHHELD", 5)).toBeNull();
    expect(monetaryValue("PUBLISHED", 5)).toBe(5);
  });

  it("un retrait ne se dégrade PAS en lacune quand la valeur manque aussi", () => {
    // Sinon la décision prise ne se lirait plus nulle part.
    expect(monetaryState(false, null)).toBe("WITHHELD");
  });
});

// ─────────────────── D · LA SORTIE ────────────────────

describe("D · la réponse est réduite au contrat de la surface", () => {
  it("MUTANT · sortie brute réintroduite → les colonnes d'enquête ressortiraient", async () => {
    kolWallet.findMany.mockResolvedValue([
      { ...WALLET, attributionNote: "NOTE INTERNE", sourceUrl: "https://interne", attributionStatus: "review" },
    ]);
    const { body } = await appel();
    const brut = JSON.stringify(body);
    expect(brut).not.toContain("NOTE INTERNE");
    expect(brut).not.toContain("attributionNote");
    expect(brut).not.toContain("attributionStatus");
    expect(brut).not.toContain("sourceUrl");
  });

  it("un wallet ne porte QUE les 5 champs consommés par le graphe", async () => {
    const { body } = await appel();
    expect(Object.keys(body.wallets[0]).sort()).toEqual(
      ["address", "chain", "id", "kolHandle", "label"].sort(),
    );
  });

  it("un dossier ne porte QUE les champs consommés, plus son état", async () => {
    kolCase.findMany.mockResolvedValue([
      { id: "c1", kolHandle: "bkokoski", caseId: "X", role: "promoter", paidUsd: 1, evidence: "ok" },
    ]);
    const { body } = await appel();
    expect(Object.keys(body.cases[0]).sort()).toEqual(
      ["caseId", "evidence", "id", "kolHandle", "paidUsd", "paidUsdState", "role"].sort(),
    );
  });

  it("MUTANT · filtre de publiabilité retiré → les 303 ressortiraient", async () => {
    kolWallet.findMany.mockResolvedValue([
      WALLET,
      { ...WALLET, id: "w2", address: "NONPUBLIABLE", isPubliclyUsable: false },
      { ...WALLET, id: "w3", address: "INACTIF", status: "retired" },
    ]);
    const { body } = await appel();
    expect(body.wallets.map((w: { address: string }) => w.address)).toEqual([WALLET.address]);
  });

  it("le WHERE porte le filtre canonique, et il n'est pas recopié", async () => {
    await appel();
    const where = kolWallet.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("active");
    expect(where.isPubliclyUsable).toBe(true);
  });

  it("les colonnes de décision sont SÉLECTIONNÉES — sinon le prédicat est aveugle", async () => {
    await appel();
    const select = kolWallet.findMany.mock.calls[0][0].select;
    expect(select.isPubliclyUsable).toBe(true);
    expect(select.status).toBe(true);
    const kSelect = kolProfile.findMany.mock.calls[0][0].select;
    expect(kSelect.proceedsPublication).toBe(true);
    expect(kSelect.monetaryClaimsPublication).toBe(true);
  });

  it("les compteurs comptent CE QUI EST SERVI", async () => {
    kolWallet.findMany.mockResolvedValue([
      WALLET,
      { ...WALLET, id: "w2", address: "NONPUBLIABLE", isPubliclyUsable: false },
    ]);
    const { body } = await appel();
    expect(body.wallets).toHaveLength(1);
    expect(body.kols[0].walletCount).toBe(1);
  });

  it("le graphe garde ce dont il a besoin — projectMap et connections", async () => {
    kolCase.findMany.mockResolvedValue([
      { id: "c1", kolHandle: "bkokoski", caseId: "BOTIFY", role: "promoter", paidUsd: null, evidence: null },
      { id: "c2", kolHandle: "sxyz500", caseId: "BOTIFY", role: "promoter", paidUsd: null, evidence: null },
    ]);
    const { body } = await appel();
    expect(body.projectMap.BOTIFY).toEqual(["bkokoski", "sxyz500"]);
    expect(body.connections).toEqual([{ a: "bkokoski", b: "sxyz500", project: "BOTIFY" }]);
  });

  it("aucun `SELECT *` ne subsiste dans le CODE de la route", async () => {
    // Les commentaires CITENT le défaut retiré : on ne juge que le code.
    const fs = await import("node:fs");
    const code = fs
      .readFileSync("src/app/api/admin/kol/network/route.ts", "utf8")
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toContain("SELECT *");
    expect(code).not.toContain("$queryRawUnsafe");
  });
});
