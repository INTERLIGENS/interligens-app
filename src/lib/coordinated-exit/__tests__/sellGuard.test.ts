// --- PACK A / G1 — LE GARDE SELL, PAR PROVENANCE ---------------------------
//
// VINE ne contient AUCUNE contrepartie en SOL natif : la branche « loyer » du
// prédicat n'y a jamais été exercée. Ces cas sont donc SYNTHÉTIQUES — et c'est
// exactement pourquoi ils existent. Une branche jamais parcourue n'est pas une
// branche sûre, c'est une branche dont on ignore le comportement.

import { describe, it, expect } from "vitest";
import {
  OBSERVED_COUNTERPARTY_MEANING,
  extractExitEvents,
  type ExitCandidateTx,
} from "../index";

const SUBJ = "SubjectAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const POOL = "PoolCccccccccccccccccccccccccccccccccccccc";
const TIERS = "TiersEeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const MINT = "MintDddddddddddddddddddddddddddddddddddddd";
const ATA = "AtaFfffffffffffffffffffffffffffffffffffff";
const WSOL = "So11111111111111111111111111111111111111112";
const TS = 1_737_590_000;

const tx = (p: Partial<ExitCandidateTx>): ExitCandidateTx => ({
  signature: "sig1", timestamp: TS, type: "UNKNOWN", source: "UNKNOWN", ...p,
});
const run = (txs: ExitCandidateTx[]) => extractExitEvents({ subjectWallet: SUBJ, mint: MINT, txs });
const sortie = (to: string, amt = 5_000) =>
  ({ mint: MINT, fromUserAccount: SUBJ, toUserAccount: to, tokenAmount: amt });

