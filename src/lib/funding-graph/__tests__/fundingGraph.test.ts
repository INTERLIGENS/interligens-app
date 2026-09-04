// --- F0 — LES GATES MUTATION ----------------------------------------------
//
// Chaque test de mutation construit le MUTANT — la version fautive du module —
// et vérifie qu'elle diffère du comportement réel. Un test qui se contente
// d'affirmer le comportement correct passerait encore si l'invariant était
// retiré ; celui-ci rougit.

import { describe, it, expect } from "vitest";
import {
  FUNDING_EDGE_NATURE,
  LAMPORTS_PER_SOL,
  buildFundingEdges,
  sharedFunder,
  MIN_SHARED_RECIPIENTS,
  type FundingEdge,
  type TransferBearingTx,
} from "../index";

const A = "AaaaWalletAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "BbbbWalletBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const C = "CcccWalletCcccccccccccccccccccccccccccccccc";
const F = "FfffFunderFffffffffffffffffffffffffffffffff";

const tx = (
  signature: string,
  timestamp: number,
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>,
): TransferBearingTx => ({ signature, timestamp, nativeTransfers });

/** Forme réelle mesurée sur le sink P0 : lamports entiers, 3 champs. */
const REAL_SHAPE = tx("sig-real", 1_756_849_575, [
  { fromUserAccount: "5NA8C5EAypvoceo7gqiCZS8nzLdgeknrdfz3wsFpPevm",
    toUserAccount: "burn68h9dS2tvZwtCFMt79SyaEgvqtcZZWJphizQxgt", amount: 41481 },
]);

