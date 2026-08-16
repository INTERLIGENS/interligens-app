// __tests__/security/data-degradation.test.ts
//
// P0 — LES CONCLUSIONS SILENCIEUSEMENT FAUSSES.
//
//     UNKNOWN ≠ SAFE · NO DATA ≠ NO RISK · LOOKUP FAILED ≠ CLEAN
//     RPC DOWN ≠ HIGH CONFIDENCE
//
// Trois défauts, tous de la même famille : une source muette faisait
// DISPARAÎTRE un facteur de risque au lieu de faire baisser la confiance. Le
// score sortait plus bas, et rien dans la réponse ne le disait.
//
//   1. `adapter.ts` recevait `rpc_down` / `rpc_fallback_used` et ne les
//      transmettait pas au moteur ; `computeConfidenceLevel` (« RPC down →
//      Low, always ») avait zéro appelant.
//   2. Un échec de consultation du renseignement rendait exactement la même
//      chose qu'une adresse propre — le plancher OFAC de 15 disparaissait.
//   3. `public-api.solscan.io` rend 404 : `top10_holder_pct` valait toujours
//      `null`, donc `holders_concentrated_80/60` ne se déclenchaient jamais.
//
// Invariant transversal vérifié ici : la dégradation touche la CONFIANCE,
// jamais le SCORE. Une panne de fournisseur n'est pas un indice de danger.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { computeTigerScore, buildDataQuality, hasDegradedInputs } from "@/lib/tigerscore/engine";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { computeConfidenceLevel } from "@/lib/tigerscore/confidence";

// Adresse dont le suffixe déclenche `pump_fun` (+30). Ce driver ne consulte
// AUCUN fournisseur : c'est exactement le scan qui rendait « Medium » alors que
// rien n'avait pu être vérifié.
const PUMP_MINT = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApump";
const SOL_TOKEN = { chain: "SOL", scan_type: "token", no_casefile: true, mint_address: PUMP_MINT } as const;

// ═══════════════════════════════════════════════════════════════════════════
// 1. RPC INDISPONIBLE → CONFIANCE DÉGRADÉE
// ═══════════════════════════════════════════════════════════════════════════

