// --- BUILD 7 / S1 — LES ADAPTATEURS CONTRE LES VRAIS MOTEURS --------------
//
// Ces tests n'utilisent AUCUN faux objet de sortie : ils font tourner Funding
// Graph, Coordinated Exit et PRE-SHILL pour de vrai (purs, sans réseau), puis
// passent LEUR sortie aux adaptateurs. C'est ce qui distingue un contrat qui
// tient d'un contrat qui a l'air de tenir.

import { describe, expect, it } from "vitest";
import {
  buildFundingSnapshot,
  qualifyFundingRelationship,
  type FundingEdge,
  type TransferBearingTx,
} from "@/lib/funding-graph";
import {
  observeCoExit,
  qualifyCoExit,
  summarizeCoverage,
  COORDINATED_EXIT_EXTRACT_VERSION,
  type ExitEvent,
} from "@/lib/coordinated-exit";
import { computeRecurrence } from "@/lib/pre-shill/frontRun";
import { resolvePostAnchor } from "@/lib/shill-correlation/timeAnchor";
import { SHILL_EVENT_POLICY_VERSION } from "@/lib/shill-correlation/eventNature";
import {
  SHILL_FORWARD_BRIDGE_POLICY_VERSION,
  compareFeature,
  completeCoverage,
  observationsFromAnchor,
  observationsFromCoExit,
  observationsFromFrontRun,
  observationsFromFundingRelationships,
  observationsFromFundingSnapshot,
  observationsFromTokenIdentity,
  type FeatureObservation,
} from "..";

const byKey = (obs: FeatureObservation[], key: string) => {
  const o = obs.find((x) => x.featureKey === key);
  if (!o) throw new Error(`observation absente : ${key}`);
  return o;
};

it("la constante recopiée reste identique à celle du bridge", () => {
  // Recopiée plutôt qu'importée pour garder les adaptateurs purs ; vérifiée
  // ici, pour que la copie ne dérive pas en silence.
  expect(SHILL_FORWARD_BRIDGE_POLICY_VERSION).toBe(SHILL_EVENT_POLICY_VERSION);
});

// ═══ COORDINATED EXIT ═════════════════════════════════════════════════════

function transfer(subject: string, t: number, sig: string, venue: string | null): ExitEvent {
  return {
    subjectWallet: subject,
    mint: "MINT-1",
    type: "OUTGOING_TRANSFER",
    amount: 1_000n,
    blockTimeSeconds: t,
    txSignature: sig,
    destination: "DEST-1",
    venue,
    observedCounterpartyAsset: null,
    observedCounterpartyAmount: null,
    observedCounterpartyMeaning: null,
    rowNature: "PRIMARY_OBSERVATION",
    evidenceProvenance: {
      rule: COORDINATED_EXIT_EXTRACT_VERSION,
      basis: "token_leaves_wallet_no_counter_asset",
      source: venue,
      indexerType: "TRANSFER",
    },
  };
}

const FULL_COVERAGE = summarizeCoverage(
  { subjectsAttempted: 2, subjectsCovered: 2, complete: true },
  { transactionsSeen: 2, historyExhausted: true, censoredBy: null },
  { observedActCount: 2, materializedEventCount: 2, complete: true, reason: null },
);

const CUT_COVERAGE = summarizeCoverage(
  { subjectsAttempted: 5, subjectsCovered: 2, complete: false },
  { transactionsSeen: 2, historyExhausted: false, censoredBy: "plafond de pages" },
  { observedActCount: 2, materializedEventCount: 2, complete: true, reason: null },
);

function coExitObservations(venue: string | null, coverage = FULL_COVERAGE) {
  const events = [transfer("W1", 1000, "sig-a", venue), transfer("W2", 1030, "sig-b", venue)];
  const obs = observeCoExit({ events, windowSeconds: 60, coverage });
  if (!obs.observed) throw new Error("le groupe attendu n'a pas été observé");
  const characterisation = qualifyCoExit({ group: obs.groups[0], coverage });
  return observationsFromCoExit(characterisation, obs.groups[0]);
}