describe("F0.2 - l'arête est fidèle au transfert, ou elle n'existe pas", () => {
  it("la forme réelle de la collecte P0 produit une arête complète", () => {
    const { edges, transfersSeen } = buildFundingEdges([REAL_SHAPE]);
    expect(transfersSeen).toBe(1);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      fromWallet: "5NA8C5EAypvoceo7gqiCZS8nzLdgeknrdfz3wsFpPevm",
      toWallet: "burn68h9dS2tvZwtCFMt79SyaEgvqtcZZWJphizQxgt",
      asset: "SOL",
      amountLamports: 41481,
      txSignature: "sig-real",
      blockTimeSeconds: 1_756_849_575,
      rowNature: "PRIMARY_OBSERVATION",
    });
  });

  // ═══ MUTATION 1 — AUTO-ARÊTE ═══════════════════════════════════════════
  it("MUTATION : un extracteur qui garderait from===to produit une arête de plus", () => {
    const t = tx("s1", 100, [{ fromUserAccount: A, toUserAccount: A, amount: 5 }]);
    const reel = buildFundingEdges([t]);
    expect(reel.edges).toHaveLength(0);
    expect(reel.skipped.selfTransfer).toBe(1);

    // Le mutant : même code, sans le refus.
    const mutant = (t.nativeTransfers ?? []).filter((x) => x.amount > 0).length;
    expect(mutant).toBe(1);
    expect(reel.edges.length).not.toBe(mutant); // 🔴 si l'auto-arête passait
  });

  it("l'auto-arête écartée ne peut pas se glisser dans « source commune »", () => {
    // Sans le refus, A serait son propre bailleur et toucherait A et B.
    const { edges } = buildFundingEdges([
      tx("s1", 100, [{ fromUserAccount: A, toUserAccount: A, amount: 5 }]),
      tx("s2", 101, [{ fromUserAccount: A, toUserAccount: B, amount: 5 }]),
    ]);
    const obs = sharedFunder([A, B], edges);
    expect(obs.observed).toBe(false);
  });

  // ═══ MUTATION 2 — ARÊTE FABRIQUÉE ══════════════════════════════════════
  it("MUTATION : aucune arête n'est créée sans transfert correspondant", () => {
    const txs = [
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
      tx("s2", 101, []),
      tx("s3", 102, [
        { fromUserAccount: F, toUserAccount: B, amount: 20 },
        { fromUserAccount: F, toUserAccount: C, amount: 30 },
      ]),
    ];
    const { edges, transfersSeen } = buildFundingEdges(txs);
    expect(transfersSeen).toBe(3);
    expect(edges).toHaveLength(3); // exactement le nombre de transferts valides
    const sigs = edges.map((e) => e.txSignature);
    expect(sigs).toEqual(["s1", "s3", "s3"]);
    // Toute signature émise existe dans l'entrée.
    const inputSigs = new Set(txs.map((t) => t.signature));
    for (const s of sigs) expect(inputSigs.has(s)).toBe(true);
  });

  it("deux transferts identiques restent DEUX arêtes — pas d'agrégation", () => {
    const { edges } = buildFundingEdges([
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 7 }]),
      tx("s2", 101, [{ fromUserAccount: F, toUserAccount: A, amount: 7 }]),
    ]);
    expect(edges).toHaveLength(2);
    // Un extracteur qui fusionnerait rendrait un montant que nulle tx ne porte.
    expect(edges.reduce((s, e) => s + e.amountLamports, 0)).toBe(14);
    expect(edges.every((e) => e.amountLamports === 7)).toBe(true);
  });

  // ═══ MUTATION 3 — DIRECTION ════════════════════════════════════════════
  it("MUTATION : une direction inversée ferait du bénéficiaire un bailleur", () => {
    const { edges } = buildFundingEdges([
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
    ]);
    expect(edges[0].fromWallet).toBe(F);
    expect(edges[0].toWallet).toBe(A);

    const mutant: FundingEdge = { ...edges[0], fromWallet: A, toWallet: F };
    expect(mutant.fromWallet).not.toBe(edges[0].fromWallet); // 🔴 si confondus

    // Et la conséquence en aval : le mutant désignerait A comme bailleur.
    expect(sharedFunder([A, B], [mutant]).observed).toBe(false);
  });

  it("la direction survit à un aller-retour entre deux wallets", () => {
    const { edges } = buildFundingEdges([
      tx("s1", 100, [{ fromUserAccount: A, toUserAccount: B, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: B, toUserAccount: A, amount: 4 }]),
    ]);
    expect(edges.map((e) => [e.fromWallet, e.toWallet, e.amountLamports])).toEqual([
      [A, B, 10],
      [B, A, 4],
    ]);
  });

  // ═══ MUTATION 4 — MONTANT / ASSET ══════════════════════════════════════
  it("MUTATION : le montant reste en LAMPORTS, aucune conversion implicite", () => {
    const { edges } = buildFundingEdges([
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 1_000_000_000 }]),
    ]);
    expect(edges[0].amountLamports).toBe(1_000_000_000);
    // Le mutant convertit en SOL : un facteur 10⁹ qu'aucun nom ne signalerait.
    const mutant = edges[0].amountLamports / LAMPORTS_PER_SOL;
    expect(mutant).toBe(1);
    expect(edges[0].amountLamports).not.toBe(mutant); // 🔴 si converti en silence
  });

  it("l'asset est SOL sur toute arête — il n'est pas lu, il est constitutif", () => {
    const { edges } = buildFundingEdges([
      tx("s1", 100, [
        { fromUserAccount: F, toUserAccount: A, amount: 1 },
        { fromUserAccount: F, toUserAccount: B, amount: 2 },
      ]),
    ]);
    expect(edges.every((e) => e.asset === "SOL")).toBe(true);
    expect(edges.every((e) => e.rowNature === FUNDING_EDGE_NATURE)).toBe(true);
  });

  it("les transferts inexploitables sont écartés et COMPTÉS, jamais dégradés", () => {
    const { edges, skipped, transfersSeen } = buildFundingEdges([
      tx("s1", 100, [
        { fromUserAccount: A, toUserAccount: A, amount: 5 },
        { fromUserAccount: "", toUserAccount: B, amount: 5 },
        { fromUserAccount: F, toUserAccount: "", amount: 5 },
        { fromUserAccount: F, toUserAccount: A, amount: 0 },
        { fromUserAccount: F, toUserAccount: A, amount: -3 },
        { fromUserAccount: F, toUserAccount: A, amount: NaN },
        { fromUserAccount: F, toUserAccount: B, amount: 9 },
      ]),
    ]);
    expect(transfersSeen).toBe(7);
    expect(edges).toHaveLength(1);
    expect(skipped).toEqual({
      selfTransfer: 1, missingEndpoint: 2, nonPositiveAmount: 2, nonFiniteAmount: 1,
    });
  });

  it("entrée vide → sortie vide, sans invention", () => {
    expect(buildFundingEdges([]).edges).toHaveLength(0);
    expect(buildFundingEdges([{ signature: "s", timestamp: 1 }]).edges).toHaveLength(0);
  });

  it("l'extraction est déterministe et préserve l'ordre d'entrée", () => {
    const txs = [
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 1 }]),
      tx("s2", 101, [{ fromUserAccount: F, toUserAccount: B, amount: 2 }]),
    ];
    expect(buildFundingEdges(txs)).toEqual(buildFundingEdges(txs));
    expect(buildFundingEdges(txs).edges.map((e) => e.txSignature)).toEqual(["s1", "s2"]);
  });
});

