// ─── BUILD 10 / FENÊTRE 1 — LE CONTAINMENT MONÉTAIRE DU PDF KOL ───────────
//
// Mesuré le 2026-09-08. En base : 6 profils portent
// `proceedsPublication = 'withdrawn'` (décisions du 16 août, journalisées).
// En production, PDF servi avec authentification admin :
//
//     GordonGekko $580K · OrbitApe $817K · bkokoski $211K
//
// soit `kol.totalDocumented` publié sans aucune gate.
//
// Deux défauts, indissociables :
//   · la route ne gatait pas les deux TOTAUX du profil (les montants de PREUVE
//     l'étaient depuis A15) ;
//   · les gabarits repliaient sur `evidences.reduce(…, 0)`, donc neutraliser le
//     total à la route aurait DÉCLENCHÉ un recalcul depuis les événements bruts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderKolPdf } from "@/lib/pdf/kol/templateKol";
import { renderKolPdfLegal } from "@/lib/pdf/kol/templateKolLegal";
import { readFileSync } from "node:fs";
import { safeEvidenceUrl } from "@/lib/kol-memory/publicIdentityProjection";
import { BOTIFY_MINT as CANON, BOTIFY_SYNTHETIC_ROUTE_KEY as SYNTH } from "@/lib/kol-memory/tokenIdentity";

/** Les six profils retirés, et le montant que chacun publiait. */
const LES_SIX = [
  ["GordonGekko", 579645],
  ["OrbitApe", 817000],
  ["James", 380000],
  ["bkokoski", 210900],
  ["sxyz500", 141594],
  ["Myrrha", 127036],
] as const;

const profil = (o: Record<string, unknown> = {}) => ({
  handle: "GordonGekko",
  displayName: "Gordon Gekko",
  platform: "x",
  riskFlag: "confirmed_scammer",
  confidence: "high",
  rugCount: 3,
  tier: "CRITICAL",
  totalDocumented: null,
  totalScammed: null,
  evidences: [],
  kolWallets: [],
  kolCases: [],
  ...o,
});

/** Des preuves qui PORTENT des montants — de quoi alimenter un recalcul. */
const PREUVES_CHIFFREES = [
  { type: "onchain_cashout", label: "w1", amountUsd: 256969, txCount: 12, token: "USDC" },
  { type: "coordinated_exit", label: "w2", amountUsd: 385780, txCount: 4, token: "USDC" },
];

const rendus = (kol: unknown) => [
  renderKolPdf(kol, "retail"),
  renderKolPdf(kol, "lawyer"),
  renderKolPdfLegal(kol),
];

// ─────────────────── LE REPLI QUI RECALCULAIT ────────────────────

describe("MUTANT · repli reduce() réintroduit — aucun total n'est recalculé", () => {
  it("total absent + preuves chiffrées → AUCUNE somme des preuves n'apparaît", () => {
    const kol = profil({ evidences: PREUVES_CHIFFREES });
    for (const html of rendus(kol)) {
      // 256969 + 385780 = 642749 — la somme que le repli produisait.
      expect(html).not.toContain("642749");
      expect(html).not.toContain("$643K");
      expect(html).not.toContain("$642K");
    }
  });

  it("le repli ne se déclenche pas non plus sur une liste de preuves VIDE", () => {
    for (const html of rendus(profil({ evidences: [] }))) {
      expect(html).toContain("NOT PUBLISHED");
    }
  });

  it("MUTANT DE SUR-CORRECTION · l'absence n'est jamais rendue « 0 » ni « $0 »", () => {
    for (const html of rendus(profil({ evidences: PREUVES_CHIFFREES }))) {
      expect(html).not.toMatch(/>\s*\$0\s*</);
      expect(html).not.toMatch(/>\s*0\s*<\/div>/);
    }
  });

  it("MUTANT DE SUR-CORRECTION · un total RÉELLEMENT publié sort tel quel", () => {
    const kol = profil({ totalDocumented: 4200, totalScammed: 9100 });
    for (const html of rendus(kol)) {
      expect(html).toContain("$4K");
      expect(html).toContain("$9K");
      expect(html).not.toContain("NOT PUBLISHED");
    }
  });
});

// ─────────────────── L'ABSENCE EST DITE, PAS SUGGÉRÉE ────────────────────