describe("observationsFromCoExit", () => {
  it("porte la fenêtre en PARAMÈTRE DE MÉTHODE, pas dans les valeurs", () => {
    const obs = coExitObservations("RAYDIUM");
    const cat = byKey(obs, "exit.cluster_category");
    expect(cat.state).toBe("OBSERVED");
    expect(cat.value).toEqual({ kind: "CATEGORICAL", value: "NARROW_WINDOW_CLUSTER" });
    expect(cat.method.parameters.windowSeconds).toBe(60);
    // Les signatures voyagent : la comparaison restera contestable sur pièces.
    expect(cat.evidence.find((e) => e.kind === "tx_signature")?.refs).toEqual(["sig-a", "sig-b"]);
  });

  it("un venue non unanime devient NOT_OBSERVED, jamais une valeur vide", () => {
    const obs = coExitObservations(null);
    const v = byKey(obs, "exit.demonstrated_venue");
    expect(v.state).toBe("NOT_OBSERVED");
    expect(v.value).toBeNull();
    expect(v.stateReason).toMatch(/unanime/);
  });

  it("la matérialité reste NOT_MEASURABLE — pas une catégorie qui se comparerait", () => {
    // Le piège exact : deux sujets « non mesurables » ne doivent PAS se
    // ressembler. C'est un état, donc NOT_COMPARABLE.
    const a = byKey(coExitObservations("RAYDIUM"), "exit.materiality");
    const b = byKey(coExitObservations("ORCA"), "exit.materiality");
    expect(a.state).toBe("NOT_MEASURABLE");
    const r = compareFeature(
      "exit.materiality",
      { subjectRef: "A", observation: a },
      { subjectRef: "B", observation: b },
    );
    expect(r.verdict).toBe("NOT_COMPARABLE");
  });

  it("les trois couvertures de sortie sont traduites SANS être aplaties", () => {
    const obs = coExitObservations("RAYDIUM", CUT_COVERAGE);
    const cat = byKey(obs, "exit.cluster_category");
    expect(cat.coverage.complete).toBe(false);
    // Le booléen sert à l'invariant ; le détail reste lisible en amont.
    expect(cat.coverage.censoredBy).toContain("sujets 2/5");
    expect(cat.coverage.censoredBy).toContain("historique de transactions");
    expect(cat.coverage.upstream).toEqual({ exitCoverage: CUT_COVERAGE });

    // Et un écart, sous cette couverture, n'est PAS affirmé.
    const other = coExitObservations("ORCA", CUT_COVERAGE);
    const r = compareFeature(
      "exit.demonstrated_venue",
      { subjectRef: "A", observation: byKey(obs, "exit.demonstrated_venue") },
      { subjectRef: "B", observation: byKey(other, "exit.demonstrated_venue") },
    );
    expect(r.verdict).toBe("NOT_COMPARABLE");
    expect(r.basis.reasonCode).toBe("COVERAGE_CENSORED_NEGATIVE_WITHHELD");
  });
});

// ═══ FUNDING GRAPH ════════════════════════════════════════════════════════

function tx(sig: string, from: string, to: string, lamports: number): TransferBearingTx {
  return {
    signature: sig,
    timestamp: 1_700_000_000,
    nativeTransfers: [{ fromUserAccount: from, toUserAccount: to, amount: lamports }],
  };
}

