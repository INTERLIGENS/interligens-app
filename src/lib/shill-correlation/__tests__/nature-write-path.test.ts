// --- C (fin) - la nature s'ecrit PAR le chemin d'ecriture ------------------
//
// Ce que ces tests verrouillent n'est pas « le fragment est correct » -
// persistence.test.ts le fait deja sur la fonction isolee. C'est que l'UPSERT
// LE TRAVERSE : qu'aucune ligne ne puisse etre ecrite sans avoir passe le
// chokepoint S6, et qu'un refus du chokepoint arrete le run au lieu d'ecrire
// une ligne sans nature.
//
// La difference est exactement celle qui a coute la tache C : entre une garde
// qui existe dans un module et une garde qui est sur le chemin.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shillBuyerObservation: { findMany: vi.fn() },
    shillCorrelationCandidate: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { aggregateCandidates, type ExistingExclusion } from "../aggregate";
import { ENGINE_POLICY_VERSION } from "../v2/nature";
import { NatureTransitionError } from "@/lib/data-nature/nature";

const obsFindMany = vi.mocked(
  prisma.shillBuyerObservation.findMany as unknown as (...a: unknown[]) => unknown,
);
const upsert = vi.mocked(
  prisma.shillCorrelationCandidate.upsert as unknown as (...a: unknown[]) => unknown,
);

const KOL = "empire_sol1";
const WALLET = "AUQAzeNnW4p2";

/** `n` occasions distinctes pour un meme (kol, wallet) - une par evenement. */
function observations(
  n: number,
  opts: { resolutionStatus?: string; wallet?: string } = {},
) {
  const wallet = opts.wallet ?? WALLET;
  return Array.from({ length: n }, (_, i) => ({
    shillEventId: `e${i}`,
    wallet,
    chain: "solana",
    behaviorType: "pre_tweet",
    exitDeltaSeconds: null,
    // Occasions espacees d'un jour : buildOccasions ne peut pas les replier.
    firstSeenAt: new Date(Date.UTC(2026, 5, 3 + i, 18, 55)),
    firstBuyTxSignature: `sig${i}`,
    shillEvent: {
      id: `e${i}`,
      kolHandle: KOL,
      tokenMint: `MINT_${i}`,
      tweetTimestamp: new Date(Date.UTC(2026, 5, 3 + i, 18, 57)),
      resolutionStatus: opts.resolutionStatus ?? "resolved_direct",
    },
  }));
}

const noPrior = () => Promise.resolve(new Map<string, ExistingExclusion>());

const priorWith = (rowNature: string | null, id = "row-1") =>
  () =>
    Promise.resolve(
      new Map<string, ExistingExclusion>([
        [
          `${KOL} ${WALLET} solana`,
          {
            excludedReason: null,
            walletTxCount30d: null,
            walletTokenAccounts: null,
            walletVettedAt: null,
            id,
            rowNature: rowNature as ExistingExclusion["rowNature"],
          },
        ],
      ]),
    );

const dataOf = (call: number) =>
  (upsert.mock.calls[call][0] as { create: Record<string, unknown> }).create;

beforeEach(() => vi.clearAllMocks());

describe("C - l'upsert porte la nature", () => {
  it("tout candidat ecrit porte rowNature, natureBasis et naturePolicyVersion", async () => {
    obsFindMany.mockResolvedValue(observations(3));
    const r = await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    expect(r.written).toBe(1);
    expect(r.natureWritten).toBe(1);

    const d = dataOf(0);
    expect(d.rowNature).toBe("INFERENCE");
    expect(d.naturePolicyVersion).toBe(ENGINE_POLICY_VERSION);
    expect(d.natureBasis).toMatchObject({
      inputNatures: ["PRIMARY_OBSERVATION"],
      observationCount: 3,
    });
    // B4.2 : l'inference n'est jamais une de ses propres entrees.
    expect((d.natureBasis as { inputNatures: string[] }).inputNatures).not.toContain("INFERENCE");
  });

  it("`create` et `update` portent la meme nature - une reecriture ne la perd pas", async () => {
    obsFindMany.mockResolvedValue(observations(2));
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    const call = upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(call.update.rowNature).toBe("INFERENCE");
    expect(call.update.naturePolicyVersion).toBe(call.create.naturePolicyVersion);
  });

  it("le fragment ne fuit AUCUNE cle hors-colonne dans le `data` de l'upsert", async () => {
    // Le fragment est fusionne tel quel : une cle `nature` (l'ancien nom) ou
    // `_nature` (l'enveloppe interne) produirait un `Unknown argument` Prisma
    // au premier run reel, pas en test.
    obsFindMany.mockResolvedValue(observations(2));
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    const d = dataOf(0);
    expect(d).not.toHaveProperty("nature");
    expect(d).not.toHaveProperty("_nature");
    expect(Object.keys(d)).toEqual(
      expect.arrayContaining(["rowNature", "natureBasis", "naturePolicyVersion"]),
    );
  });
});

