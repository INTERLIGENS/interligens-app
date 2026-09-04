// --- G2 — LES GATES MUTATION DE LA CO-SORTIE -------------------------------

import { describe, it, expect } from "vitest";
import {
  MissingCoExitWindowError,
  observeCoExit,
  summarizeCoverage,
  type ExitCoverage,
  type ExitEvent,
} from "../index";

const A = "WalletAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "WalletBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const C = "WalletCccccccccccccccccccccccccccccccccccc";
const MINT = "MintDddddddddddddddddddddddddddddddddddddd";
const T0 = 1_737_590_000;

const ev = (
  subject: string, at: number, p: Partial<ExitEvent> = {},
): ExitEvent => ({
  subjectWallet: subject, mint: MINT, type: "SELL", amount: 100n,
  blockTimeSeconds: at, txSignature: `sig-${subject.slice(0, 7)}-${at}`,
  destination: null, venue: null, proceeds: { mint: "native", amount: 1 },
  rowNature: "PRIMARY_OBSERVATION",
  evidenceProvenance: {
    rule: "coordinated-exit/extract@v1", basis: "swap_counter_asset_same_tx",
    source: null, indexerType: null,
  },
  ...p,
});

const COMPLETE: ExitCoverage = summarizeCoverage(
  { subjectsAttempted: 3, subjectsCovered: 3, complete: true },
  { transactionsSeen: 300, historyExhausted: true, censoredBy: null },
  { observedActCount: 10, materializedEventCount: 10, complete: true, reason: null },
);
const CENSORED: ExitCoverage = summarizeCoverage(
  { subjectsAttempted: 15, subjectsCovered: 9, complete: false },
  { transactionsSeen: 200, historyExhausted: false, censoredBy: "page_cap" },
  { observedActCount: 46, materializedEventCount: 12, complete: false,
    reason: "PRIMARY_SIGNATURE_UNAVAILABLE" },
);

/**
 * Sérialise en retirant les IDENTIFIANTS DE RÈGLE.
 *
 * `coordinated-exit/co-exit@v1` contient « coordinat » parce que c'est le nom
 * du chantier — une adresse citable, pas une lecture de la donnée. Les garder
 * ferait rougir le test sur son propre en-tête et masquerait un vrai verdict
 * derrière un faux positif permanent.
 */
function stripRuleIds(x: unknown): string {
  // `amount` est un bigint — JSON.stringify le refuse. Le convertir en texte
  // plutôt que l'omettre : un champ absent du scan serait un champ non vérifié.
  let s = JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? `${v}n` : v)).toLowerCase();
  for (const id of ["coordinated-exit/co-exit@v1", "coordinated-exit/extract@v1"]) {
    s = s.split(id).join("");
  }
  return s;
}

