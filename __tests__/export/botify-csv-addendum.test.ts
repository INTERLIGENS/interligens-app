// ─── BUILD 10 / ADDENDUM CSV — LE CHEMIN JSON PASSE PAR LES MÊMES GATES ───
//
// #296 a fermé le chemin BASE. Deux défauts subsistaient sur le chemin JSON,
// qui contournait ces gates :
//
//   A · DT-1 publiait une ADRESSE et un MONTANT sans PUBLISHABLE_WALLET_FILTER
//       ni redactProceeds. La sortie mesurée était propre — par chance.
//   B · les 8 claims du JSON portent status "CONFIRMED" ; l'état canonique
//       mesuré des 8 mêmes claims (CaseFileClaim, IL-SHILL-BOTIFY-001,
//       2026-09-08) est ATTACHED. L'export relevait l'état.
//
// #296 reste clos : ce fichier AJOUTE, il ne rejoue pas sa preuve.

import { describe, it, expect } from "vitest";
import {
  buildBotifyEvidenceRows,
  canonicalClaimStatus,
  rowsToCsv,
  STATUS_NOT_ESTABLISHED,
  AMOUNT_WITHHELD,
  AMOUNT_NOT_MEASURED,
  type BotifyCase,
  type DbEnrichment,
} from "@/scripts/export/botifySpreadsheet";
import { ARTIFACT_STATES } from "@/lib/casefile/publicationState";

const ADRESSE = "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj";
const AUTRE = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

const CAS = {
  case_meta: { case_id: "CASE-2024-BOTIFY-001" },
  claims: [
    { claim_id: "C1", title: "un", severity: "HIGH", status: "CONFIRMED", evidence_refs: [] },
    { claim_id: "C2", title: "deux", severity: "LOW", status: "CONFIRMED", evidence_refs: [] },
  ],
  detective_trade: { wallet: ADRESSE, buy_tx: "B1", sell_tx: "S1", pnl_usd: 642749.95 },
} as unknown as BotifyCase;

const VIDE: DbEnrichment = { wallets: [], proceeds: [] };
const dt = (db: DbEnrichment) => buildBotifyEvidenceRows(CAS, db).find((r) => r.claimNo === "DT-1")!;

// ───────────────────────────── ADDENDUM A ─────────────────────────────────

describe("A · DT-1 — l'adresse ne sort que si la gate l'a laissée passer", () => {
  it("adresse ABSENTE de la liste publiable → ni colonne, ni URL de preuve", () => {
    const r = dt(VIDE);
    expect(r.wallets).toBe("");
    expect(r.evidenceUrl).toBe("");
  });

  it("MUTANT · gate retirée → l'adresse ressortirait dans le CSV entier", () => {
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS, VIDE));
    expect(csv).not.toContain(ADRESSE);
  });

  it("une AUTRE adresse publiable n'autorise pas celle de DT-1", () => {
    const db: DbEnrichment = {
      ...VIDE,
      wallets: [{ handle: "x", address: AUTRE, label: "", proceedsPublication: "published" }],
    };
    expect(dt(db).wallets).toBe("");
  });

  it("MUTANT DE SUR-CORRECTION · une adresse RÉELLEMENT publiable n'est PAS omise", () => {
    const db: DbEnrichment = {
      ...VIDE,
      wallets: [{ handle: "x", address: ADRESSE, label: "", proceedsPublication: "published" }],
    };
    const r = dt(db);
    expect(r.wallets).toBe(ADRESSE);
    expect(r.evidenceUrl).toBe(`https://solscan.io/account/${ADRESSE}`);
  });

  it("les hashes de transaction ne sont pas touchés — la gate porte sur l'identité", () => {
    expect(dt(VIDE).txHashes).toBe("B1; S1");
  });
});

