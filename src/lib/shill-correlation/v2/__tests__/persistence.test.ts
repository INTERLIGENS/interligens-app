// --- C - la nature s'écrit via S6, et jamais en masse ---------------------

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NatureTransitionError, UnknownNatureError } from "@/lib/data-nature/nature";
import { natureForTable, NATURE_REGISTRY } from "@/lib/data-nature/registry";
import { ALL_NATURE_VALUES } from "@/lib/data-nature/nature";
import {
  BACKFILL_IS_FORBIDDEN,
  CANDIDATE_TABLE,
  PG_DATA_NATURE_LABELS,
  buildCandidateNatureWrite,
} from "../persistence";
import { runEngine } from "../engine";
import { ENGINE_POLICY_VERSION } from "../nature";
import { DEFAULT_ENGINE_POLICY } from "../policy";
import type { CandidateInference } from "../types";
import {
  baselineCollected,
  baselineCollectedEmpty,
  baselineBuy,
  buy,
  occasion,
  record,
} from "../__fixtures__/corpus";

const P = DEFAULT_ENGINE_POLICY;

const candidate = (): CandidateInference => {
  const records = Array.from({ length: 8 }, (_, i) =>
    record(occasion(`p${i}`, "kol_p", i * 120), {
      observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
      baseline:
        i < 4
          ? baselineCollected([baselineBuy("W1", -100, `b${i}`), baselineBuy("WX", -80, `c${i}`)])
          : baselineCollectedEmpty(),
    }),
  );
  return runEngine(records, P).candidates.find((c) => c.wallet === "W1")!;
};

describe("C - registre", () => {
  it("la table est déclarée mono-nature INFERENCE", () => {
    const decl = NATURE_REGISTRY[CANDIDATE_TABLE];
    expect(decl.regime).toBe("DECLARED");
    expect(decl.nature).toBe("INFERENCE");
    expect(decl.basis).toContain("PRIMARY_OBSERVATION");
    expect(natureForTable(CANDIDATE_TABLE)).toBe("INFERENCE");
  });

  it("la nature déclarée vaut AUSSI pour les lignes legacy sans colonne", () => {
    // Le point de doctrine : la colonne est la piste d'audit, pas la source.
    // Une ligne à rowNature NULL n'est pas UNCLASSIFIED — le registre la couvre.
    expect(natureForTable(CANDIDATE_TABLE)).not.toBe("UNCLASSIFIED");
  });
});

describe("C - le contrat enum TS ↔ Postgres", () => {
  it("les labels TS et les labels Postgres sont le MÊME ensemble", () => {
    // La colonne est un ENUM, pas du TEXT : une nature connue de TS mais
    // absente du type Postgres ne produit plus une ligne douteuse, elle produit
    // un 22P02 au premier upsert de production. Ce test est le seul endroit où
    // cette divergence coûte moins cher qu'un run interrompu.
    expect([...PG_DATA_NATURE_LABELS].sort()).toEqual([...ALL_NATURE_VALUES].sort());
  });

  it("INFERENCE, la seule nature que cette table peut porter, est un label valide", () => {
    expect(PG_DATA_NATURE_LABELS).toContain("INFERENCE");
    expect(buildCandidateNatureWrite(candidate()).rowNature).toBe("INFERENCE");
  });

  it("une valeur inventée est arrêtée par S0, AVANT même le contrôle enum", () => {
    // Ordre réel des refus, et il compte : S0 (requireNatureValue) ne connaît
    // que les 6 natures du produit et rejette tout le reste. Le contrôle enum
    // de persistence.ts est donc INATTEIGNABLE par une valeur inventée — c'est
    // voulu, il ne couvre pas ce cas-là.
    const c = candidate();
    const horsType = { ...c, _nature: { ...c._nature, nature: "INFERENCE_V2" as never } };
    expect(() => buildCandidateNatureWrite(horsType)).toThrow(UnknownNatureError);
  });

  it("le contrôle enum couvre le cas que S0 ne PEUT PAS voir : la dérive TS→PG", () => {
    // S0 valide contre la liste TS. Si quelqu'un ajoute une nature à
    // DATA_NATURES sans l'ajouter au type Postgres, S0 dit oui et la base dit
    // 22P02 — en production, au premier upsert. Le contrôle enum est la seule
    // barrière sur ce chemin, et le test d'égalité d'ensembles ci-dessus est ce
    // qui le rend inutile en pratique. Les deux se tiennent : on vérifie ici
    // que la barrière existe bien dans le chemin d'écriture.
    const src = readFileSync(join(__dirname, "..", "persistence.ts"), "utf8");
    const corps = src.slice(src.indexOf("export function buildCandidateNatureWrite"));
    expect(corps).toContain("PG_DATA_NATURE_LABELS");
    expect(corps).toContain("22P02");
  });
});

