// --- G1 — LES GATES MUTATION DE L'EXTRACTION -------------------------------

import { describe, it, expect } from "vitest";
import {
  COORDINATED_EXIT_EXTRACT_VERSION,
  extractExitEvents,
  type ExitCandidateTx,
} from "../index";

const SUBJ = "SubjectAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "OtherBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const POOL = "PoolCccccccccccccccccccccccccccccccccccccc";
const MINT = "MintDddddddddddddddddddddddddddddddddddddd";
const WSOL = "So11111111111111111111111111111111111111112";
const TS = 1_737_590_000;

const tx = (p: Partial<ExitCandidateTx>): ExitCandidateTx => ({
  signature: "sig1", timestamp: TS, type: "UNKNOWN", source: "UNKNOWN", ...p,
});
const run = (txs: ExitCandidateTx[]) =>
  extractExitEvents({ subjectWallet: SUBJ, mint: MINT, txs });

describe("G1 - un transfert sortant n'est JAMAIS une vente", () => {
  // ═══ MUTATION 1 — SELL INFÉRÉ D'UN TRANSFERT SORTANT ═══════════════════
  it("MUTATION : le mint sort, rien ne rentre → OUTGOING_TRANSFER, pas SELL", () => {
    const r = run([tx({
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 5_000 }],
    })]);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].type).toBe("OUTGOING_TRANSFER"); // 🔴 si SELL
    expect(r.events[0].observedCounterpartyAsset).toBeNull();
    expect(r.events[0].observedCounterpartyAmount).toBeNull();
    expect(r.events[0].observedCounterpartyMeaning).toBeNull();
    expect(r.events[0].evidenceProvenance.basis).toBe("token_leaves_wallet_no_counter_asset");
  });

  it("MUTATION : le type déclaré par l'indexeur ne fait PAS la preuve", () => {
    // L'indexeur dit SWAP, mais aucune contrepartie n'arrive chez le sujet.
    const r = run([tx({
      type: "SWAP", source: "JUPITER",
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 5_000 }],
    })]);
    expect(r.events[0].type).toBe("OUTGOING_TRANSFER"); // 🔴 si SWAP suffisait
    // …le type de l'indexeur est RAPPORTÉ, jamais utilisé.
    expect(r.events[0].evidenceProvenance.indexerType).toBe("SWAP");
  });

  it("MUTATION : une contrepartie reçue par UN AUTRE wallet ne fait pas un SELL", () => {
    const r = run([tx({
      type: "SWAP",
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 5_000 }],
      nativeTransfers: [{ fromUserAccount: POOL, toUserAccount: OTHER, amount: 900_000 }],
    })]);
    expect(r.events[0].type).toBe("OUTGOING_TRANSFER"); // 🔴
    expect(r.events[0].observedCounterpartyAsset).toBeNull();
    expect(r.events[0].observedCounterpartyAmount).toBeNull();
    expect(r.events[0].observedCounterpartyMeaning).toBeNull();
  });

  it("SELL uniquement sur contrepartie reçue par LE SUJET, même tx", () => {
    const r = run([tx({
      type: "SWAP", source: "PUMP_AMM",
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 5_000 }],
      nativeTransfers: [{ fromUserAccount: POOL, toUserAccount: SUBJ, amount: 116_264_031 }],
    })]);
    expect(r.events[0].type).toBe("SELL");
    expect(r.events[0].observedCounterpartyAsset).toBe("native");
    expect(r.events[0].observedCounterpartyAmount).toBe(116_264_031);
    expect(r.events[0].evidenceProvenance.basis).toBe("swap_counter_asset_same_tx");
    expect(r.events[0].venue).toBe("PUMP_AMM");
  });

  it("une contrepartie en TOKEN (USDC, WSOL) prouve aussi le SELL", () => {
    const r = run([tx({
      tokenTransfers: [
        { mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 5_000 },
        { mint: WSOL, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 12 },
      ],
    })]);
    expect(r.events[0].type).toBe("SELL");
    expect(r.events[0].observedCounterpartyAsset).toBe(WSOL);
    expect(r.events[0].observedCounterpartyAmount).toBe(12);
  });

  // ═══ MUTATION 2 — LES DEUX TYPES FUSIONNÉS ═════════════════════════════
  it("MUTATION : OUTGOING_TRANSFER et SELL restent DISTINCTS sur le même lot", () => {
    const r = run([
      tx({ signature: "s1", tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 1_000 }] }),
      tx({ signature: "s2",
        tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 2_000 }],
        nativeTransfers: [{ fromUserAccount: POOL, toUserAccount: SUBJ, amount: 500 }] }),
    ]);
    expect(r.events.map((e) => e.type)).toEqual(["OUTGOING_TRANSFER", "SELL"]);
    expect(new Set(r.events.map((e) => e.type)).size).toBe(2); // 🔴 si fusionnés
  });

  // ═══ MUTATION 3 — ÉVÉNEMENT SANS PREUVE OPPOSABLE ══════════════════════
  it("MUTATION : sans txSignature, aucun événement n'est produit", () => {
    const r = run([{ timestamp: TS,
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 5_000 }] }]);
    expect(r.events).toHaveLength(0); // 🔴
    expect(r.excluded.missing_signature).toBe(1);
  });

  it("MUTATION : sans block time, aucun événement — l'instant est une preuve", () => {
    for (const bad of [undefined, NaN, Infinity]) {
      const r = run([{ signature: "s1", timestamp: bad as number,
        tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 5_000 }] }]);
      expect(r.events).toHaveLength(0);
      expect(r.excluded.missing_block_time).toBe(1);
    }
  });

  // ═══ MUTATION 4 — amount ≤ 0 CONSERVÉ ══════════════════════════════════
  it("MUTATION : amount ≤ 0 n'est pas un événement", () => {
    for (const amt of [0, -5]) {
      const r = run([tx({ tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: amt }] })]);
      expect(r.events).toHaveLength(0); // 🔴
      expect(r.excluded.no_outgoing_amount).toBe(1);
    }
  });

  it("AUCUN PLANCHER : une sortie de 1 unité est conservée", () => {
    const r = run([tx({ tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 1 }] })]);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].amount).toBe(1n);
    // F0 ne porte aucun seuil de matérialité — c'est une règle versionnée, ailleurs.
  });

  // ═══ MUTATION 5 — destination / venue FABRIQUÉS ════════════════════════
  it("MUTATION : plusieurs destinataires → destination null, jamais un choisi", () => {
    const r = run([tx({ tokenTransfers: [
      { mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 100 },
      { mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 200 },
    ] })]);
    expect(r.events[0].destination).toBeNull(); // 🔴 si OTHER ou POOL était choisi
    expect(r.events[0].amount).toBe(300n);      // …mais la quantité totale est juste
  });

  it("MUTATION : une source `UNKNOWN` ne nomme aucun venue", () => {
    for (const src of ["UNKNOWN", "unknown", "", undefined]) {
      const r = run([tx({ source: src,
        tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 100 }] })]);
      expect(r.events[0].venue).toBeNull(); // 🔴 si "UNKNOWN" devenait un venue
      expect(r.events[0].evidenceProvenance.source).toBeNull();
    }
  });

  it("un destinataire unique EST démontrable, et il est nommé", () => {
    const r = run([tx({ source: "JUPITER",
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 100 }] })]);
    expect(r.events[0].destination).toBe(OTHER);
    expect(r.events[0].venue).toBe("JUPITER");
  });

  // ═══ MUTATION 6 — BLOCK TIME COMPENSÉ ══════════════════════════════════
  it("MUTATION : le block time est recopié TEL QUEL — aucune compensation", () => {
    const r = run([tx({ timestamp: TS,
      tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 100 }] })]);
    expect(r.events[0].blockTimeSeconds).toBe(TS); // 🔴 si TS ± 7200 / ± 3600
    expect(r.events[0].blockTimeSeconds).not.toBe(TS + 7200);
    expect(r.events[0].blockTimeSeconds).not.toBe(TS - 7200);
  });

  it("le module ne contient aucune constante de compensation de fuseau", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const code = readFileSync(join(dir, f), "utf8").split("\n")
        .filter((l) => { const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); })
        .join("\n");
      expect(code).not.toMatch(/\b7200\b|\b3600\b|Europe\/Paris|getTimezoneOffset/);
    }
  });

  it("un acte de sens ambigu est EXCLU et compté, jamais deviné", () => {
    // Le sujet envoie ET reçoit le mint : le sens net n'est pas démontrable.
    const r = run([tx({ tokenTransfers: [
      { mint: MINT, fromUserAccount: SUBJ, toUserAccount: POOL, tokenAmount: 100 },
      { mint: MINT, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 40 },
    ] })]);
    expect(r.events).toHaveLength(0);
    expect(r.excluded.same_mint_in_and_out).toBe(1);
  });

  it("une entrée sans sortie du mint n'est pas une sortie", () => {
    const r = run([tx({ tokenTransfers: [
      { mint: MINT, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 100 },
    ] })]);
    expect(r.events).toHaveLength(0);
    expect(r.excluded.no_outgoing_amount).toBe(1);
  });

  it("les refus sont COMPTÉS sous leur motif, et le total est lisible", () => {
    const r = run([
      tx({ tokenTransfers: [] }),
      { timestamp: TS, tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 1 }] },
      tx({ tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 5 }] }),
    ]);
    expect(r.transactionsSeen).toBe(3);
    expect(r.events).toHaveLength(1);
    expect(r.excluded.no_outgoing_amount).toBe(1);
    expect(r.excluded.missing_signature).toBe(1);
  });

  it("nature et version de règle voyagent avec chaque événement", () => {
    const r = run([tx({ tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 9 }] })]);
    expect(r.events[0].rowNature).toBe("PRIMARY_OBSERVATION");
    expect(r.events[0].evidenceProvenance.rule).toBe(COORDINATED_EXIT_EXTRACT_VERSION);
    expect(COORDINATED_EXIT_EXTRACT_VERSION).toBe("coordinated-exit/extract@v1");
  });

  it("l'extraction est déterministe et n'appelle rien", () => {
    const txs = [tx({ tokenTransfers: [{ mint: MINT, fromUserAccount: SUBJ, toUserAccount: OTHER, tokenAmount: 9 }] })];
    expect(run(txs)).toEqual(run(txs));
  });
});