describe("observationsFromFundingSnapshot", () => {
  const SUBJECTS = ["W1", "W2"];

  it("rend l'ensemble des bailleurs partagés, avec leurs signatures", () => {
    const snapshot = buildFundingSnapshot({
      subjects: SUBJECTS,
      txs: [tx("s1", "FUNDER-A", "W1", 5_000_000), tx("s2", "FUNDER-A", "W2", 5_000_000)],
    });
    const obs = observationsFromFundingSnapshot(snapshot, completeCoverage({ scope: "test" }));
    const funders = byKey(obs, "funding.shared_funder_addresses");
    expect(funders.state).toBe("OBSERVED");
    expect(funders.value).toEqual({ kind: "SET", values: ["FUNDER-A"] });
    expect(funders.evidence.find((e) => e.kind === "tx_signature")?.refs).toEqual(["s1", "s2"]);
    expect(funders.nature).toBe("PRIMARY_OBSERVATION");
  });

  it("« aucun bailleur atteignant deux sujets » reste NOT_OBSERVED, avec son motif", () => {
    const snapshot = buildFundingSnapshot({
      subjects: SUBJECTS,
      txs: [tx("s1", "FUNDER-A", "W1", 5_000_000)],
    });
    const funders = byKey(
      observationsFromFundingSnapshot(snapshot, completeCoverage({ scope: "test" })),
      "funding.shared_funder_addresses",
    );
    expect(funders.state).toBe("NOT_OBSERVED");
    expect(funders.stateReason).toContain("NOT_OBSERVED/no_funder_reaching_two_subjects");
    // `edgesConsidered` dit sur quoi l'observation a porté — c'est ce chiffre
    // qui doit être lu, pas l'absence.
    expect(funders.stateReason).toContain("arête(s) considérée(s)");
  });

  it("deux absences ne se ressemblent pas", () => {
    const empty = buildFundingSnapshot({ subjects: SUBJECTS, txs: [] });
    const o = byKey(
      observationsFromFundingSnapshot(empty, completeCoverage({ scope: "test" })),
      "funding.shared_funder_addresses",
    );
    const r = compareFeature(
      "funding.shared_funder_addresses",
      { subjectRef: "A", observation: o },
      { subjectRef: "B", observation: o },
    );
    expect(r.verdict).toBe("NOT_COMPARABLE");
  });
});

describe("observationsFromFundingRelationships", () => {
  const edge = (funder: string, to: string, sig: string, lamports: number): FundingEdge => ({
    fromWallet: funder,
    toWallet: to,
    asset: "SOL",
    amountLamports: lamports,
    txSignature: sig,
    blockTimeSeconds: 1_700_000_000,
    rowNature: "PRIMARY_OBSERVATION",
  });

  it("garde les catégories démontrées", () => {
    const q = qualifyFundingRelationship({
      funder: "FUNDER-A",
      subjectsReached: ["W1", "W2"],
      edges: [edge("FUNDER-A", "W1", "s1", 5_000_000), edge("FUNDER-A", "W2", "s2", 5_000_000)],
      coverage: { complete: true },
    });
    expect(q.category).toBe("PRIVATE_SHARED_FUNDER");
    const o = observationsFromFundingRelationships([q])[0];
    expect(o.value).toEqual({ kind: "SET", values: ["PRIVATE_SHARED_FUNDER"] });
    expect(o.method.methodRef).toBe("funding-relationship/qualify@v1");
  });

  it("ÉCARTE UNKNOWN — « le qualificateur n'a pas su trancher » n'est pas une ressemblance", () => {
    const q = qualifyFundingRelationship({
      funder: "FUNDER-B",
      subjectsReached: ["W1"],
      edges: [edge("FUNDER-B", "W1", "s3", 5_000_000)],
      coverage: { complete: true },
    });
    expect(q.category).toBe("UNKNOWN");
    const o = observationsFromFundingRelationships([q])[0];
    expect(o.state).toBe("NOT_OBSERVED");
    expect(o.stateReason).toContain("toutes en UNKNOWN");

    const r = compareFeature(
      "funding.relationship_categories",
      { subjectRef: "A", observation: o },
      { subjectRef: "B", observation: o },
    );
    expect(r.verdict).toBe("NOT_COMPARABLE");
  });

  it("une seule relation censurée fait de l'ensemble un plancher", () => {
    const q = qualifyFundingRelationship({
      funder: "FUNDER-A",
      subjectsReached: ["W1", "W2"],
      edges: [edge("FUNDER-A", "W1", "s1", 5_000_000), edge("FUNDER-A", "W2", "s2", 5_000_000)],
      coverage: { complete: false, censoredBy: "budget de collecte" },
    });
    const o = observationsFromFundingRelationships([q])[0];
    expect(o.coverage.complete).toBe(false);
    expect(o.coverage.censoredBy).toBe("budget de collecte");
  });
});