describe("A · DT-1 — le montant passe par la gate monétaire canonique", () => {
  it("sans porteur démontré → WITHHELD, le motif et jamais le chiffre", () => {
    const r = dt(VIDE);
    expect(r.amountUsd).toBe(AMOUNT_WITHHELD);
    expect(r.amountUsd).not.toContain("642749");
  });

  it("MUTANT DE SUR-CORRECTION · le montant retiré ne devient JAMAIS 0 ni vide", () => {
    const r = dt(VIDE);
    expect(r.amountUsd).not.toBe("0");
    expect(r.amountUsd).not.toBe("");
    expect(r.amountUsd).not.toBe("null");
    expect(Number.isFinite(Number(r.amountUsd))).toBe(false);
  });

  it("porteur WITHDRAWN → WITHHELD, même si l'adresse est publiable", () => {
    const db: DbEnrichment = {
      ...VIDE,
      wallets: [{ handle: "x", address: ADRESSE, label: "", proceedsPublication: "withdrawn" }],
    };
    expect(dt(db).amountUsd).toBe(AMOUNT_WITHHELD);
  });

  it("MUTANT DE SUR-CORRECTION · porteur PUBLISHED → le montant sort tel quel", () => {
    const db: DbEnrichment = {
      ...VIDE,
      wallets: [{ handle: "x", address: ADRESSE, label: "", proceedsPublication: "published" }],
    };
    expect(dt(db).amountUsd).toBe("642749.95");
  });

  it("aucun montant dans le JSON → NOT_MEASURED, distinct de WITHHELD", () => {
    const sans = { ...CAS, detective_trade: { wallet: ADRESSE, buy_tx: "B1" } } as unknown as BotifyCase;
    const r = buildBotifyEvidenceRows(sans, VIDE).find((x) => x.claimNo === "DT-1")!;
    expect(r.amountUsd).toBe(AMOUNT_NOT_MEASURED);
    expect(r.amountUsd).not.toBe(AMOUNT_WITHHELD);
  });

  it("le CSV entier ne porte jamais le montant contourné", () => {
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS, VIDE));
    expect(csv).not.toContain("642749.95");
    expect(csv).not.toContain("642749");
  });
});

// ───────────────────────────── ADDENDUM B ─────────────────────────────────

describe("B · Status porte l'état canonique, jamais le CONFIRMED legacy", () => {
  const db: DbEnrichment = { ...VIDE, claimStates: { C1: "ATTACHED", C2: "PUBLIC" } };

  it("l'état canonique mesuré est rendu tel quel", () => {
    const rows = buildBotifyEvidenceRows(CAS, db);
    expect(rows.find((r) => r.claimNo === "C1")!.status).toBe("ATTACHED");
    expect(rows.find((r) => r.claimNo === "C2")!.status).toBe("PUBLIC");
  });

  it("MUTANT · le littéral CONFIRMED du JSON ne reparaît nulle part", () => {
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS, db));
    expect(csv).not.toContain("CONFIRMED");
  });

  it("MUTANT · état non démontré → NOT_ESTABLISHED, ni inféré ni legacy", () => {
    const rows = buildBotifyEvidenceRows(CAS, { ...VIDE, claimStates: { C1: "ATTACHED" } });
    const c2 = rows.find((r) => r.claimNo === "C2")!;
    expect(c2.status).toBe(STATUS_NOT_ESTABLISHED);
    expect(c2.status).not.toBe("CONFIRMED");
    expect(ARTIFACT_STATES).not.toContain(c2.status as never);
  });

  it("table d'états absente → les DEUX claims en état non établi", () => {
    for (const r of buildBotifyEvidenceRows(CAS, VIDE).filter((x) => x.claimNo.startsWith("C"))) {
      expect(r.status).toBe(STATUS_NOT_ESTABLISHED);
    }
  });

  it("PAS onlyPublishable — un claim non qualifié garde SA LIGNE", () => {
    const rows = buildBotifyEvidenceRows(CAS, { ...VIDE, claimStates: { C1: "ATTACHED" } });
    expect(rows.filter((r) => r.claimNo.startsWith("C")).map((r) => r.claimNo)).toEqual(["C1", "C2"]);
  });

  it("MUTANT DE SUR-CORRECTION · ATTACHED n'est jamais promu en PUBLIC", () => {
    const rows = buildBotifyEvidenceRows(CAS, { ...VIDE, claimStates: { C1: "ATTACHED", C2: "ATTACHED" } });
    for (const r of rows.filter((x) => x.claimNo.startsWith("C"))) {
      expect(r.status).toBe("ATTACHED");
      expect(r.status).not.toBe("PUBLIC");
      expect(r.status).not.toBe("ADMISSIBLE");
    }
  });

  it("NOT_ESTABLISHED n'est ni vide, ni un état canonique déguisé", () => {
    expect(STATUS_NOT_ESTABLISHED.trim().length).toBeGreaterThan(0);
    expect(STATUS_NOT_ESTABLISHED).toContain("NOT_ESTABLISHED");
    for (const e of ARTIFACT_STATES) expect(STATUS_NOT_ESTABLISHED).not.toBe(e);
  });

  it("canonicalClaimStatus n'accepte aucun repli", () => {
    expect(canonicalClaimStatus("C9", { C1: "PUBLIC" })).toBe(STATUS_NOT_ESTABLISHED);
    expect(canonicalClaimStatus("C1", undefined)).toBe(STATUS_NOT_ESTABLISHED);
    expect(canonicalClaimStatus("C1", { C1: "ADMISSIBLE" })).toBe("ADMISSIBLE");
  });
});
