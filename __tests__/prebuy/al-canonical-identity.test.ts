// ─── AL · ADAPTATEUR D'IDENTITÉ CANONIQUE — LES PREUVES ────────────────────
//
// ██  Le mutant central : attester sur `status` seul.                       ██
//
// `src/lib/token-resolution/v3` satisfait ses cinq preuves et n'était consommé
// nulle part. Le brancher pose deux pièges, et ce fichier les épingle tous
// les deux :
//
//   1. `resolveToken` LÈVE sur panne provider. Non enveloppée, une panne
//      DexScreener fait tomber la requête de score entière en 500.
//   2. `status === "RESOLVED"` n'est PAS le prédicat d'attestation. Le mint
//      SOLANA d'USDC avec un indice ETH rend RESOLVED — et
//      `callerSupport: unsupported_by_caller`, `selected.chain: "SOL"`.
//
// Les adresses de régression sont des FIXTURES DE TEST, jamais des constantes
// de production : rien n'est codé en dur dans le code livré.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isCanonicallyAttested,
  evaluateCanonicalAttestation,
  PREBUY_EVM_CHAINS,
} from "@/lib/prebuy/canonicalTokenIdentity";
import { IDENTITY_AUTHORITIES, resolveTokenIdentity } from "@/lib/prebuy/identity";
import type { CanonicalChain } from "@/lib/token-resolution/v3";

// ═══ FIXTURES DE RÉGRESSION ══════════════════════════════════════════════
//
// Elles vivent ICI. Le code livré n'en connaît aucune.

const FIXTURES = {
  /** USDC, mint SOLANA. Le piège : interrogé avec un indice ETH, il RÉSOUT. */
  usdcSol: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  /** USDC, contrat ERC-20. Le cas qui doit passer de WARN à ALLOW. */
  usdcEth: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  /** USDT, contrat ERC-20. */
  usdtEth: "0xdac17f958d2ee523a2206206994597c13d831ec7",
} as const;

/**
 * Une résolution, réduite à ce que le prédicat lit.
 *
 * L'adresse par défaut est CANONIQUE pour sa chaîne : la sixième condition
 * refuse une adresse mal formée, et un fixture bâclé (`0x0`) ferait échouer
 * les cas nominaux pour la mauvaise raison.
 */
const ADDR_CANONIQUE: Record<string, string> = {
  ETH: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  BASE: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  BSC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  ARBITRUM: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  SOL: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  TRON: "TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz",
  HYPER: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
};
const res = (o: {
  status: string;
  callerSupport: string;
  chain?: CanonicalChain | null;
  address?: string | null;
}) =>
  ({
    status: o.status,
    callerSupport: o.callerSupport,
    selected:
      o.chain === undefined || o.chain === null
        ? null
        : {
            chain: o.chain,
            address: o.address === undefined ? ADDR_CANONIQUE[o.chain] : o.address,
          },
  }) as Parameters<typeof isCanonicallyAttested>[0];

// ═══ LE PRÉDICAT — les trois conditions, ENSEMBLE ════════════════════════