// ═══ PRE-SHILL — EXPÉRIMENTAL ═════════════════════════════════════════════

describe("observationsFromFrontRun", () => {
  const at = (d: string) => new Date(d);
  const observations = [
    { wallet: "W1", occasionId: "o1", kolHandle: "k1", observedAt: at("2026-01-01T00:00:00Z") },
    { wallet: "W1", occasionId: "o2", kolHandle: "k2", observedAt: at("2026-01-02T00:00:00Z") },
    { wallet: "W1", occasionId: "o3", kolHandle: "k2", observedAt: at("2026-01-03T00:00:00Z") },
    { wallet: "W2", occasionId: "o1", kolHandle: "k1", observedAt: at("2026-01-01T00:00:00Z") },
  ];

  it("porte les SEUILS en paramètres de méthode, et reste expérimental", () => {
    const rec = [...computeRecurrence(observations).values()];
    const o = observationsFromFrontRun(rec, ["o1", "o2", "o3"], completeCoverage({}))[0];
    expect(o.state).toBe("OBSERVED");
    expect(o.value).toEqual({ kind: "SET", values: ["W1"] });
    expect(o.experimental).toBe(true);
    expect(o.method.parameters).toEqual({
      minOccasions: 3,
      minDistinctKols: 2,
      preWindowSeconds: 600,
    });
  });

  it("deux corpus évalués sous deux seuils ne se comparent pas", () => {
    const rec = [...computeRecurrence(observations).values()];
    const strict = [...computeRecurrence(observations, 2, 2).values()];
    const a = observationsFromFrontRun(rec, ["o1"], completeCoverage({}))[0];
    const b = observationsFromFrontRun(strict, ["o1"], completeCoverage({}), {
      minOccasions: 2,
    })[0];
    const r = compareFeature(
      "preshill.front_run_wallets",
      { subjectRef: "A", observation: a },
      { subjectRef: "B", observation: b },
    );
    expect(r.verdict).toBe("NOT_COMPARABLE");
    expect(r.basis.reasonCode).toBe("METHOD_MISMATCH");
  });
});

// ═══ IDENTITÉ ET ANCRE ════════════════════════════════════════════════════

describe("identité et ancre temporelle", () => {
  it("une chaîne non démontrable est NOT_OBSERVED, jamais « une autre chaîne »", () => {
    const obs = observationsFromTokenIdentity(
      {
        tokenMint: "0x1111111111111111111111111111111111111111",
        chain: null,
        resolutionStatus: "resolved_direct",
        ticker: null,
        evidence: "adresse EVM",
      },
      [{ kind: "post_id", refs: ["p1"] }],
    );
    expect(byKey(obs, "identity.chain_demonstrated").state).toBe("NOT_OBSERVED");
    expect(byKey(obs, "identity.token_resolution_status").value).toEqual({
      kind: "CATEGORICAL",
      value: "resolved_direct",
    });
  });

  it("l'ancre rend sa PROVENANCE, pas l'instant", () => {
    const anchor = resolvePostAnchor({ tweetId: "1730000000000000000" });
    const o = observationsFromAnchor(anchor, [{ kind: "post_id", refs: ["p1"] }])[0];
    expect(o.value).toEqual({ kind: "CATEGORICAL", value: "snowflake" });
    // Aucun instant ne sort : comparer des dates absolues entre deux affaires
    // n'aurait aucun sens, et exigerait une fenêtre qu'on refuse de poser.
    expect(JSON.stringify(o)).not.toContain("2024-");
  });
});
