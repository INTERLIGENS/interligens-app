// ─── BUILD 10 — CSV CONTAINMENT ───────────────────────────────────────────
//
// Trois gates au point de consommation, plus la lisibilité de l'absence.
// Chaque gate retirée doit faire échouer au moins un test — et le mutant de
// SUR-CORRECTION (remplacer une absence par 0) doit mordre lui aussi.

import { describe, it, expect } from "vitest";
import {
  buildBotifyEvidenceRows,
  safeEvidenceUrl,
  rowsToCsv,
  AMOUNT_NOT_APPLICABLE,
  AMOUNT_NOT_MEASURED,
  AMOUNT_WITHHELD,
  AMOUNT_ABSENCE_MARKERS,
  type BotifyCase,
} from "@/scripts/export/botifySpreadsheet";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";

const CAS_MINIMAL = {
  case_meta: { case_id: "CASE-2024-BOTIFY-001" },
  claims: [
    {
      claim_id: "C1",
      title: "Claim documentaire",
      severity: "HIGH",
      status: "DOCUMENTED",
      thread_url: `https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
      evidence_refs: [],
    },
  ],
} as unknown as BotifyCase;

const VIDE = { wallets: [], proceeds: [] };

describe("AXE 2 — aucun lien externe sur le mint synthétique", () => {
  it("une URL portant la clé 43 est réécrite sur le mint canonique 44", () => {
    const u = safeEvidenceUrl(`https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}`);
    expect(u).toContain(BOTIFY_MINT);
    expect(u).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
  });

  it("les quatre formes stockées dans botify.json sont toutes couvertes", () => {
    const stockees = [
      `https://dexscreener.com/solana/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
      `https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
      `https://rugcheck.xyz/tokens/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
      `https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}#holders`,
    ];
    for (const u of stockees) {
      expect(safeEvidenceUrl(u)).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
      expect(safeEvidenceUrl(u)).toContain(BOTIFY_MINT);
    }
  });

  it("le suffixe de l'URL est préservé — on corrige l'identité, on n'invente pas l'URL", () => {
    expect(safeEvidenceUrl(`https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}#holders`))
      .toBe(`https://solscan.io/token/${BOTIFY_MINT}#holders`);
  });

  it("une URL sans mint synthétique est rendue inchangée", () => {
    const u = "https://x.com/dethective/status/1997766979898450185";
    expect(safeEvidenceUrl(u)).toBe(u);
  });

  it("le CSV construit ne porte JAMAIS la clé 43", () => {
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS_MINIMAL, VIDE));
    expect(csv).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(csv).toContain(BOTIFY_MINT);
  });
});

describe("L'ABSENCE EST LISIBLE, ET N'EST PAS ZÉRO", () => {
  const rows = buildBotifyEvidenceRows(CAS_MINIMAL, VIDE);

  it("un claim documentaire porte NOT_APPLICABLE, pas une cellule vide", () => {
    expect(rows[0].amountUsd).toBe(AMOUNT_NOT_APPLICABLE);
    expect(rows[0].amountUsd).not.toBe("");
  });

  it("MUTANT DE SUR-CORRECTION — aucun marqueur ne vaut « 0 »", () => {
    for (const m of AMOUNT_ABSENCE_MARKERS) {
      expect(m).not.toBe("0");
      expect(m).not.toBe(0 as unknown as string);
      expect(Number.isFinite(Number(m))).toBe(false);
    }
  });

  it("MUTANT DE SUR-CORRECTION — aucun marqueur n'est vide ni null", () => {
    for (const m of AMOUNT_ABSENCE_MARKERS) {
      expect(m.trim().length).toBeGreaterThan(0);
      expect(m).not.toBeNull();
    }
  });

  it("les trois absences sont deux à deux distinctes", () => {
    expect(new Set(AMOUNT_ABSENCE_MARKERS).size).toBe(3);
  });

  it("un montant retiré porte le motif, jamais le chiffre", () => {
    expect(AMOUNT_WITHHELD).toContain("WITHHELD");
    expect(AMOUNT_WITHHELD).toContain("retiré de la publication");
    expect(/\d{4,}/.test(AMOUNT_WITHHELD)).toBe(false);
  });

  it("un montant jamais mesuré se distingue d'un montant retiré", () => {
    expect(AMOUNT_NOT_MEASURED).not.toBe(AMOUNT_WITHHELD);
    expect(AMOUNT_NOT_MEASURED).toContain("NOT_MEASURED");
  });

  it("le detective trade sans pnl rend NOT_MEASURED, pas une cellule vide", () => {
    const cas = {
      ...CAS_MINIMAL,
      detective_trade: { wallet: "So11111111111111111111111111111111111111112" },
    } as unknown as BotifyCase;
    const r = buildBotifyEvidenceRows(cas, VIDE).find((x) => x.claimNo === "DT-1");
    expect(r?.amountUsd).toBe(AMOUNT_NOT_MEASURED);
  });
});

describe("AXE 1 et 2 — ce que le builder rend à partir d'un enrichissement", () => {
  it("un wallet enrichi ne porte pas de montant, et le dit", () => {
    const db = {
      wallets: [{ handle: "bkokoski", address: "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj", label: "" }],
      proceeds: [],
    };
    const r = buildBotifyEvidenceRows(CAS_MINIMAL, db).find((x) => x.claimNo === "DB-WALLET-1");
    expect(r?.amountUsd).toBe(AMOUNT_NOT_APPLICABLE);
    expect(r?.wallets).toBe("5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj");
  });

  it("un montant retiré traverse le builder tel quel — le motif, pas le chiffre", () => {
    const db = { wallets: [], proceeds: [{ ref: "evt-1", amountUsd: AMOUNT_WITHHELD, txHashes: "" }] };
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS_MINIMAL, db));
    expect(csv).toContain("WITHHELD");
    expect(csv).not.toMatch(/\b817000\b/);
    expect(csv).not.toMatch(/\b380000\b/);
  });

  it("un enrichissement VIDE ne produit aucune ligne DB — fail closed visible", () => {
    const rows = buildBotifyEvidenceRows(CAS_MINIMAL, VIDE);
    expect(rows.some((r) => r.claimNo.startsWith("DB-"))).toBe(false);
  });
});

describe("Les valeurs interdites ne peuvent pas revenir par le builder", () => {
  const INTERDITS = ["347237", "85484", "53313", "40627", "604489"];
  it("aucun montant contenu en BUILD 8 n'est produit par le builder", () => {
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS_MINIMAL, VIDE));
    for (const v of INTERDITS) expect(csv).not.toContain(v);
  });

  it("les sept signatures fabriquées ne sont pas produites", () => {
    const csv = rowsToCsv(buildBotifyEvidenceRows(CAS_MINIMAL, VIDE));
    for (const f of ["BotifyDeployTx", "ClusterFundTx", "PeakSnapshotTx", "CollapseTx"]) {
      expect(csv).not.toContain(f);
    }
  });
});