describe("AL/0 — le prédicat d'attestation", () => {
  it("atteste quand les TROIS conditions sont réunies", () => {
    expect(
      isCanonicallyAttested(
        res({ status: "RESOLVED", callerSupport: "supported", chain: "ETH" }),
        PREBUY_EVM_CHAINS,
      ),
    ).toBe(true);
  });

  it("MUTANT CENTRAL — `status` seul n'atteste PAS", () => {
    // Le cas mesuré : mint SOLANA d'USDC, indice ETH → RESOLVED, mais
    // `unsupported_by_caller` et `selected.chain: "SOL"`. Un adaptateur qui
    // lirait `status` seul attesterait une identité EVM pour une adresse
    // Solana — la substitution d'identité, servie par une lecture naïve.
    const piege = res({
      status: "RESOLVED",
      callerSupport: "unsupported_by_caller",
      chain: "SOL",
    });
    expect(isCanonicallyAttested(piege, PREBUY_EVM_CHAINS)).toBe(false);
    // Et il échoue pour DEUX raisons indépendantes, pas une.
    expect(
      isCanonicallyAttested(
        res({ status: "RESOLVED", callerSupport: "supported", chain: "SOL" }),
        PREBUY_EVM_CHAINS,
      ),
    ).toBe(false);
    expect(
      isCanonicallyAttested(
        res({ status: "RESOLVED", callerSupport: "unsupported_by_caller", chain: "ETH" }),
        PREBUY_EVM_CHAINS,
      ),
    ).toBe(false);
  });

  it("MUTANT — une chaîne HORS périmètre n'atteste pas", () => {
    for (const hors of ["SOL", "TRON", "HYPER"] as CanonicalChain[]) {
      expect(
        isCanonicallyAttested(
          res({ status: "RESOLVED", callerSupport: "supported", chain: hors }),
          PREBUY_EVM_CHAINS,
        ),
        hors,
      ).toBe(false);
    }
  });

  it("MUTANT — un statut non RESOLVED n'atteste pas, quel qu'il soit", () => {
    for (const s of ["AMBIGUOUS", "UNRESOLVED", "CONFLICT"]) {
      expect(
        isCanonicallyAttested(
          res({ status: s, callerSupport: "supported", chain: "ETH" }),
          PREBUY_EVM_CHAINS,
        ),
        s,
      ).toBe(false);
    }
  });

  it("MUTANT — `selected` ABSENT n'atteste pas, quatrième condition", () => {
    expect(
      isCanonicallyAttested(
        res({ status: "RESOLVED", callerSupport: "supported", chain: null }),
        PREBUY_EVM_CHAINS,
      ),
    ).toBe(false);
    // Et une sélection SANS ADRESSE non plus : une chaîne seule n'est pas une
    // identité. C'est le cas que la lecture `selected?.chain` laissait passer.
    const sansAdresse = evaluateCanonicalAttestation(
      res({ status: "RESOLVED", callerSupport: "supported", chain: "ETH", address: null }),
      PREBUY_EVM_CHAINS,
    );
    expect(sansAdresse.attested).toBe(false);
    expect(sansAdresse).toMatchObject({ refusal: "NO_SELECTION" });
  });

  it("MUTANT — une adresse NON CANONIQUE sur une chaîne AUTORISÉE n'atteste pas", () => {
    // La sixième condition, et la plus fine : le périmètre est bon, l'identité
    // ne l'est pas. Une adresse Solana « sélectionnée sur ETH », un hex trop
    // court, une chaîne vide — la chaîne est autorisée à chaque fois.
    for (const mauvaise of [
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // base58 Solana
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb4", // 39 hex
      "0xZZb86991c6218b36c1d19d4a2e9eb0ce3606eb48", // hors alphabet hex
      "0x0",
      "   ",
    ]) {
      const r = evaluateCanonicalAttestation(
        res({ status: "RESOLVED", callerSupport: "supported", chain: "ETH", address: mauvaise }),
        PREBUY_EVM_CHAINS,
      );
      expect(r.attested, mauvaise).toBe(false);
    }
  });

  it("l'adresse rendue est la forme CANONIQUE, pas celle qu'on a passée", () => {
    // Casse EVM : le module normalise en minuscules. Rendre l'entrée
    // masquerait la normalisation.
    const r = evaluateCanonicalAttestation(
      res({
        status: "RESOLVED",
        callerSupport: "supported",
        chain: "ETH",
        address: "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48",
      }),
      PREBUY_EVM_CHAINS,
    );
    expect(r).toEqual({
      attested: true,
      chain: "ETH",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    });
  });

  it("MUTANT — le prédicat booléen est une VUE, pas une seconde copie", () => {
    // On vient de payer ce défaut : le prédicat écrit deux fois laissait
    // survivre un mutant. Les deux vues doivent s'accorder sur TOUS les cas.
    const cas = [
      res({ status: "RESOLVED", callerSupport: "supported", chain: "ETH" }),
      res({ status: "RESOLVED", callerSupport: "supported", chain: "SOL" }),
      res({ status: "RESOLVED", callerSupport: "unsupported_by_caller", chain: "ETH" }),
      res({ status: "UNRESOLVED", callerSupport: "supported", chain: "ETH" }),
      res({ status: "RESOLVED", callerSupport: "supported", chain: null }),
      res({ status: "RESOLVED", callerSupport: "supported", chain: "ETH", address: "0x0" }),
    ];
    for (const c of cas) {
      expect(isCanonicallyAttested(c, PREBUY_EVM_CHAINS)).toBe(
        evaluateCanonicalAttestation(c, PREBUY_EVM_CHAINS).attested,
      );
    }
    // Et la source ne contient qu'UNE implémentation de la table.
    const code = codeSeul(SRC_ADAPT);
    expect(code.match(/status !== "RESOLVED"/g) ?? []).toHaveLength(1);
    expect(code.match(/callerSupport !== "supported"/g) ?? []).toHaveLength(1);
    expect(code.match(/allowedChains\.includes/g) ?? []).toHaveLength(1);
    expect(code.match(/normalizeAddress\(/g) ?? []).toHaveLength(1);
  });

  it("aucune sélection → pas d'attestation", () => {
    expect(
      isCanonicallyAttested(
        res({ status: "RESOLVED", callerSupport: "supported", chain: null }),
        PREBUY_EVM_CHAINS,
      ),
    ).toBe(false);
  });

  it("SUR-CORRECTION — les quatre chaînes du périmètre attestent bien", () => {
    // Sans ceci, un adaptateur qui refuserait tout passerait tous les autres
    // critères. Refuser toujours ne vaut pas mieux qu'attester toujours.
    for (const c of PREBUY_EVM_CHAINS) {
      expect(
        isCanonicallyAttested(
          res({ status: "RESOLVED", callerSupport: "supported", chain: c }),
          PREBUY_EVM_CHAINS,
        ),
        c,
      ).toBe(true);
    }
  });

  it("`confidence` n'est PAS lu — aucun seuil n'est introduit", () => {
    // Preuve LEXICALE, et voici pourquoi le comportement ne suffit pas : le
    // prédicat ne reçoit pas `confidence`, donc aucune exécution ne peut
    // démontrer qu'il ne s'en sert pas. Ce qui se démontre, c'est que le mot
    // n'apparaît pas dans le code exécutable.
    const code = codeSeul(SRC_ADAPT);
    expect(code).not.toContain("confidence");
    expect(code).not.toMatch(/HIGH|MODERATE|LOW/);
  });
});

// ═══ FAIL CLOSED — le résolveur LÈVE, l'adaptateur absorbe ═══════════════

vi.mock("@/lib/token-resolution/v3", async (orig) => {
  const reel = await orig<typeof import("@/lib/token-resolution/v3")>();
  return { ...reel, resolveToken: vi.fn() };
});
vi.mock("@/lib/token-resolution/v3/providersPublic", async (orig) => {
  const reel = await orig<typeof import("@/lib/token-resolution/v3/providersPublic")>();
  return { ...reel, createProviderContext: vi.fn(reel.createProviderContext) };
});

import { resolveToken } from "@/lib/token-resolution/v3";
import { resolveToken as reelResolveToken } from "@/lib/token-resolution/v3/resolve";
import { createProviderContext } from "@/lib/token-resolution/v3/providersPublic";
import { createProviderContext as reelCreateProviderContext } from "@/lib/token-resolution/v3/providers";
import type { HttpClient } from "@/lib/token-resolution/v3/providers/types";
import { probeCanonicalTokenIdentity } from "@/lib/prebuy/canonicalTokenIdentity";
const mockResolve = vi.mocked(resolveToken);
const mockContext = vi.mocked(createProviderContext);

const resolution = (o: {
  status: string;
  callerSupport: string;
  chain?: CanonicalChain | null;
}) =>
  ({
    status: o.status,
    confidence: "HIGH",
    method: "explicit_ca",
    callerSupport: o.callerSupport,
    selected: o.chain ? { chain: o.chain, address: FIXTURES.usdcEth, symbol: "USDC" } : null,
    candidates: [],
    excluded: [],
    conflicts: [],
    limitations: [],
    telemetry: {},
    audience: "public",
  }) as unknown as Awaited<ReturnType<typeof resolveToken>>;

describe("AL/1 — fail closed, et il est DANS l'adaptateur", () => {
  beforeEach(() => {
    mockResolve.mockReset();
    mockContext.mockReset();
    mockContext.mockImplementation(() => reelCreateProviderContext());
  });

  it("MUTANT — une panne provider RÉELLE est absorbée, pas propagée", async () => {
    // ─── Pourquoi ce test n'utilise PAS le mock de `resolveToken` ─────────
    //
    // Mesuré : dans ce harnais, vitest impute au test TOUTE erreur issue d'une
    // fonction mockée — `mockRejectedValue`, throw synchrone et rejet d'objet
    // compris — que le code jugé l'absorbe ou non. Le piège avait déjà fait
    // basculer une preuve de T2 vers une lecture de source.
    //
    // On change donc de couture : le VRAI `resolveToken` tourne, avec un
    // client HTTP réel dont `getJson` lève. L'exception naît dans le
    // résolveur, exactement comme en production. C'est une preuve plus forte
    // que celle qu'on cherchait : elle démontre à la fois que `resolveToken`
    // LÈVE et que l'adaptateur absorbe.
    mockResolve.mockImplementation(reelResolveToken);
    const httpQuiLeve: HttpClient = {
      getJson: async () => {
        throw new Error("DexScreener 503");
      },
      postJson: async () => {
        throw new Error("DexScreener 503");
      },
    };
    mockContext.mockImplementation(() => reelCreateProviderContext({ http: httpQuiLeve }));

    const r = await probeCanonicalTokenIdentity({
      address: FIXTURES.usdcEth,
      chainHint: "ETH",
      allowedChains: PREBUY_EVM_CHAINS,
    });
    expect(r.attested).toBe(false);
    expect(r.refusal).toBe("RESOLVER_FAILURE");
    expect(r.detail).toContain("DexScreener 503");
  });

  it("MUTANT — un non-résolu ne produit AUCUN repli permissif", async () => {
    mockResolve.mockResolvedValue(resolution({ status: "UNRESOLVED", callerSupport: "supported" }));
    const r = await probeCanonicalTokenIdentity({
      address: FIXTURES.usdcEth,
      allowedChains: PREBUY_EVM_CHAINS,
    });
    expect(r.attested).toBe(false);
    expect(r.refusal).toBe("NOT_RESOLVED");
    expect(r.chain).toBeNull();
  });

  it("MUTANT — le piège Solana bout en bout : RESOLVED mais jamais attesté", async () => {
    mockResolve.mockResolvedValue(
      resolution({ status: "RESOLVED", callerSupport: "unsupported_by_caller", chain: "SOL" }),
    );
    const r = await probeCanonicalTokenIdentity({
      address: FIXTURES.usdcSol,
      chainHint: "ETH",
      allowedChains: PREBUY_EVM_CHAINS,
    });
    expect(r.attested).toBe(false);
    expect(r.refusal).toBe("UNSUPPORTED_BY_CALLER");
  });

  it("un périmètre VIDE n'atteste rien, et n'appelle même pas le résolveur", async () => {
    const r = await probeCanonicalTokenIdentity({ address: FIXTURES.usdcEth, allowedChains: [] });
    expect(r.attested).toBe(false);
    expect(r.refusal).toBe("CHAIN_OUT_OF_SCOPE");
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("SUR-CORRECTION — une identité légitime EST attestée", async () => {
    mockResolve.mockResolvedValue(
      resolution({ status: "RESOLVED", callerSupport: "supported", chain: "ETH" }),
    );
    const r = await probeCanonicalTokenIdentity({
      address: FIXTURES.usdcEth,
      chainHint: "ETH",
      allowedChains: PREBUY_EVM_CHAINS,
    });
    expect(r.attested).toBe(true);
    expect(r.chain).toBe("ETH");
    expect(r.refusal).toBeNull();
  });

  it("le SYMBOLE n'est jamais passé au résolveur", async () => {
    mockResolve.mockResolvedValue(
      resolution({ status: "RESOLVED", callerSupport: "supported", chain: "ETH" }),
    );
    await probeCanonicalTokenIdentity({
      address: FIXTURES.usdtEth,
      allowedChains: PREBUY_EVM_CHAINS,
    });
    const req = mockResolve.mock.calls[0][0];
    expect(req.ticker).toBeUndefined();
    expect(req.rawText).toBeUndefined();
    expect(req.addresses).toEqual([FIXTURES.usdtEth]);
  });

  it("un chainHint fourni est TRANSMIS — on sonde cette chaîne d'abord", async () => {
    mockResolve.mockResolvedValue(
      resolution({ status: "RESOLVED", callerSupport: "supported", chain: "BASE" }),
    );
    await probeCanonicalTokenIdentity({
      address: FIXTURES.usdcEth,
      chainHint: "BASE",
      allowedChains: PREBUY_EVM_CHAINS,
    });
    expect(mockResolve.mock.calls[0][0].chainHint).toBe("BASE");
  });
});

// ═══ LE CONTRAT D'IDENTITÉ — une valeur, et une seule ════════════════════

const SRC_ADAPT = readFileSync(
  join(__dirname, "..", "..", "src/lib/prebuy/canonicalTokenIdentity.ts"),
  "utf8",
);
const SRC_IDENT = readFileSync(
  join(__dirname, "..", "..", "src/lib/prebuy/identity.ts"),
  "utf8",
);
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
}

describe("AL/2 — le contrat n'a gagné qu'une valeur", () => {
  it("`canonical_token_resolution` est ajoutée, et rien d'autre", () => {
    expect(IDENTITY_AUTHORITIES).toEqual([
      "onchain_mint_account",
      "casefile",
      "knownBad",
      "market_pair",
      "intelligence_match",
      "canonical_token_resolution",
    ]);
  });

  it("elle fait autorité comme les autres, ni plus ni moins", () => {
    expect(
      resolveTokenIdentity({
        syntacticallyValid: true,
        attestations: [{ source: "canonical_token_resolution", attests: true }],
      }),
    ).toEqual({ resolved: true, authorities: ["canonical_token_resolution"] });
    expect(
      resolveTokenIdentity({
        syntacticallyValid: true,
        attestations: [{ source: "canonical_token_resolution", attests: false }],
      }).resolved,
    ).toBe(false);
    // Et une forme invalide reste refusée en premier.
    expect(
      resolveTokenIdentity({
        syntacticallyValid: false,
        attestations: [{ source: "canonical_token_resolution", attests: true }],
      }),
    ).toEqual({ resolved: false, reason: "SYNTAX" });
  });

  it("aucune adresse n'est codée en dur dans le code livré", () => {
    for (const src of [SRC_ADAPT, SRC_IDENT]) {
      const code = codeSeul(src);
      expect(code).not.toMatch(/0x[a-fA-F0-9]{40}/);
      expect(code).not.toMatch(/\bUSDC\b|\bUSDT\b/);
      expect(code).not.toMatch(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    }
  });

  it("aucune logique de résolution parallèle — l'adaptateur DÉLÈGUE", () => {
    const code = codeSeul(SRC_ADAPT);
    expect(code).toContain("resolveToken(");
    // Pas de provider appelé en direct, pas de fetch, pas de cache.
    expect(code).not.toContain("fetch(");
    expect(code).not.toContain("dexScreener");
    expect(code).not.toMatch(/\bcache\b/i);
  });

  it("le périmètre EVM est celui qui existait, pas une extension", () => {
    expect([...PREBUY_EVM_CHAINS]).toEqual(["ETH", "BASE", "BSC", "ARBITRUM"]);
  });
});