describe("G2 - la fenêtre est un paramètre, pas un réglage implicite", () => {
  // ═══ MUTATION 1 — FENÊTRE PAR DÉFAUT SILENCIEUSE ═══════════════════════
  it("MUTATION : aucune fenêtre par défaut — la fonction REFUSE", () => {
    for (const bad of [undefined, null, NaN, Infinity, 0, -60, "600"]) {
      expect(() => observeCoExit({
        events: [ev(A, T0), ev(B, T0 + 10)],
        windowSeconds: bad as number, coverage: COMPLETE,
      })).toThrow(MissingCoExitWindowError); // 🔴 si un défaut s'appliquait
    }
  });

  it("le refus EXPLIQUE pourquoi un défaut serait un choix invisible", () => {
    try {
      observeCoExit({ events: [], windowSeconds: undefined as unknown as number, coverage: COMPLETE });
      expect.unreachable("aurait dû lever");
    } catch (e) {
      expect((e as Error).message).toContain("PARAMÈTRE OBLIGATOIRE");
      expect((e as Error).message).toContain("invisible");
    }
  });

  it("la fenêtre utilisée est RAPPORTÉE dans le résultat", () => {
    const r = observeCoExit({ events: [ev(A, T0), ev(B, T0 + 10)], windowSeconds: 600, coverage: COMPLETE });
    expect(r.windowSeconds).toBe(600);
  });

  // ═══ MUTATION 2 — CO-SORTIE AFFIRMÉE HORS FENÊTRE ══════════════════════
  it("MUTATION : aucune paire au-delà de la fenêtre fournie", () => {
    const dedans = observeCoExit({ events: [ev(A, T0), ev(B, T0 + 100)], windowSeconds: 120, coverage: COMPLETE });
    expect(dedans.observed).toBe(true);

    const dehors = observeCoExit({ events: [ev(A, T0), ev(B, T0 + 100)], windowSeconds: 60, coverage: COMPLETE });
    expect(dehors.observed).toBe(false); // 🔴 si 100 s passait sous une fenêtre de 60
    if (!dehors.observed) expect(dehors.reason).toBe("no_subjects_within_window");
  });

  it("le chaînage peut étirer un groupe, mais CHAQUE PAIRE reste dans la fenêtre", () => {
    // A(0) — B(50) — C(100) : span 100 > fenêtre 60, mais chaque saut vaut 50.
    const r = observeCoExit({
      events: [ev(A, T0), ev(B, T0 + 50), ev(C, T0 + 100)],
      windowSeconds: 60, coverage: COMPLETE,
    });
    expect(r.observed).toBe(true);
    if (!r.observed) return;
    const g = r.groups[0];
    expect(g.spanSeconds).toBe(100);
    // A↔C vaut 100 s : la paire est ÉCARTÉE, même si le groupe les contient.
    expect(g.pairs.every((p) => p.deltaSeconds <= 60)).toBe(true);
    expect(g.pairs.some((p) => p.deltaSeconds === 100)).toBe(false); // 🔴
  });

  it("un même wallet sortant deux fois n'est PAS une co-sortie", () => {
    const r = observeCoExit({ events: [ev(A, T0), ev(A, T0 + 5)], windowSeconds: 600, coverage: COMPLETE });
    expect(r.observed).toBe(false);
    if (!r.observed) expect(r.reason).toBe("fewer_than_two_subjects");
  });

  it("deux mints différents ne se groupent pas ensemble", () => {
    const r = observeCoExit({
      events: [ev(A, T0), ev(B, T0 + 5, { mint: "AutreMintZzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" })],
      windowSeconds: 600, coverage: COMPLETE,
    });
    expect(r.observed).toBe(false);
  });

  // ═══ MUTATION 3 — NOT_OBSERVED DÉGRADÉ EN VERDICT ══════════════════════
  it("MUTATION : NOT_OBSERVED ne devient JAMAIS « pas de coordination »", () => {
    const r = observeCoExit({ events: [ev(A, T0), ev(B, T0 + 5_000)], windowSeconds: 60, coverage: CENSORED });
    expect(r.observed).toBe(false);
    if (r.observed) return;
    expect(r.diagnostic).toBe("NOT_OBSERVED");
    // Les identifiants de RÈGLE portent le nom du chantier — c'est une adresse,
    // pas une affirmation sur la donnée. On les retire avant de scanner, sinon
    // le test attraperait le nom du module au lieu d'un verdict.
    const s = stripRuleIds(r);
    for (const forbidden of [
      "no_coordination", "pas de coordination", "not_coordinated", "no_co_exit",
      "clean", "innocent", "absent", "coordinat", "dump", "rug", "verdict",
    ]) {
      expect(s).not.toContain(forbidden); // 🔴
    }
    // …et l'échantillon interrogé est DIT : l'absence est bornée par lui.
    expect(r.eventsConsidered).toBe(2);
  });

  it("les trois motifs d'absence se distinguent", () => {
    const mk = (events: ExitEvent[], w: number) => observeCoExit({ events, windowSeconds: w, coverage: COMPLETE });
    const a = mk([], 60);
    if (!a.observed) expect(a.reason).toBe("no_events_provided");
    const b = mk([ev(A, T0), ev(A, T0 + 1)], 60);
    if (!b.observed) expect(b.reason).toBe("fewer_than_two_subjects");
    const c = mk([ev(A, T0), ev(B, T0 + 9_999)], 60);
    if (!c.observed) expect(c.reason).toBe("no_subjects_within_window");
  });

  // ═══ MUTATION 4 — COUVERTURE CENSURÉE RAPPORTÉE COMPLÈTE ═══════════════
  it("MUTATION : une couverture censurée ne se rapporte pas complète", () => {
    const r = observeCoExit({ events: [ev(A, T0), ev(B, T0 + 5)], windowSeconds: 60, coverage: CENSORED });
    expect(r.coverage.anyIncomplete).toBe(true); // 🔴
    expect(r.coverage.subjects.complete).toBe(false);
    expect(r.coverage.transactions.historyExhausted).toBe(false);
    expect(r.coverage.primaryEvidence.complete).toBe(false);
  });

  // ═══ MUTATION 5 — LES TROIS COUVERTURES FUSIONNÉES ═════════════════════
  it("MUTATION : les 3 couvertures restent SÉPARÉES et peuvent diverger", () => {
    // Sujets couverts, historique épuisé, mais preuve primaire incomplète :
    // un drapeau unique ne saurait pas dire lequel des trois manque.
    const mixte = summarizeCoverage(
      { subjectsAttempted: 4, subjectsCovered: 4, complete: true },
      { transactionsSeen: 50, historyExhausted: true, censoredBy: null },
      { observedActCount: 46, materializedEventCount: 12, complete: false,
        reason: "PRIMARY_SIGNATURE_UNAVAILABLE" },
    );
    expect(mixte.subjects.complete).toBe(true);
    expect(mixte.transactions.historyExhausted).toBe(true);
    expect(mixte.primaryEvidence.complete).toBe(false);
    expect(mixte.anyIncomplete).toBe(true);
    // Les trois sont lisibles séparément — le drapeau global ne les remplace pas.
    const r = observeCoExit({ events: [ev(A, T0), ev(B, T0 + 5)], windowSeconds: 60, coverage: mixte });
    expect(Object.keys(r.coverage).sort())
      .toEqual(["anyIncomplete", "primaryEvidence", "subjects", "transactions"]);
  });

  // ═══ MUTATION 6 — UN LABEL DE COORDINATION ÉMIS ════════════════════════
  it("MUTATION : une co-sortie OBSERVÉE ne porte aucun verdict", () => {
    const r = observeCoExit({
      events: [ev(A, T0, { venue: "PUMP_AMM" }), ev(B, T0 + 12, { venue: "PUMP_AMM" })],
      windowSeconds: 60, coverage: COMPLETE,
    });
    expect(r.observed).toBe(true);
    const s = stripRuleIds(r);
    for (const forbidden of ["coordinat", "dump", "rug", "scam", "insider", "intent",
                             "score", "severity", "risk", "verdict", "guilt"]) {
      expect(s).not.toContain(forbidden); // 🔴
    }
  });

  it("ce qui est rendu est FACTUEL : événements, deltas, venue si prouvé", () => {
    const r = observeCoExit({
      events: [ev(A, T0, { venue: "PUMP_AMM" }), ev(B, T0 + 12, { venue: "PUMP_AMM" })],
      windowSeconds: 60, coverage: COMPLETE,
    });
    if (!r.observed) return expect.unreachable("aurait dû observer");
    const g = r.groups[0];
    expect(g.subjects.sort()).toEqual([A, B].sort());
    expect(g.events).toHaveLength(2);
    expect(g.pairs).toHaveLength(1);
    expect(g.pairs[0].deltaSeconds).toBe(12);
    expect(g.pairs[0].sharedVenue).toBe("PUMP_AMM");
    expect(g.sharedVenue).toBe("PUMP_AMM");
    expect(g.earliestBlockTimeSeconds).toBe(T0);
    expect(g.latestBlockTimeSeconds).toBe(T0 + 12);
  });

  it("MUTATION : un venue commun n'est nommé que s'il est DÉMONTRÉ des deux côtés", () => {
    const partiel = observeCoExit({
      events: [ev(A, T0, { venue: "PUMP_AMM" }), ev(B, T0 + 12, { venue: null })],
      windowSeconds: 60, coverage: COMPLETE,
    });
    if (!partiel.observed) return expect.unreachable();
    expect(partiel.groups[0].pairs[0].sharedVenue).toBeNull(); // 🔴 si PUMP_AMM
    expect(partiel.groups[0].sharedVenue).toBeNull();

    const divergent = observeCoExit({
      events: [ev(A, T0, { venue: "PUMP_AMM" }), ev(B, T0 + 12, { venue: "JUPITER" })],
      windowSeconds: 60, coverage: COMPLETE,
    });
    if (!divergent.observed) return expect.unreachable();
    expect(divergent.groups[0].pairs[0].sharedVenue).toBeNull();
  });

  it("OUTGOING_TRANSFER et SELL coexistent sans être confondus dans un groupe", () => {
    const r = observeCoExit({
      events: [ev(A, T0, { type: "SELL" }), ev(B, T0 + 8, { type: "OUTGOING_TRANSFER", proceeds: null })],
      windowSeconds: 60, coverage: COMPLETE,
    });
    if (!r.observed) return expect.unreachable();
    expect(r.groups[0].events.map((e) => e.type).sort()).toEqual(["OUTGOING_TRANSFER", "SELL"]);
  });

  it("l'observation est déterministe", () => {
    const input = {
      events: [ev(A, T0), ev(B, T0 + 12)], windowSeconds: 60, coverage: COMPLETE,
    };
    expect(observeCoExit(input)).toEqual(observeCoExit(input));
  });

  it("le module n'importe ni prisma ni réseau", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const imports = readFileSync(join(dir, f), "utf8")
        .split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/prisma|@prisma\/client|helius|fetch|node-fetch/i);
    }
  });
});