describe("C - le chokepoint S6 est SUR le chemin, pas a cote", () => {
  it("un refus du chokepoint arrete le run - AUCUNE ligne n'est ecrite sans nature", async () => {
    // EDITORIAL_ASSERTION (rang 1) -> INFERENCE (rang 3) est une REMONTEE de
    // l'echelle d'autorite : I1 l'interdit. Le seul chemin par lequel ce refus
    // peut atteindre l'upsert est le chokepoint lui-meme - si le garde etait
    // hors du chemin, l'upsert passerait et ecraserait la ligne en silence.
    obsFindMany.mockResolvedValue(observations(2));

    await expect(
      aggregateCandidates({
        dryRun: false,
        loadExistingExclusions: priorWith("EDITORIAL_ASSERTION"),
      }),
    ).rejects.toThrow(NatureTransitionError);

    expect(upsert).not.toHaveBeenCalled();
  });

  it("le refus tombe AVANT l'upsert, pas apres - rien n'est ecrit meme partiellement", async () => {
    // Deux candidats, le PREMIER refuse. Si le fragment etait construit apres
    // le `data` ou dans un `catch`, le second aurait ete ecrit malgre tout.
    obsFindMany.mockResolvedValue([
      ...observations(2),
      ...observations(2, { wallet: "OTHERWALLET99" }),
    ]);

    await expect(
      aggregateCandidates({
        dryRun: false,
        loadExistingExclusions: priorWith("EDITORIAL_ASSERTION"),
      }),
    ).rejects.toThrow(NatureTransitionError);

    expect(upsert).not.toHaveBeenCalled();
  });

  it("une ligne legacy (rowNature NULL) est ecrite normalement - c'est le cas des 1 532", async () => {
    obsFindMany.mockResolvedValue(observations(2));
    const r = await aggregateCandidates({
      dryRun: false,
      loadExistingExclusions: priorWith(null),
    });
    expect(r.natureWritten).toBe(1);
    expect(dataOf(0).rowNature).toBe("INFERENCE");
  });

  it("reecrire INFERENCE sur INFERENCE passe - le recalcul est idempotent", async () => {
    obsFindMany.mockResolvedValue(observations(2));
    const r = await aggregateCandidates({
      dryRun: false,
      loadExistingExclusions: priorWith("INFERENCE"),
    });
    expect(r.natureWritten).toBe(1);
  });
});