describe("C - le fragment d'écriture", () => {
  it("porte la nature (colonne rowNature), le basis et la version de politique", () => {
    const w = buildCandidateNatureWrite(candidate());
    expect(w.rowNature).toBe("INFERENCE");
    expect(w.natureBasis.natures).toContain("PRIMARY_OBSERVATION");
    expect(w.natureBasis.occasionIds.length).toBeGreaterThan(0);
    expect(w.natureBasis.observationCount).toBeGreaterThan(0);
    expect(w.naturePolicyVersion).toBe(ENGINE_POLICY_VERSION);
  });

  it("la colonne de nature s'appelle `rowNature` - la convention du produit", () => {
    // 7 tables sur 7 portent `rowNature` (EvidenceItem, KolCase,
    // KolTokenInvolvement, KolTokenLink, KolWallet, TokenPriceTracker,
    // token_casefiles). Aucune ne porte `nature`. Ce test verrouille le nom :
    // le fragment est fusionné tel quel dans l'upsert, une clé `nature` y
    // produirait un `Unknown argument` Prisma au premier run réel.
    const w = buildCandidateNatureWrite(candidate());
    expect(Object.keys(w).sort()).toEqual(
      ["natureBasis", "naturePolicyVersion", "rowNature"],
    );
    expect(w).not.toHaveProperty("nature");
  });

  it("est sérialisable en jsonb sans perte", () => {
    const w = buildCandidateNatureWrite(candidate());
    expect(JSON.parse(JSON.stringify(w.natureBasis))).toEqual(w.natureBasis);
  });

  it("accepte une ligne legacy (rowNature NULL) - c'est le cas des 1 532", () => {
    expect(() => buildCandidateNatureWrite(candidate(), { id: "legacy", rowNature: null })).not.toThrow();
  });

  it("I1 - une ligne déjà INFERENCE ne peut pas être promue PRIMARY_OBSERVATION", () => {
    // Le sens qui compte ICI : le moteur calcule, il n'observe pas. Un
    // consommateur qui voudrait faire passer sa sortie pour une observation
    // primaire remonte l'échelle d'autorité — I1 le refuse.
    const c = candidate();
    const promu = { ...c, _nature: { ...c._nature, nature: "PRIMARY_OBSERVATION" as never } };
    expect(() => buildCandidateNatureWrite(promu, { id: "x", rowNature: "INFERENCE" })).toThrow(
      NatureTransitionError,
    );
  });

  it("descendre l'échelle reste permis, et le registre l'arrête quand même", () => {
    // PRIMARY_OBSERVATION → INFERENCE est une DESCENTE : I1 ne s'y oppose pas.
    // C'est alors le contrôle de cohérence avec le registre qui tient la table
    // mono-nature — sans lui, S6 seul laisserait passer.
    expect(() =>
      buildCandidateNatureWrite(candidate(), { id: "x", rowNature: "PRIMARY_OBSERVATION" }),
    ).not.toThrow();
    const c = candidate();
    const degrade = { ...c, _nature: { ...c._nature, nature: "ESTIMATE" as never } };
    expect(() => buildCandidateNatureWrite(degrade)).toThrow(/incompatible avec la nature DÉCLARÉE/);
  });

  it("réécrire INFERENCE sur INFERENCE est permis (recalcul idempotent)", () => {
    expect(() => buildCandidateNatureWrite(candidate(), { id: "x", rowNature: "INFERENCE" })).not.toThrow();
  });

  it("une enveloppe sans nature est refusée par S6, pas corrigée", () => {
    const c = candidate();
    const broken = { ...c, _nature: { ...c._nature, nature: undefined as never } };
    expect(() => buildCandidateNatureWrite(broken)).toThrow(UnknownNatureError);
  });
});

describe("C - aucun backfill", () => {
  it("le module n'exporte aucune fonction de backfill", () => {
    expect(BACKFILL_IS_FORBIDDEN).toBe(true);
  });

  it("le fragment est propre à UNE ligne : deux candidats ne partagent pas leur basis", () => {
    const records = [
      ...Array.from({ length: 6 }, (_, i) =>
        record(occasion(`q${i}`, "kol_q", i * 120), {
          observations: [buy("WA", "pre_tweet", -100, `a${i}`)],
          baseline: baselineCollectedEmpty(),
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        record(occasion(`r${i}`, "kol_r", i * 120), {
          observations: [buy("WB", "pre_tweet", -100, `b${i}`)],
          baseline: baselineCollectedEmpty(),
        }),
      ),
    ];
    const cands = runEngine(records, P).candidates;
    const [a, b] = cands.map((c) => buildCandidateNatureWrite(c));
    expect(a.natureBasis.occasionIds).not.toEqual(b.natureBasis.occasionIds);
    // Un backfill global écraserait cette différence par une valeur unique.
    expect(a.natureBasis.observationCount).not.toBe(b.natureBasis.observationCount);
  });
});
