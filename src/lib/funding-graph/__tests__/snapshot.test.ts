// --- F1 — LA PHOTO NE CONCLUT PAS -----------------------------------------

import { describe, it, expect } from "vitest";
import { buildFundingSnapshot, type TransferBearingTx } from "../index";

const A = "AaaaWalletAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "BbbbWalletBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const C = "CcccWalletCcccccccccccccccccccccccccccccccc";
const F = "FfffFunderFffffffffffffffffffffffffffffffff";

const tx = (
  signature: string,
  timestamp: number,
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>,
): TransferBearingTx => ({ signature, timestamp, nativeTransfers });

describe("F1 - la photo compte, elle n'interprète pas", () => {
  it("un bailleur externe et un bailleur-sujet sont comptés SÉPARÉMENT", () => {
    const snap = buildFundingSnapshot({
      subjects: [A, B, C],
      txs: [
        tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
        tx("s2", 101, [{ fromUserAccount: F, toUserAccount: B, amount: 20 }]),
        tx("s3", 102, [{ fromUserAccount: A, toUserAccount: B, amount: 5 }]),
        tx("s4", 103, [{ fromUserAccount: A, toUserAccount: C, amount: 5 }]),
      ],
    });
    expect(snap.funderStructure).toEqual({ observedFunders: 2, amongSubjects: 1, external: 1 });
    // Les additionner produirait un nombre dont on ne saurait dire ce qu'il compte.
    expect(snap.funderStructure!.amongSubjects + snap.funderStructure!.external)
      .toBe(snap.funderStructure!.observedFunders);
  });

  it("rien d'observé → funderStructure est null, JAMAIS des zéros", () => {
    const snap = buildFundingSnapshot({
      subjects: [A, B],
      txs: [tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }])],
    });
    expect(snap.sharedFunder.observed).toBe(false);
    // Un décompte de rien n'est pas zéro : zéro se lit « on a compté, il n'y en
    // avait pas », alors qu'on n'a rien pu compter.
    expect(snap.funderStructure).toBeNull();
    if (!snap.sharedFunder.observed) expect(snap.sharedFunder.diagnostic).toBe("NOT_OBSERVED");
  });

  it("MUTATION : la photo ne porte aucun verdict, même sérialisée", () => {
    const snap = buildFundingSnapshot({
      subjects: [A, B],
      txs: [
        tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
        tx("s2", 101, [{ fromUserAccount: F, toUserAccount: B, amount: 20 }]),
      ],
    });
    const s = JSON.stringify(snap).toLowerCase();
    for (const forbidden of ["coordinat", "scam", "suspici", "cluster", "verdict", "risk"]) {
      expect(s).not.toContain(forbidden);
    }
    expect(snap.rowNature).toBe("PRIMARY_OBSERVATION");
  });

  it("les refus d'extraction remontent dans la photo, pas dans le silence", () => {
    const snap = buildFundingSnapshot({
      subjects: [A, B],
      txs: [
        tx("s1", 100, [
          { fromUserAccount: A, toUserAccount: A, amount: 5 },
          { fromUserAccount: F, toUserAccount: A, amount: 0 },
          { fromUserAccount: F, toUserAccount: A, amount: 10 },
          { fromUserAccount: F, toUserAccount: B, amount: 10 },
        ]),
      ],
    });
    expect(snap.edges).toEqual({
      transfersSeen: 4,
      kept: 2,
      skipped: { selfTransfer: 1, missingEndpoint: 0, nonPositiveAmount: 1, nonFiniteAmount: 0 },
    });
    expect(snap.sharedFunder.observed).toBe(true);
  });

  it("les arêtes restent disponibles pour recontrôle", () => {
    const snap = buildFundingSnapshot({
      subjects: [A, B],
      txs: [tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }])],
    });
    expect(snap.edgeList).toHaveLength(1);
    expect(snap.edgeList[0].txSignature).toBe("s1");
    expect(snap.edgeList[0].rowNature).toBe("PRIMARY_OBSERVATION");
  });

  it("aucun sujet exploitable → NOT_OBSERVED, sans photo fabriquée", () => {
    const snap = buildFundingSnapshot({ subjects: [], txs: [] });
    expect(snap.subjects).toEqual([]);
    expect(snap.funderStructure).toBeNull();
    expect(snap.edges.kept).toBe(0);
  });

  it("la photo est déterministe", () => {
    const txs = [
      tx("s1", 100, [{ fromUserAccount: F, toUserAccount: A, amount: 10 }]),
      tx("s2", 101, [{ fromUserAccount: F, toUserAccount: B, amount: 20 }]),
    ];
    expect(buildFundingSnapshot({ subjects: [A, B], txs }))
      .toEqual(buildFundingSnapshot({ subjects: [A, B], txs }));
  });
});