describe("C - AUCUN backfill", () => {
  it("seules les lignes que CE run reproduit sont visitees", async () => {
    // Trois lignes connues en base, une seule reproduite par le run. Les deux
    // autres ne doivent recevoir AUCUN upsert : elles restent NULL.
    obsFindMany.mockResolvedValue(observations(2));
    const legacy = new Map<string, ExistingExclusion>();
    for (const w of [WALLET, "LEGACY_A", "LEGACY_B"]) {
      legacy.set(`${KOL} ${w} solana`, {
        excludedReason: null,
        walletTxCount30d: null,
        walletTokenAccounts: null,
        walletVettedAt: null,
        id: `row-${w}`,
        rowNature: null,
      });
    }

    const r = await aggregateCandidates({
      dryRun: false,
      loadExistingExclusions: () => Promise.resolve(legacy),
    });

    expect(r.written).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const wheres = upsert.mock.calls.map(
      (c) => (c[0] as { where: { kolHandle_wallet_chain: { wallet: string } } }).where
        .kolHandle_wallet_chain.wallet,
    );
    expect(wheres).toEqual([WALLET]);
  });

  it("un dry-run n'ecrit rien mais montre CE QUI SERAIT ecrit", async () => {
    obsFindMany.mockResolvedValue(observations(2));
    const r = await aggregateCandidates({ dryRun: true, loadExistingExclusions: noPrior });

    expect(upsert).not.toHaveBeenCalled();
    expect(r.written).toBeUndefined();
    expect(r.natureWritten).toBeUndefined();
    // L'enveloppe existe malgre tout : un dry-run muet sur la nature ne
    // permettrait pas de relire ce que le run s'apprete a poser.
    expect(r.candidates[0].nature.nature).toBe("INFERENCE");
    expect(r.candidates[0].nature.policyVersion).toBe(ENGINE_POLICY_VERSION);
  });
});

describe("C - le basis dit de quoi CETTE ligne est tiree", () => {
  it("baselineBuyCount vaut 0 sur le chemin v1, et c'est une mesure", async () => {
    // v1 n'a pas de collecteur temoin (tache D). Le zero doit etre VISIBLE :
    // une enveloppe qui le tairait laisserait croire a une inference adossee a
    // un temoin, alors que le lift de ces candidats n'est pas mesure.
    obsFindMany.mockResolvedValue(observations(4));
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    expect(dataOf(0).natureBasis).toMatchObject({ baselineBuyCount: 0 });
  });

  it("B4.2 - une resolution PAR CALCUL est DECRITE, pas aplatie en nature", async () => {
    // Le comportement d'avant : `natures` recevait "INFERENCE" des que le
    // resolveur avait tranche. C'etait vrai qu'une etape amont etait un calcul,
    // et faux de l'ecrire ainsi - le basis disait « fondee sur une inference »
    // sans dire laquelle. La resolution est desormais un CHAMP nomme.
    obsFindMany.mockResolvedValue(observations(2, { resolutionStatus: "resolved_from_tweet" }));
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    const b = dataOf(0).natureBasis as {
      inputNatures: string[];
      inputs: { resolution?: { status: string; evidence: string } };
    };
    expect(b.inputNatures).not.toContain("INFERENCE");
    expect(b.inputs.resolution).toBeDefined();
    expect(b.inputs.resolution!.status).toBe("resolved_by_canonical_resolver");
  });

  it("resolved_direct : aucune etape de resolution n'est declaree", async () => {
    obsFindMany.mockResolvedValue(observations(2, { resolutionStatus: "resolved_direct" }));
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    const b = dataOf(0).natureBasis as {
      inputNatures: string[];
      inputs: { resolution?: unknown };
    };
    expect(b.inputNatures).toEqual(["PRIMARY_OBSERVATION"]);
    expect(b.inputs.resolution).toBeUndefined();
  });

  it("le basis cite un methodRef qui RESOUT", async () => {
    const { isKnownMethodRef } = await import("@/lib/methodology/registry");
    obsFindMany.mockResolvedValue(observations(2));
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });
    const b = dataOf(0).natureBasis as { inputs: { methodology: { methodRef: string } } };
    expect(isKnownMethodRef(b.inputs.methodology.methodRef)).toBe(true);
  });

  it("deux candidats ne partagent pas leur basis - un backfill global l'ecraserait", async () => {
    obsFindMany.mockResolvedValue([
      ...observations(4),
      ...observations(2, { wallet: "OTHERWALLET99" }),
    ]);
    await aggregateCandidates({ dryRun: false, loadExistingExclusions: noPrior });

    const a = dataOf(0).natureBasis as { observationCount: number; occasionIds: string[] };
    const b = dataOf(1).natureBasis as { observationCount: number; occasionIds: string[] };
    expect(a.observationCount).not.toBe(b.observationCount);
    expect(a.occasionIds).not.toEqual(b.occasionIds);
  });
});
