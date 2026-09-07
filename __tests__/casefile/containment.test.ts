// ─── CONTAINMENT P0 — les montants nominatifs BOTIFY ───────────────────────
//
// Quatre encaissements attribués à des personnes nommées, adossés à ZÉRO ligne
// KolProceedsEvent. Trois des quatre adresses sont `isPubliclyUsable = false`.
// Ces tests vérifient que rien de tout cela ne ressort — ni de la source, ni
// du HTML final.

import { describe, it, expect } from "vitest";
import { buildBotifyInput, buildVineInput } from "@/lib/casefile/presets";
import {
  CONTAINED_BOTIFY_CLAIMS,
  CONTAINED_BOTIFY_AGGREGATES,
  NON_PUBLISHABLE_ADDRESSES,
  assertNoContainedClaim,
  isAddressWithheld,
  withholdNonPublishable,
  ContainedClaimLeakError,
} from "@/lib/casefile/containment";

/** Toutes les écritures d'un nombre : 347237 · 347 237 · 347,237 · 347.237 */
const formes = (n: number) => {
  const b = String(n);
  return [b, b.replace(/\B(?=(\d{3})+(?!\d))/g, " "), b.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    b.replace(/\B(?=(\d{3})+(?!\d))/g, ".")];
};

const TOUS_LES_MONTANTS = [
  ...CONTAINED_BOTIFY_CLAIMS.flatMap((c) => formes(c.withdrawnUsd)),
  ...formes(CONTAINED_BOTIFY_AGGREGATES.cashoutsUsd),
];

/** Sérialisation complète d'un preset — rien ne doit s'y cacher. */
const serialiser = (o: unknown) => JSON.stringify(o);

describe("CONTAINMENT — les 4 montants ne sortent plus de la source", () => {
  const botify = serialiser(buildBotifyInput());

  it("aucune des écritures des 4 montants n'apparaît dans le preset", () => {
    for (const c of CONTAINED_BOTIFY_CLAIMS) {
      for (const f of formes(c.withdrawnUsd)) {
        expect(botify, `${c.subject} / ${f}`).not.toContain(f);
      }
    }
  });

  it("l'agrégat 604 489 $ n'apparaît plus non plus", () => {
    for (const f of formes(CONTAINED_BOTIFY_AGGREGATES.cashoutsUsd)) {
      expect(botify, f).not.toContain(f);
    }
  });

  it("les compteurs non reproductibles — 28 KOL, 295 événements — ont disparu", () => {
    expect(botify).not.toContain("28 KOLs");
    expect(botify).not.toContain("295 événements");
  });

  it("AUCUNE valeur de la base n'a été substituée", () => {
    // 150 577 $ / 18 KOL / 262 événements sont ce que la base mesure. Les
    // poser ici remplacerait une affirmation non soutenue par une autre, sans
    // avoir démontré que les deux mesurent la même chose.
    for (const substitut of ["150577", "150 577", "18 KOL", "262"]) {
      expect(botify, substitut).not.toContain(substitut);
    }
  });
});

describe("CONTAINMENT — les 3 adresses non publiables ne sortent pas", () => {
  const wallets = buildBotifyInput().wallets_onchain ?? [];

  it("le régime `isPubliclyUsable` est appliqué au CaseFile nominatif", () => {
    expect(NON_PUBLISHABLE_ADDRESSES.size).toBe(3);
    for (const addr of NON_PUBLISHABLE_ADDRESSES) {
      expect(wallets.map((w) => w.address.toLowerCase()), addr).not.toContain(addr);
    }
  });

  it("seule l'adresse publiable subsiste", () => {
    expect(wallets).toHaveLength(1);
    expect(wallets[0].address).toBe("0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41");
  });

  it("et elle ne porte plus de montant", () => {
    expect(wallets[0].role).toContain("retiré de la publication");
    for (const f of formes(40_627)) expect(wallets[0].role, f).not.toContain(f);
  });

  it("MUTANT — réintroduire une adresse retirée devient rouge", () => {
    const avec = withholdNonPublishable(
      [{ address: "GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66", role: "x" }],
      "MUTANT",
    );
    expect(avec).toHaveLength(0);
  });
});