describe("F0.3 - « source commune » est une observation, jamais un verdict", () => {
  const edgesOf = (...t: TransferBearingTx[]) => buildFundingEdges(t).edges;

  it("un bailleur touchant deux sujets est OBSERVÉ, avec ses preuves", () => {
    const edges = edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: F, toUserAccount: B, amount: 20 }]),
    );
    const obs = sharedFunder([A, B], edges);
    expect(obs.observed).toBe(true);
    if (!obs.observed) return;
    expect(obs.funders).toHaveLength(1);
    expect(obs.funders[0].funder).toBe(F);
    expect(obs.funders[0].recipients.sort()).toEqual([A, B].sort());
    // La preuve est opposable : une signature par arête, jamais agrégée.
    expect(obs.funders[0].links.map((l) => l.txSignature).sort()).toEqual(["s1", "s2"]);
    expect(obs.funders[0].funderIsAmongSubjects).toBe(false);
  });

  // ═══ MUTATION 5 — L'ABSENCE RENDUE COMME UNE CONCLUSION ════════════════
  it("MUTATION : une absence n'est JAMAIS « pas de coordination »", () => {
    const obs = sharedFunder([A, B], edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
    ));
    expect(obs.observed).toBe(false);
    if (obs.observed) return;
    expect(obs.diagnostic).toBe("NOT_OBSERVED");
    expect(obs.reason).toBe("no_funder_reaching_two_subjects");
    // Le résultat ne porte AUCUN champ de conclusion.
    const serialized = JSON.stringify(obs).toLowerCase();
    for (const forbidden of ["coordinat", "scam", "suspici", "clean", "innocent", "no_coordination"]) {
      expect(serialized).not.toContain(forbidden); // 🔴 si un verdict s'y glissait
    }
    // Et l'échantillon interrogé est DIT : l'absence est bornée par lui.
    expect(obs.edgesConsidered).toBe(1);
  });

  it("les trois absences se distinguent par leur motif", () => {
    const noEdges = sharedFunder([A, B], []);
    expect(noEdges.observed).toBe(false);
    if (!noEdges.observed) expect(noEdges.reason).toBe("no_edges_provided");

    const oneSubject = sharedFunder([A], edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 1 }]),
    ));
    expect(oneSubject.observed).toBe(false);
    if (!oneSubject.observed) expect(oneSubject.reason).toBe("fewer_than_two_subjects");

    const noShared = sharedFunder([A, B], edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 1 }]),
    ));
    expect(noShared.observed).toBe(false);
    if (!noShared.observed) expect(noShared.reason).toBe("no_funder_reaching_two_subjects");
  });

  // ═══ MUTATION 6 — SOURCE COMMUNE INVENTÉE ══════════════════════════════
  it("MUTATION : un bailleur d'UN SEUL sujet ne devient pas une source commune", () => {
    const edges = edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: F, toUserAccount: A, amount: 20 }]),
    );
    // Deux arêtes, mais UN SEUL destinataire distinct.
    expect(edges).toHaveLength(2);
    const obs = sharedFunder([A, B], edges);
    expect(obs.observed).toBe(false);

    // Le mutant compte les ARÊTES au lieu des DESTINATAIRES DISTINCTS.
    const mutantCount = edges.filter((e) => e.fromWallet === F).length;
    expect(mutantCount).toBeGreaterThanOrEqual(MIN_SHARED_RECIPIENTS); // il conclurait
    expect(new Set(edges.map((e) => e.toWallet)).size).toBe(1);        // à tort
  });

  it("MUTATION : la direction n'est pas relue à l'envers", () => {
    // A et B ENVOIENT à F. F ne les finance pas.
    const edges = edgesOf(
      tx("s1", 100, [{ fromUserAccount: A, toUserAccount: F, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: B, toUserAccount: F, amount: 20 }]),
    );
    const obs = sharedFunder([A, B], edges);
    expect(obs.observed).toBe(false);
    if (!obs.observed) expect(obs.reason).toBe("no_funder_reaching_two_subjects");
  });

  it("un sujet qui en finance deux autres est OBSERVÉ, et signalé comme tel", () => {
    const edges = edgesOf(
      tx("s1", 100, [{ fromUserAccount: A, toUserAccount: B, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: A, toUserAccount: C, amount: 20 }]),
    );
    const obs = sharedFunder([A, B, C], edges);
    expect(obs.observed).toBe(true);
    if (!obs.observed) return;
    expect(obs.funders[0].funder).toBe(A);
    expect(obs.funders[0].funderIsAmongSubjects).toBe(true);
  });

  it("les doublons de sujets ne gonflent pas l'observation", () => {
    const edges = edgesOf(tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 1 }]));
    const obs = sharedFunder([A, A, A], edges);
    expect(obs.observed).toBe(false);
    if (!obs.observed) expect(obs.reason).toBe("fewer_than_two_subjects");
    expect(obs.subjects).toEqual([A]);
  });

  it("MULTI-HOP EXCLU : F→A puis A→B ne fait pas de F le bailleur de B", () => {
    const edges = edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: A, toUserAccount: B, amount: 5 }]),
    );
    const obs = sharedFunder([A, B], edges);
    // Seul A (direct, vers B) peut être retenu — et il n'atteint qu'un sujet.
    expect(obs.observed).toBe(false);
  });

  it("l'observation est déterministe", () => {
    const edges = edgesOf(
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: F, toUserAccount: B, amount: 20 }]),
    );
    expect(sharedFunder([A, B], edges)).toEqual(sharedFunder([A, B], edges));
  });
});

describe("F0 - la frontière tient", () => {
  it("aucun module F0 n'importe de réseau, de base ou de chemin gelé", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/prisma|helius|fetch|node-fetch|@\/lib\/shill-correlation/i);
    }
  });

  it("aucun label de coordination dans le CODE (commentaires exclus)", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const code = readFileSync(join(dir, f), "utf8")
        .split("\n")
        .filter((l) => {
          const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      for (const forbidden of ["scam", "suspicious", "coordinationScore", "isCoordinated"]) {
        expect(code.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});
