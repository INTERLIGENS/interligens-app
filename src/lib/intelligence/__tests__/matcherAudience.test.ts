// ─── AM · P0 — LE MATCHER APPLIQUE-T-IL RÉELLEMENT L'ADMISSIBILITÉ ? ───────
//
// ██  Preuve COMPORTEMENTALE de bout en bout sur `matchEntity`.            ██
//
// Pourquoi ce fichier existe : la batterie de `__tests__/intelligence/` juge
// `admitObservations` en isolation, et les tests de cohérence existants
// n'utilisent que des sources admissibles — donc leurs observations sont
// TOUTES retenues.
//
// Résultat : un mutant qui faisait agréger `entity.observations` au lieu de
// `retained` SURVIVAIT. La gate pouvait être contournée sans qu'aucun test ne
// rougisse. C'était une preuve manquante, pas un détail.
//
// Ces tests vérifient donc la seule chose qui compte vraiment : ce qui a été
// écarté n'entre dans AUCUN calcul — ni `matchCount`, ni `hasSanction`, ni
// `topRiskClass`, ni le vainqueur.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    canonicalEntity: { findUnique: vi.fn() },
    sourceRegistry: { findMany: vi.fn() },
  },
}));

import { matchEntity, lookupValue } from "../matcher";
import { prisma } from "@/lib/prisma";

const mockEntity = prisma.canonicalEntity.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockRegistry = prisma.sourceRegistry.findMany as unknown as ReturnType<typeof vi.fn>;

/** Le registre au 2026-09-09, réduit. `chainalysis` y est `internal_only`. */
const REGISTRE = [
  { handle: "ofac", status: "active", defaultVisibility: "public" },
  { handle: "forta", status: "active", defaultVisibility: "public" },
  { handle: "chainalysis", status: "active", defaultVisibility: "internal_only" },
];

const obsOfac = {
  id: "o-ofac",
  sourceSlug: "ofac",
  sourceTier: 1,
  riskClass: "SANCTION",
  matchBasis: "EXACT_ADDRESS",
  listIsActive: true,
  externalUrl: "https://sanctionssearch.ofac.treas.gov/",
  observedAt: null,
  ingestedAt: new Date("2026-08-25T01:03:16Z"),
};

const obsChainalysis = {
  id: "o-chainalysis",
  sourceSlug: "chainalysis",
  sourceTier: 2,
  riskClass: "HIGH",
  matchBasis: "INFERRED_LINKAGE",
  listIsActive: true,
  externalUrl: null,
  observedAt: null,
  ingestedAt: new Date("2026-08-25T01:03:16Z"),
};

function entite(
  displaySafety: string,
  observations: unknown[],
  isActive = true,
) {
  return {
    id: "e1",
    type: "ADDRESS",
    value: "0xdead",
    riskClass: "HIGH",
    isActive,
    displaySafety,
    observations,
  };
}

beforeEach(() => {
  mockEntity.mockReset();
  mockRegistry.mockReset();
  mockRegistry.mockResolvedValue(REGISTRE);
});