describe("1. RPC indisponible dégrade la confiance affichée", () => {
  it("le module durci était mort — il est rebranché", () => {
    // La règle qui manquait, prouvée sur la fonction elle-même.
    expect(computeConfidenceLevel({ drivers: [], rpcDown: true })).toBe("Low");
    expect(
      computeConfidenceLevel({
        drivers: [
          { id: "a", label: "", severity: "critical", delta: 70, why: "" },
          { id: "b", label: "", severity: "high", delta: 35, why: "" },
        ],
        rpcDown: true,
      }),
    ).toBe("Low");
  });

  it("données complètes : comportement INCHANGÉ (aucune régression)", () => {
    const r = computeTigerScoreFromScan({ ...SOL_TOKEN });
    expect(r.confidence).toBe("Medium");
    expect(r.dataQuality.degraded).toBe(false);
    expect(r.dataQuality.missing).toEqual([]);
  });

  it("RPC mort : Medium → Low", () => {
    const sain = computeTigerScoreFromScan({ ...SOL_TOKEN });
    const mort = computeTigerScoreFromScan({ ...SOL_TOKEN, rpc_down: true });
    expect(sain.confidence).toBe("Medium");
    expect(mort.confidence).toBe("Low");
  });

  // L'invariant qui empêche la sur-correction : dégrader la confiance ne doit
  // pas gonfler le score. Une panne n'est pas un risque, c'est une ignorance.
  it("le SCORE est identique avec et sans panne", () => {
    const sain = computeTigerScoreFromScan({ ...SOL_TOKEN });
    const mort = computeTigerScoreFromScan({ ...SOL_TOKEN, rpc_down: true });
    expect(mort.score).toBe(sain.score);
    expect(mort.tier).toBe(sain.tier);
    expect(mort.drivers.map((d) => d.id)).toEqual(sain.drivers.map((d) => d.id));
  });

  it("la sortie NOMME la source manquante et les signaux inévaluables", () => {
    const r = computeTigerScoreFromScan({ ...SOL_TOKEN, rpc_down: true });
    expect(r.dataQuality.degraded).toBe(true);
    expect(r.dataQuality.missing).toContain("rpc");
    expect(r.dataQuality.unevaluatedSignals).toContain("freeze_authority");
    expect(r.dataQuality.unevaluatedSignals).toContain("mint_authority");
  });

  it("un repli RPC est signalé sans être traité comme une panne totale", () => {
    const r = computeTigerScoreFromScan({ ...SOL_TOKEN, rpc_fallback_used: true });
    expect(r.dataQuality.degraded).toBe(true);
    expect(r.dataQuality.missing).toEqual(["rpc_primary"]);
    expect(r.dataQuality.missing).not.toContain("rpc");
  });

  it("la dégradation ne peut JAMAIS remonter la confiance", () => {
    // deep=true rendrait « High » ; la panne doit l'emporter.
    const r = computeTigerScoreFromScan({ ...SOL_TOKEN, deep: true, rpc_down: true });
    expect(r.confidence).toBe("Low");
  });

  it("hasDegradedInputs couvre les quatre drapeaux", () => {
    expect(hasDegradedInputs({ chain: "SOL" })).toBe(false);
    for (const flag of [
      "rpc_down",
      "rpc_fallback_used",
      "intelligence_lookup_failed",
      "holders_unavailable",
    ] as const) {
      expect(hasDegradedInputs({ chain: "SOL", [flag]: true })).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ÉCHEC DE CONSULTATION ≠ ADRESSE PROPRE
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/intelligence", () => ({
  lookupValue: vi.fn(),
}));

describe("2. un échec de lookup ne produit jamais CLEAN", () => {
  const ADDR = "0x0000000000000000000000000000000000000001";
  const EVM = { chain: "ETH", evm_is_contract: false, evm_known_bad: false } as const;

  beforeEach(() => vi.clearAllMocks());

  async function run(impl: () => Promise<unknown>) {
    const { lookupValue } = await import("@/lib/intelligence");
    (lookupValue as unknown as ReturnType<typeof vi.fn>).mockImplementation(impl);
    const { computeTigerScoreWithIntel } = await import("@/lib/tigerscore/engine");
    return computeTigerScoreWithIntel(EVM, ADDR);
  }

  it("consultation aboutie sans correspondance → NO_MATCH, non dégradé", async () => {
    const r = await run(async () => ({ matchCount: 0, sources: [] }));
    expect(r.intelligenceStatus).toBe("NO_MATCH");
    expect(r.dataQuality.degraded).toBe(false);
    expect(r.dataQuality.missing).not.toContain("intelligence");
  });

  it("consultation EN ÉCHEC → UNKNOWN, jamais NO_MATCH", async () => {
    const r = await run(async () => {
      throw new Error("intelligence DB unreachable");
    });
    expect(r.intelligenceStatus).toBe("UNKNOWN");
    expect(r.intelligenceStatus).not.toBe("NO_MATCH");
  });

  // Le défaut central : avant ce lot, les deux cas rendaient `intelligence:
  // null` et un score identique. Ils étaient littéralement indiscernables.
  it("les deux cas sont DISTINGUABLES par le consommateur", async () => {
    const clean = await run(async () => ({ matchCount: 0, sources: [] }));
    const broken = await run(async () => {
      throw new Error("down");
    });
    expect(clean.intelligenceStatus).not.toBe(broken.intelligenceStatus);
    expect(clean.dataQuality.degraded).not.toBe(broken.dataQuality.degraded);
  });

  it("l'échec dégrade la confiance et nomme le plancher non appliqué", async () => {
    const r = await run(async () => {
      throw new Error("down");
    });
    expect(r.confidence).toBe("Low");
    expect(r.dataQuality.missing).toContain("intelligence");
    // Un match OFAC impose un plancher de 15. On ne sait pas s'il aurait dû
    // s'appliquer — on le DIT, au lieu de servir le score comme s'il était sûr.
    expect(r.dataQuality.unevaluatedSignals).toContain("sanctions_floor");
  });

  it("l'échec ne gonfle pas le score — on n'invente pas un risque", async () => {
    const base = computeTigerScore(EVM);
    const r = await run(async () => {
      throw new Error("down");
    });
    expect(r.finalScore).toBe(base.score);
    expect(r.score).toBe(base.score);
  });

  it("une correspondance réelle reste MATCHED et applique l'overlay", async () => {
    const r = await run(async () => ({
      matchCount: 2,
      sources: ["ofac", "scamsniffer"],
      hasSanction: true,
      riskClass: "SANCTIONED",
      entries: [],
    }));
    expect(r.intelligenceStatus).toBe("MATCHED");
    expect(r.dataQuality.degraded).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CONCENTRATION DES DÉTENTEURS — la source morte ET l'indisponibilité
// ═══════════════════════════════════════════════════════════════════════════

describe("3. concentration des détenteurs", () => {
  it("la source morte n'est plus interrogée nulle part", () => {
    // public-api.solscan.io — HTTP 404 vérifié le 2026-08-16. Deux appelants
    // l'utilisaient : /api/v1/score et /api/solana/holders.
    for (const f of [
      join("src", "app", "api", "v1", "score", "route.ts"),
      join("src", "app", "api", "solana", "holders", "route.ts"),
    ]) {
      const src = readFileSync(join(__dirname, "..", "..", f), "utf8");
      const code = src.replace(/\/\/[^\n]*/g, "");
      expect(code).not.toContain("public-api.solscan.io");
    }
  });

  it("le seuil se déclenche réellement sur un token concentré", () => {
    // Mesure réelle du 2026-08-16 sur GHOST (dossier INTERLIGENS) : 93,5 %.
    // Avant ce lot, solscan rendant 404, ce token était noté comme distribué.
    const concentre = computeTigerScore({ ...SOL_TOKEN, top10_holder_pct: 93.5 });
    const ids = concentre.drivers.map((d) => d.id);
    expect(ids).toContain("holders_concentrated_80");

    const distribue = computeTigerScore({ ...SOL_TOKEN, top10_holder_pct: 12 });
    expect(distribue.drivers.map((d) => d.id)).not.toContain("holders_concentrated_80");
    expect(distribue.drivers.map((d) => d.id)).not.toContain("holders_concentrated_60");

    // Le token concentré doit sortir STRICTEMENT plus haut.
    expect(concentre.score).toBeGreaterThan(distribue.score);
  });

  it.each([
    [95, "holders_concentrated_80"],
    [85, "holders_concentrated_80"],
    [70, "holders_concentrated_60"],
    [61, "holders_concentrated_60"],
  ])("top10 = %s %% déclenche %s", (pct, expected) => {
    const ids = computeTigerScore({ ...SOL_TOKEN, top10_holder_pct: pct }).drivers.map((d) => d.id);
    expect(ids).toContain(expected);
  });

  // La seconde moitié du correctif : la source retombera un jour.
  it("indisponible ≠ non concentré — la confiance tombe et la source est nommée", () => {
    const inconnu = computeTigerScore({ ...SOL_TOKEN, holders_unavailable: true });
    expect(inconnu.confidence).toBe("Low");
    expect(inconnu.dataQuality.missing).toContain("holders");
    expect(inconnu.dataQuality.unevaluatedSignals).toContain("holders_concentrated_80");
    expect(inconnu.dataQuality.unevaluatedSignals).toContain("cluster_risk");
  });

  it("indisponible et distribué produisent le même score mais PAS la même sortie", () => {
    const inconnu = computeTigerScore({ ...SOL_TOKEN, holders_unavailable: true });
    const distribue = computeTigerScore({ ...SOL_TOKEN, top10_holder_pct: 12 });
    // Même score : l'absence de donnée n'invente pas de risque…
    expect(inconnu.score).toBe(distribue.score);
    // …mais le consommateur peut désormais les distinguer.
    expect(inconnu.dataQuality.degraded).toBe(true);
    expect(distribue.dataQuality.degraded).toBe(false);
    expect(inconnu.confidence).not.toBe(distribue.confidence);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. MUTATION TESTING
// ═══════════════════════════════════════════════════════════════════════════

describe("mutation testing — chaque garde a son tueur", () => {
  it("MUTANT 1 — l'adaptateur oublie de nouveau de transmettre rpc_down", () => {
    const adapter = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "tigerscore", "adapter.ts"),
      "utf8",
    );
    // Le défaut d'origine : ScanNormalized déclarait les drapeaux, ils partaient
    // vers buildOnChainEvidence (l'affichage) et jamais vers TigerInput.
    const tigerInputBlock = adapter.slice(
      adapter.indexOf("const tigerInput: TigerInput"),
      adapter.indexOf("const tigerResult"),
    );
    expect(tigerInputBlock).toContain("rpc_down: input.rpc_down");
    expect(tigerInputBlock).toContain("holders_unavailable: input.holders_unavailable");
    expect(tigerInputBlock).toContain("intelligence_lookup_failed: input.intelligence_lookup_failed");
    // Preuve comportementale, pas seulement textuelle :
    expect(computeTigerScoreFromScan({ ...SOL_TOKEN, rpc_down: true }).confidence).toBe("Low");
  });

  it("MUTANT 2 — la confiance revient à l'heuristique par comptage de drivers", () => {
    const mutant = (drivers: unknown[], deep?: boolean) =>
      drivers.length === 0 ? "Low" : deep ? "High" : "Medium";
    const r = computeTigerScoreFromScan({ ...SOL_TOKEN, rpc_down: true });
    // Le mutant rendrait Medium sur un scan où rien n'a pu être vérifié.
    expect(mutant(r.drivers)).toBe("Medium");
    expect(r.confidence).toBe("Low");
  });

  it("MUTANT 3 — la dégradation gonfle le score au lieu de la confiance", () => {
    const sain = computeTigerScore({ ...SOL_TOKEN });
    for (const flag of ["rpc_down", "holders_unavailable", "intelligence_lookup_failed"] as const) {
      const degrade = computeTigerScore({ ...SOL_TOKEN, [flag]: true });
      expect(degrade.score).toBe(sain.score);
    }
  });

  it("MUTANT 4 — l'échec de lookup redevient indiscernable de NO_MATCH", async () => {
    const engine = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "tigerscore", "engine.ts"),
      "utf8",
    );
    // Le catch doit produire UNKNOWN et recalculer avec le drapeau.
    const catchBlock = engine.slice(engine.lastIndexOf("} catch (err) {"));
    expect(catchBlock).toContain('intelligenceStatus: "UNKNOWN"');
    expect(catchBlock).toContain("intelligence_lookup_failed: true");
    expect(catchBlock).not.toContain('intelligenceStatus: "NO_MATCH"');
  });

  it("MUTANT 5 — dataQuality disparaît de la sortie", () => {
    // Sans ce bloc, « aucun risque détecté » et « rien n'a pu être vérifié »
    // redeviennent la même réponse.
    const r = computeTigerScore({ ...SOL_TOKEN, holders_unavailable: true });
    expect(r).toHaveProperty("dataQuality");
    expect(r.dataQuality).toEqual({
      degraded: true,
      missing: ["holders"],
      unevaluatedSignals: ["holders_concentrated_80", "holders_concentrated_60", "cluster_risk"],
    });
  });

  it("MUTANT 6 — le module de concentration rend 0 au lieu d'un refus", async () => {
    const mod = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "token", "holderConcentration.ts"),
      "utf8",
    );
    // Un `top10Pct: 0` sur échec ferait passer une panne pour une répartition
    // parfaite. Le type discriminé rend ce mutant impossible à écrire : aucune
    // sortie du module n'est un nombre nu.
    expect(mod).toContain("available: false");
    expect(mod).not.toMatch(/top10Pct:\s*0\b/);
    // Et res.ok est vérifié AVANT de lire .result — un 429 ne doit pas passer
    // pour « ce token n'a aucun détenteur » (le défaut de proceeds.ts:38-47).
    expect(mod).toContain("if (!res.ok) throw new Error");

    // Preuve comportementale : une entrée invalide refuse, elle ne mesure pas.
    const { fetchTop10HolderPct } = await import("@/lib/token/holderConcentration");
    const r = await fetchTop10HolderPct("");
    expect(r.available).toBe(false);
    expect(r).not.toHaveProperty("top10Pct");
  });

  it("MUTANT 7 — /api/solana/holders rend de nouveau ok:true sur une panne", () => {
    const route = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "solana", "holders", "route.ts"),
      "utf8",
    );
    const failureBlock = route.slice(route.indexOf("if (!holders.available)"));
    expect(failureBlock).toContain("ok: false");
    expect(failureBlock.slice(0, failureBlock.indexOf("}"))).not.toContain("ok: true");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. buildDataQuality — la nomenclature
// ═══════════════════════════════════════════════════════════════════════════

describe("buildDataQuality", () => {
  it("ne signale rien quand tout a répondu", () => {
    expect(buildDataQuality({ chain: "SOL" })).toEqual({
      degraded: false,
      missing: [],
      unevaluatedSignals: [],
    });
  });

  it("cumule les sources manquantes", () => {
    const q = buildDataQuality({
      chain: "SOL",
      rpc_down: true,
      holders_unavailable: true,
      intelligence_lookup_failed: true,
    });
    expect(q.degraded).toBe(true);
    expect(q.missing.sort()).toEqual(["holders", "intelligence", "rpc"]);
  });

  it("une panne totale du RPC prime sur le simple repli", () => {
    const q = buildDataQuality({ chain: "SOL", rpc_down: true, rpc_fallback_used: true });
    expect(q.missing).toContain("rpc");
    expect(q.missing).not.toContain("rpc_primary");
  });
});