describe("un montant non publié le DIT, et ne se lit pas « zéro »", () => {
  it("le tiret de fmtUsd ne sert plus à porter un total absent", () => {
    for (const html of rendus(profil())) {
      expect(html).toContain("NOT PUBLISHED");
    }
  });

  it("les deux totaux sont couverts, pas seulement celui des proceeds", () => {
    const html = renderKolPdfLegal(profil({ totalDocumented: 4200, totalScammed: null }));
    expect(html).toContain("$4K");
    expect(html).toContain("NOT PUBLISHED");
  });
});

// ─────────────────── LA PHRASE NARRATIVE ────────────────────

describe("la phrase de repli du document légal", () => {
  const phrase = (kol: unknown) => {
    const m = renderKolPdfLegal(kol).match(/@[A-Za-z0-9_]+ is a high-risk actor[^<]*/);
    return m ? m[0] : "";
  };

  it("aucun montant retiré n'y apparaît, et elle ne dit pas « totaling — »", () => {
    const p = phrase(profil({ evidences: PREUVES_CHIFFREES }));
    expect(p).not.toContain("totaling —");
    expect(p).not.toContain("642749");
    expect(p).toContain("No figure is published for");
  });

  it("elle NOMME ce qui n'est pas publié, sans en affirmer la cause", () => {
    const p = phrase(profil());
    expect(p).toContain("documented proceeds");
    expect(p).toContain("unrealized EVM holdings");
    // Aucune cause affirmée : le gabarit ne sait pas laquelle c'est.
    expect(p).not.toContain("withdrawn");
    expect(p).not.toContain("never measured");
  });

  it("le décompte d'événements survit — c'est un dénombrement, pas un montant", () => {
    const kol = profil({
      evidences: [{ type: "onchain_cashout", label: "w1", amountUsd: null, token: "USDC" }],
    });
    expect(phrase(kol)).toContain("identified 1 associated wallet");
  });

  it("MUTANT DE SUR-CORRECTION · deux montants publiés → la phrase d'origine", () => {
    const kol = profil({
      totalDocumented: 4200,
      evidences: [{ type: "evm_wallet", label: "evm", amountUsd: 9100 }],
    });
    const p = phrase(kol);
    expect(p).toContain("totaling $4K in documented proceeds, plus $9K in unrealized EVM holdings");
    expect(p).not.toContain("No figure is published");
  });

  it("un seul des deux publié → l'autre est nommé, le premier garde son chiffre", () => {
    const kol = profil({
      totalDocumented: 4200,
      evidences: [{ type: "evm_wallet", label: "evm", amountUsd: null }],
    });
    const p = phrase(kol);
    expect(p).toContain("totaling $4K in documented proceeds");
    expect(p).toContain("No figure is published for unrealized EVM holdings");
    expect(p).not.toContain("No figure is published for documented proceeds");
  });

  it("un exitNarrative rédigé à la main n'est pas remplacé", () => {
    const html = renderKolPdfLegal(profil({ exitNarrative: "NARRATIF MAISON" }));
    expect(html).toContain("NARRATIF MAISON");
    expect(html).not.toContain("is a high-risk actor with");
  });
});

// ─────────────────── LA GATE À LA ROUTE ────────────────────

const kolProfile = { findUnique: vi.fn() };
const laundryTrail = { findFirst: vi.fn() };
const queryRawUnsafe = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { kolProfile, laundryTrail, $queryRawUnsafe: queryRawUnsafe },
}));
vi.mock("@/lib/security/auth", () => ({ checkAuth: vi.fn(async () => ({ authorized: true })) }));

const { GET } = await import("@/app/api/pdf/kol/route");

beforeEach(() => {
  kolProfile.findUnique.mockReset();
  laundryTrail.findFirst.mockReset();
  laundryTrail.findFirst.mockResolvedValue(null);
  queryRawUnsafe.mockReset();
  // La synthèse d'encaissement ne s'exécute que sur un profil PUBLISHED ; on la
  // laisse vide pour que le test porte sur le TOTAL, pas sur elle.
  queryRawUnsafe.mockResolvedValue([]);
});

const servir = async (handle: string, mode = "retail") => {
  const res = await GET(
    new Request(`http://x/api/pdf/kol?handle=${handle}&format=html&mode=${mode}`) as never,
  );
  return res.text();
};