describe("AM — l'écarté n'entre dans AUCUN calcul", () => {
  it("MUTANT — une observation refusée est absente de matchCount et du vainqueur", async () => {
    // Entité INTERNAL_ONLY, deux observations : `ofac` (source publiable) et
    // `chainalysis` (source `internal_only` au registre). Seule la première
    // porte une autorité retail.
    //
    // C'est LE test qui tue le mutant « agréger entity.observations au lieu de
    // retained » : si la gate est contournée, matchCount vaut 2.
    mockEntity.mockResolvedValue(entite("INTERNAL_ONLY", [obsOfac, obsChainalysis]));
    const signal = await matchEntity({ type: "ADDRESS", value: "0xdead" }, "RETAIL");
    expect(signal.matchCount).toBe(1);
    expect(signal.sourceSlug).toBe("ofac");
    expect(signal.hasSanction).toBe(true);
  });

  it("MUTANT — l'inverse : la seule observation admissible est la NON-sanction", async () => {
    // Le contrôle symétrique. Si la gate était contournée, `hasSanction`
    // ressortirait `true` alors qu'aucune contribution admissible ne le porte
    // — une sanction publiée que rien d'autorisé ne soutient.
    const ofacNonPubliable = [{ handle: "ofac", status: "retired", defaultVisibility: "public" },
                              { handle: "forta", status: "active", defaultVisibility: "public" }];
    mockRegistry.mockResolvedValue(ofacNonPubliable);
    mockEntity.mockResolvedValue(
      entite("INTERNAL_ONLY", [obsOfac, { ...obsChainalysis, sourceSlug: "forta" }]),
    );
    const signal = await matchEntity({ type: "ADDRESS", value: "0xdead" }, "RETAIL");
    expect(signal.matchCount).toBe(1);
    expect(signal.hasSanction).toBe(false);
    expect(signal.sourceSlug).toBe("forta");
  });

  it("aucune contribution admissible → signal VIDE, comme une entité inconnue", async () => {
    // Le scoreur reçoit exactement la même chose que pour un inconnu : il n'a
    // rien à corriger, parce qu'il n'a rien reçu.
    mockEntity.mockResolvedValue(entite("INTERNAL_ONLY", [obsChainalysis]));
    const signal = await matchEntity({ type: "ADDRESS", value: "0xdead" }, "RETAIL");
    expect(signal.matchCount).toBe(0);
    expect(signal.ims).toBe(0);
    expect(signal.ics).toBe(0);
    expect(signal.hasSanction).toBe(false);
    expect(signal.topRiskClass).toBeNull();
    expect(signal.winner).toBeNull();
  });

  it("SUR-CORRECTION — une entité RETAIL_SAFE garde TOUTES ses observations actives", async () => {
    // L'autorisation de niveau entité rend admissible tout ce qui est vivant,
    // y compris une source non publiable : l'entité a été relue et autorisée.
    mockEntity.mockResolvedValue(entite("RETAIL_SAFE", [obsOfac, obsChainalysis]));
    const signal = await matchEntity({ type: "ADDRESS", value: "0xdead" }, "RETAIL");
    expect(signal.matchCount).toBe(2);
  });

  it("AUDIENCE — l'analyste voit les deux, l'entité fût-elle inactive", async () => {
    mockEntity.mockResolvedValue(entite("INTERNAL_ONLY", [obsOfac, obsChainalysis], false));
    const interne = await matchEntity({ type: "ADDRESS", value: "0xdead" }, "INTERNAL");
    expect(interne.matchCount).toBe(2);

    const retail = await matchEntity({ type: "ADDRESS", value: "0xdead" }, "RETAIL");
    expect(retail.matchCount).toBe(0);
  });

  it("MUTANT — `lookupValue` PROPAGE l'audience qu'on lui donne", async () => {
    // Preuve manquante trouvée par un mutant : `lookupValue` pouvait ignorer
    // son paramètre et forcer INTERNAL, et rien ne rougissait. C'est le
    // chemin de l'ingest admin ET celui de l'overlay REFLEX — les deux
    // seuls appelants qui déclarent explicitement leur audience.
    mockEntity.mockResolvedValue(entite("INTERNAL_ONLY", [obsChainalysis], false));
    expect((await lookupValue("0xdead", undefined, "RETAIL")).matchCount).toBe(0);
    expect((await lookupValue("0xdead", undefined, "INTERNAL")).matchCount).toBe(1);
  });

  it("MUTANT — et son DÉFAUT est RETAIL lui aussi", async () => {
    mockEntity.mockResolvedValue(entite("INTERNAL_ONLY", [obsChainalysis], false));
    expect((await lookupValue("0xdead")).matchCount).toBe(0);
  });

  it("MUTANT — le DÉFAUT d'audience est RETAIL, pas INTERNAL", async () => {
    // Un appelant qui ne se déclare pas n'obtient pas d'autorité sur des
    // contributions inadmissibles. `engine.ts:513` est exactement ce cas :
    // il appelle sans argument et doit être fermé.
    mockEntity.mockResolvedValue(entite("INTERNAL_ONLY", [obsChainalysis], false));
    const sansArgument = await matchEntity({ type: "ADDRESS", value: "0xdead" });
    expect(sansArgument.matchCount).toBe(0);
  });
});