describe("CONTAINMENT — le garde de sortie est fail-closed", () => {
  it("il LÈVE sur un montant retiré, il ne nettoie pas", () => {
    for (const f of TOUS_LES_MONTANTS) {
      expect(() => assertNoContainedClaim(`total ${f} USD`, "test"), f).toThrow(
        ContainedClaimLeakError,
      );
    }
  });

  it("il laisse passer un texte sain", () => {
    expect(() => assertNoContainedClaim("cashouts documentés vers MEXC", "test")).not.toThrow();
    expect(() => assertNoContainedClaim(null, "test")).not.toThrow();
  });

  it("`isAddressWithheld` est insensible à la casse et aux espaces", () => {
    expect(isAddressWithheld("  gwne324dderagrqu7b6svubfkkzgx7jppfzvzpaskf66 ")).toBe(true);
    expect(isAddressWithheld("0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41")).toBe(false);
    expect(isAddressWithheld(null)).toBe(false);
  });
});

describe("CONTAINMENT — le HTML rendu, pas seulement la source", () => {
  // C'est le point qui compte : /api/casefile/generate accepte un `data`
  // arbitraire, donc un garde qui ne vivrait que dans presets.ts ne couvrirait
  // pas tous les chemins.
  it("le générateur refuse un input reconstruit à la main", async () => {
    const { generateCaseFilePdf } = await import("@/lib/casefile/pdfGenerator");
    const malveillant = {
      case_meta: {
        case_id: "X", token_name: "BOTIFY", ticker: "$BOTIFY",
        mint: "m", chain: "solana", severity: "CRITICAL" as const,
        summary_fr: "cashouts totalisant $604 489 USD",
      },
    };
    const r = await generateCaseFilePdf(malveillant as never);
    expect(r.success).toBe(false);
    expect(String((r as { error?: string }).error ?? "")).toMatch(/containment|retirée/i);
  });

  it("le générateur refuse une adresse non publiable réinjectée", async () => {
    const { generateCaseFilePdf } = await import("@/lib/casefile/pdfGenerator");
    const malveillant = {
      case_meta: {
        case_id: "X", token_name: "BOTIFY", ticker: "$BOTIFY",
        mint: "m", chain: "solana", severity: "CRITICAL" as const,
      },
      wallets_onchain: [
        { label: "EduRio", address: "GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66", chain: "solana" },
      ],
    };
    const r = await generateCaseFilePdf(malveillant as never);
    expect(r.success).toBe(false);
    expect(String((r as { error?: string }).error ?? "")).toMatch(/isPubliclyUsable|containment/i);
  });
});

describe("CONTAINMENT — le garde est bien CÂBLÉ dans le générateur", () => {
  it("generateCaseFilePdf appelle le garde AVANT de lancer le navigateur", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/casefile/pdfGenerator.ts", "utf8");
    const i = src.indexOf("assertNoContainedClaim(html");
    const j = src.indexOf("puppeteer.launch");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(-1);
    // Refuser après avoir rendu le PDF ne servirait à rien.
    expect(i).toBeLessThan(j);
    expect(src).toContain("isAddressWithheld(w.address)");
  });

  it("le preset BOTIFY complet TRAVERSE le garde sans lever", () => {
    // La preuve dans l'autre sens : la source contenue est réellement propre,
    // pas seulement « différente ».
    expect(() =>
      assertNoContainedClaim(JSON.stringify(buildBotifyInput()), "preset-botify"),
    ).not.toThrow();
    for (const w of buildBotifyInput().wallets_onchain ?? []) {
      expect(isAddressWithheld(w.address), w.address).toBe(false);
    }
  });

  it("les autres surfaces CaseFile ne portent aucun montant retiré", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of [
      "src/app/api/casefile/route.ts",
      "data/cases/botify.json",
      "src/data/cases/botify.json",
    ]) {
      const src = readFileSync(f, "utf8");
      for (const m of TOUS_LES_MONTANTS) {
        expect(src, `${f} / ${m}`).not.toContain(m);
      }
    }
  });
});

describe("CONTAINMENT — portée : on retire, on ne corrige pas", () => {
  it("les montants retirés restent consignés, pour que le retrait soit auditable", () => {
    expect(CONTAINED_BOTIFY_CLAIMS).toHaveLength(4);
    for (const c of CONTAINED_BOTIFY_CLAIMS) {
      expect(c.measuredProceedsEvents, c.subject).toBe(0);
      expect(c.withdrawnUsd, c.subject).toBeGreaterThan(0);
    }
  });

  it("VINE n'est pas touché — le containment vise BOTIFY", () => {
    expect(() => buildVineInput()).not.toThrow();
  });
});