describe("PACK A — le garde refuse ce qu'il ne peut pas démontrer", () => {
  // ═══ MUTATION 1 — LOYER TRAITÉ COMME CONTREPARTIE DE VENTE ═════════════
  it("MUTATION : du SOL sorti d'un COMPTE DE TOKEN qui se ferme n'est PAS une vente", () => {
    const r = run([tx({
      type: "CLOSE_ACCOUNT",
      tokenTransfers: [sortie(POOL)],
      // Le loyer revient du compte de token, pas d'une contrepartie.
      nativeTransfers: [{ fromUserAccount: ATA, toUserAccount: SUBJ, amount: 2_039_280 }],
      tokenBalanceChanges: [{ userAccount: SUBJ, tokenAccount: ATA, mint: MINT }],
    })]);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].type).toBe("OUTGOING_TRANSFER"); // 🔴 si SELL
    expect(r.events[0].evidenceProvenance.basis).toBe("counterparty_rejected_rent_recovery");
    expect(r.events[0].observedCounterpartyAsset).toBeNull();
    expect(r.events[0].observedCounterpartyAmount).toBeNull();
  });

  it("le refus ne dépend PAS du montant : un loyer arbitraire est refusé pareil", () => {
    // Si le garde lisait un montant, changer la valeur changerait le verdict.
    for (const amount of [1, 890_880, 2_039_280, 999_999_999]) {
      const r = run([tx({
        tokenTransfers: [sortie(POOL)],
        nativeTransfers: [{ fromUserAccount: ATA, toUserAccount: SUBJ, amount }],
        tokenBalanceChanges: [{ userAccount: SUBJ, tokenAccount: ATA, mint: MINT }],
      })]);
      expect(r.events[0].type).toBe("OUTGOING_TRANSFER");
      expect(r.events[0].evidenceProvenance.basis).toBe("counterparty_rejected_rent_recovery");
    }
  });

  // ═══ MUTATION 2 — UNE CONSTANTE-LAMPORTS COMME HEURISTIQUE ═════════════
  it("MUTATION : aucune constante de loyer n'existe dans le module", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const code = readFileSync(join(dir, f), "utf8").split("\n")
        .filter((l) => { const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); })
        .join("\n");
      expect(code).not.toMatch(/2_?039_?280|890_?880/); // 🔴
      expect(code).not.toMatch(/RENT_[A-Z]|rentExempt|LAMPORTS_PER_BYTE/);
    }
  });

  it("un VRAI paiement dont le montant vaut celui d'un loyer reste une VENTE", () => {
    // La preuve est la provenance : ce SOL vient du compte qui a reçu le mint.
    const r = run([tx({
      tokenTransfers: [sortie(POOL)],
      nativeTransfers: [{ fromUserAccount: POOL, toUserAccount: SUBJ, amount: 2_039_280 }],
      tokenBalanceChanges: [{ userAccount: SUBJ, tokenAccount: ATA, mint: MINT }],
    })]);
    expect(r.events[0].type).toBe("SELL"); // 🔴 si un seuil de montant l'écartait
    expect(r.events[0].observedCounterpartyAmount).toBe(2_039_280);
  });

  // ═══ MUTATION 3 — PROVENANCE INDISTINCTE PROMUE EN SELL ════════════════
  it("MUTATION : une contrepartie venue d'un TIERS non lié → FAIL-CLOSED", () => {
    const r = run([tx({
      tokenTransfers: [
        sortie(POOL),
        // L'actif rentre, mais d'un compte qui n'a PAS reçu le mint.
        { mint: WSOL, fromUserAccount: TIERS, toUserAccount: SUBJ, tokenAmount: 12 },
      ],
    })]);
    expect(r.events[0].type).toBe("OUTGOING_TRANSFER"); // 🔴 si SELL
    expect(r.events[0].evidenceProvenance.basis)
      .toBe("counterparty_rejected_provenance_undemonstrated");
    expect(r.events[0].observedCounterpartyAsset).toBeNull();
  });

  it("sans tokenBalanceChanges, le garde NE S'ASSOUPLIT PAS", () => {
    // Il ne peut plus reconnaître les comptes de token — mais la règle du lien
    // d'échange, la plus contraignante, continue de s'appliquer.
    const r = run([tx({
      tokenTransfers: [sortie(POOL)],
      nativeTransfers: [{ fromUserAccount: ATA, toUserAccount: SUBJ, amount: 2_039_280 }],
      // tokenBalanceChanges absent
    })]);
    expect(r.events[0].type).toBe("OUTGOING_TRANSFER"); // 🔴 si l'absence ouvrait la porte
    expect(r.events[0].evidenceProvenance.basis)
      .toBe("counterparty_rejected_provenance_undemonstrated");
  });

  it("le lien d'échange DÉMONTRÉ produit un SELL, token comme natif", () => {
    const enToken = run([tx({
      tokenTransfers: [sortie(POOL), { mint: WSOL, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 12 }],
    })]);
    expect(enToken.events[0].type).toBe("SELL");
    expect(enToken.events[0].observedCounterpartyAsset).toBe(WSOL);

    const enNatif = run([tx({
      tokenTransfers: [sortie(POOL)],
      nativeTransfers: [{ fromUserAccount: POOL, toUserAccount: SUBJ, amount: 116_264_031 }],
      tokenBalanceChanges: [{ userAccount: SUBJ, tokenAccount: ATA, mint: MINT }],
    })]);
    expect(enNatif.events[0].type).toBe("SELL");
    expect(enNatif.events[0].observedCounterpartyAsset).toBe("native");
  });

  it("une route à plusieurs sauts reste démontrée si la contrepartie a reçu le mint", () => {
    // C'est la forme réelle des 9 CLOSE_ACCOUNT de VINE.
    const r = run([tx({
      type: "CLOSE_ACCOUNT", source: "SOLANA_PROGRAM_LIBRARY",
      tokenTransfers: [
        sortie(POOL, 274_892),
        { mint: WSOL, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 70.25 },
      ],
    })]);
    expect(r.events[0].type).toBe("SELL");
    expect(r.events[0].evidenceProvenance.indexerType).toBe("CLOSE_ACCOUNT");
  });

  // ═══ MUTATION 4 — events.swap COMME AUTORITÉ ═══════════════════════════
  it("MUTATION : `events.swap` n'entre nulle part dans la décision", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(join(__dirname, "..", "extract.ts"), "utf8")
      .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    expect(code).not.toMatch(/events\?\.\s*swap|swapEvent|\.events\b/); // 🔴
    // …et le type d'entrée ne l'expose même pas.
    const types = readFileSync(join(__dirname, "..", "types.ts"), "utf8")
      .split("\n").filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*")).join("\n");
    expect(types).not.toMatch(/swapEvent|events\?:/);
  });

  // ═══ MUTATION 5 — observedCounterparty* LU COMME PRODUIT TOTAL ═════════
  it("MUTATION : le sens du champ voyage AVEC lui, et nie le P&L", () => {
    const r = run([tx({
      tokenTransfers: [sortie(POOL), { mint: WSOL, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 12 }],
    })]);
    const e = r.events[0];
    expect(e.observedCounterpartyMeaning).toBe(OBSERVED_COUNTERPARTY_MEANING);
    expect(e.observedCounterpartyMeaning).toContain("NOT a guarantee of total proceeds");
    expect(e.observedCounterpartyMeaning).toContain("NEVER usable alone for P&L");
    // Le nom `proceeds` n'existe plus nulle part dans le module.
    expect(Object.keys(e)).not.toContain("proceeds");
  });

  it("MUTATION : `proceeds` a disparu du CODE du module", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const code = readFileSync(join(dir, f), "utf8").split("\n")
        .filter((l) => { const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); })
        .join("\n");
      // On vise l'USAGE, pas la mention : le mot survit légitimement dans les
      // phrases qui l'interdisent (« NOT a guarantee of total proceeds »,
      // « yields no proceeds figure »). Retirer les littéraux de chaîne isole
      // ce qui compte — un identifiant lu ou écrit.
      const exe = code
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``");
      expect(exe).not.toMatch(/\bproceeds\b/); // 🔴
    }
  });

  // ═══ G3 — LA PROMOTION ═════════════════════════════════════════════════
  it("PROMOTION : un SELL passé par le garde porte PRIMARY_OBSERVATION", () => {
    const r = run([tx({
      tokenTransfers: [sortie(POOL), { mint: WSOL, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 12 }],
    })]);
    const e = r.events[0];
    expect(e.type).toBe("SELL");
    expect(e.evidenceProvenance.basis).toBe("swap_counter_asset_same_tx");
    expect(e.rowNature).toBe("PRIMARY_OBSERVATION");
  });

  it("PROMOTION : tout SELL implique une contrepartie démontrée — jamais l'inverse", () => {
    const cas: ExitCandidateTx[] = [
      tx({ signature: "a", tokenTransfers: [sortie(POOL)] }),
      tx({ signature: "b", tokenTransfers: [sortie(POOL), { mint: WSOL, fromUserAccount: TIERS, toUserAccount: SUBJ, tokenAmount: 9 }] }),
      tx({ signature: "c", tokenTransfers: [sortie(POOL), { mint: WSOL, fromUserAccount: POOL, toUserAccount: SUBJ, tokenAmount: 9 }] }),
      tx({ signature: "d", tokenTransfers: [sortie(POOL)],
           nativeTransfers: [{ fromUserAccount: ATA, toUserAccount: SUBJ, amount: 7 }],
           tokenBalanceChanges: [{ userAccount: SUBJ, tokenAccount: ATA, mint: MINT }] }),
    ];
    for (const e of run(cas).events) {
      if (e.type === "SELL") {
        expect(e.observedCounterpartyAsset).not.toBeNull();
        expect(e.evidenceProvenance.basis).toBe("swap_counter_asset_same_tx");
        expect(e.rowNature).toBe("PRIMARY_OBSERVATION");
      } else {
        expect(e.observedCounterpartyAsset).toBeNull();
        expect(e.evidenceProvenance.basis).not.toBe("swap_counter_asset_same_tx");
      }
    }
    expect(run(cas).events.filter((e) => e.type === "SELL")).toHaveLength(1);
  });
});