describe("MUTANT · gate route retirée — les six montants retirés ressortiraient", () => {
  for (const [handle, montant] of LES_SIX) {
    it(`${handle} · proceedsPublication='withdrawn' → ${montant} n'est pas publié`, async () => {
      kolProfile.findUnique.mockResolvedValue(
        profil({
          handle,
          totalDocumented: montant,
          proceedsPublication: "withdrawn",
          monetaryClaimsPublication: "published",
          evidences: PREUVES_CHIFFREES,
        }),
      );
      const html = await servir(handle);
      expect(html).not.toContain(String(montant));
      expect(html).not.toContain("$" + Math.round(montant / 1000) + "K");
      expect(html).toContain("NOT PUBLISHED");
    });
  }

  it("le document légal ferme les six de la même façon", async () => {
    for (const [handle, montant] of LES_SIX) {
      kolProfile.findUnique.mockResolvedValue(
        profil({
          handle,
          totalDocumented: montant,
          proceedsPublication: "withdrawn",
          monetaryClaimsPublication: "published",
        }),
      );
      expect(await servir(handle, "lawyer")).not.toContain(String(montant));
    }
  });

  it("MUTANT DE SUR-CORRECTION · un profil PUBLISHED garde son montant", async () => {
    kolProfile.findUnique.mockResolvedValue(
      profil({
        totalDocumented: 579645,
        totalScammed: 4500000,
        proceedsPublication: "published",
        monetaryClaimsPublication: "published",
      }),
    );
    const html = await servir("GordonGekko");
    expect(html).toContain("$580K");
    expect(html).toContain("$4.5M");
    // Les deux totaux sont publiés : aucune absence à énoncer.
    expect(html).not.toContain("NOT PUBLISHED");
  });

  it("fail-closed · colonnes absentes du profil → rien n'est publié", async () => {
    kolProfile.findUnique.mockResolvedValue(profil({ totalDocumented: 579645 }));
    const html = await servir("GordonGekko");
    expect(html).not.toContain("579645");
    expect(html).not.toContain("$580K");
    expect(html).toContain("NOT PUBLISHED");
  });

  it("l'interrupteur d'ampleur est distinct de celui d'encaissement", async () => {
    kolProfile.findUnique.mockResolvedValue(
      profil({
        totalDocumented: 579645,
        totalScammed: 4500000,
        proceedsPublication: "withdrawn",
        monetaryClaimsPublication: "published",
      }),
    );
    const html = await servir("bkokoski");
    // Le préjudice reste publié — sa décision à lui n'a pas été prise.
    expect(html).toContain("$4.5M");
    // L'encaissement, lui, est retiré.
    expect(html).not.toContain("$580K");
  });

  it("monetaryClaimsPublication retiré éteint AUSSI le préjudice", async () => {
    kolProfile.findUnique.mockResolvedValue(
      profil({
        totalScammed: 4500000,
        proceedsPublication: "published",
        monetaryClaimsPublication: "withdrawn",
      }),
    );
    expect(await servir("bkokoski")).not.toContain("$4.5M");
  });
});

// ─────────────────── L'IDENTITÉ DANS LE PDF CASEFILE ────────────────────
//
// Question laissée ouverte par le handoff T2 (§6b) et tranchée en base le
// 2026-09-08 : 4 des 14 `CaseFileClaim."threadUrl"` canoniques portent la clé
// synthétique 43 — C3, C4, C5, C7 de IL-SHILL-BOTIFY-001 — et 0 porte la clé
// canonique. Le patch P3 fait de ce champ un NOUVEAU point de consommation.

describe("report/casefile — le thread_url canonique passe par la gate d'identité", () => {
  const source = readFileSync("src/app/api/report/casefile/route.ts", "utf8");

  it("MUTANT · gate retirée → le champ repartirait brut", () => {
    expect(source).toContain("thread_url: safeEvidenceUrl(c.provenance.threadUrl)");
    expect(source).not.toMatch(/thread_url:\s*c\.provenance\.threadUrl\s*,/);
  });

  it("la gate est IMPORTÉE du module canonique, jamais recopiée", () => {
    expect(source).toContain('from "@/lib/kol-memory/publicIdentityProjection"');
    expect(source).not.toContain("BYZ9CcZ");
  });

  it("les 4 URL canoniques mesurées sont réécrites sur le mint canonique", () => {
    for (const u of [
      `https://dexscreener.com/solana/${SYNTH}`,
      `https://solscan.io/token/${SYNTH}`,
      `https://rugcheck.xyz/tokens/${SYNTH}`,
      `https://solscan.io/token/${SYNTH}#holders`,
    ]) {
      const out = safeEvidenceUrl(u);
      expect(out).not.toContain(SYNTH);
      expect(out).toContain(CANON);
    }
  });

  it("une URL sans identité fermée traverse inchangée — pas de sur-correction", () => {
    const u = "https://x.com/dethective/status/1997766979898450185";
    expect(safeEvidenceUrl(u)).toBe(u);
  });
});
