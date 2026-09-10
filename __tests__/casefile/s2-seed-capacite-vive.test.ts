/**
 * __tests__/casefile/s2-seed-capacite-vive.test.ts
 *
 * BUILD 13 · S2 — LA CAPACITÉ D'ÉCRITURE RESTE VIVE.
 *
 * ██  Une capacité qui disparaît n'est pas une capacité gouvernée.  ██
 *
 * Router l'upsert du seed par la frontière (`assignRef` / `withoutRef`) rend
 * RC-2 et RC-3 verts. Ce n'est PAS la preuve attendue : une garde satisfaite
 * en SUPPRIMANT l'écriture serait verte de la même façon, et le dossier LAB ne
 * serait plus semé. La clôture exige donc la propriété inverse — le seed écrit
 * ENCORE, et il écrit LA MÊME LIGNE.
 *
 * Le `PrismaClient` est remplacé par un enregistreur : aucune connexion, aucune
 * requête, aucune écriture. On lit ce que le seed AURAIT envoyé.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

/** Ce que le seed AURAIT envoyé — jamais `any` : la fabrique de mock est typée. */
interface ArgsUpsert {
  readonly where: { readonly ref: string };
  readonly create: Record<string, unknown>;
  readonly update: Record<string, unknown>;
}

const upserts: ArgsUpsert[] = [];

vi.mock("@prisma/client", async () => {
  // Seul le CLIENT est remplacé. `Prisma` reste le vrai module — le seed
  // construit de vraies valeurs `Prisma.Decimal`, et les remplacer changerait
  // la ligne qu'on prétend mesurer.
  const reel = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  class PrismaClient {
    tokenCaseFile = {
      upsert: async (args: ArgsUpsert) => {
        upserts.push(args);
        // Ce que Prisma rendrait : la ligne écrite.
        return { ...args.create, id: "cuid-simule" };
      },
    };
    $disconnect = async () => {};
  }
  return { ...reel, PrismaClient };
});

beforeAll(async () => {
  // Le module exécute `main()` à l'import — c'est voulu : on mesure le seed
  // RÉEL, pas une reconstruction de son intention.
  await import("../../prisma/seed-lab");
  await vi.waitFor(() => expect(upserts.length).toBeGreaterThan(0));
});

describe("S2 · le seed écrit encore, et il écrit la même ligne", () => {
  it("il écrit — un et un seul upsert sur l'autorité", () => {
    expect(upserts).toHaveLength(1);
  });

  it("le `where` porte toujours l'identité du dossier", () => {
    expect(upserts[0].where).toEqual({ ref: "IL-PND-LAB-001" });
  });

  it("la CRÉATION porte la ligne ENTIÈRE, référence comprise", () => {
    const create = upserts[0].create;
    expect(create.ref).toBe("IL-PND-LAB-001");
    expect(create.codename).toBeTruthy();
    expect(create.publishStatus).toBe("published");
    expect(typeof create.bodyMarkdown).toBe("string");
    expect(String(create.bodyMarkdown).length).toBeGreaterThan(1000);
  });

  it("la MISE À JOUR porte tout SAUF la référence — rien d'autre n'a été retiré", () => {
    const create = upserts[0].create;
    const update = upserts[0].update;
    expect("ref" in update).toBe(false);
    // L'égalité des ensembles de clefs, à `ref` près : c'est la formulation
    // exacte de « la même ligne ». Un champ perdu en chemin la fait rougir.
    const attendues = Object.keys(create).filter((k) => k !== "ref").sort();
    expect(Object.keys(update).sort()).toEqual(attendues);
    for (const k of attendues) expect(update[k]).toEqual(create[k]);
  });

  it("l'identité n'est pas perdue pour autant : le `where` la porte", () => {
    // La colonne sort de la CHARGE, pas de l'écriture. Prisma retrouve la ligne
    // par le `where` ; le ref persisté n'est ni réécrit, ni effacé.
    expect(upserts[0].where.ref).toBe(upserts[0].create.ref);
  });
});
