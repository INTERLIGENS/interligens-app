// --- BUILD 4 / A — le détecteur front-run -------------------------------
//
// Ce que ces tests tiennent : les seuils sont FIGÉS, le backtest est
// réellement hors échantillon, et la ventilation par KOL existe — un signal
// porté par un seul KOL n'est pas un signal, c'est la description d'un acteur.

import { describe, it, expect } from "vitest";
import {
  FRONT_RUN_RULE_VERSION, MIN_DISTINCT_KOLS, MIN_OCCASIONS,
  backtestByKol, backtestFrontRun, computeRecurrence,
  type PreTweetObservation,
} from "../frontRun";

const at = (d: string) => new Date(d);
const o = (wallet: string, occasionId: string, kolHandle: string, date: string): PreTweetObservation =>
  ({ wallet, occasionId, kolHandle, observedAt: at(date) });

describe("A - les seuils sont FIGÉS", () => {
  it("N=3 et M=2, et la version de règle les cite", () => {
    // Posés à partir de la distribution mesurée AVANT le backtest : 2 occasions
    // est le MODE (276 wallets), donc un seuil à 2 ne distingue rien.
    expect(MIN_OCCASIONS).toBe(3);
    expect(MIN_DISTINCT_KOLS).toBe(2);
    expect(FRONT_RUN_RULE_VERSION).toBe("pre-shill/front-run@v1");
  });
});

describe("A - récurrence", () => {
  it("compte des OCCASIONS distinctes, pas des observations", () => {
    // Deux achats du même wallet sur la même occasion sont UN positionnement.
    const obs = [
      o("W", "occ1", "kolA", "2026-06-01"), o("W", "occ1", "kolA", "2026-06-01"),
      o("W", "occ2", "kolB", "2026-06-02"),
    ];
    const r = computeRecurrence(obs).get("W")!;
    expect(r.occasions).toBe(2);
    expect(r.distinctKols).toBe(2);
    expect(r.qualifies).toBe(false); // 2 < N=3
  });

  it("un wallet lié à UN SEUL KOL ne qualifie pas, même très récurrent", () => {
    // Explication banale : il suit ce KOL. M=2 l'écarte.
    const obs = ["a","b","c","d","e"].map((x,i) => o("W", `occ${x}`, "kolA", `2026-06-0${i+1}`));
    const r = computeRecurrence(obs).get("W")!;
    expect(r.occasions).toBe(5);
    expect(r.distinctKols).toBe(1);
    expect(r.qualifies).toBe(false);
  });

  it("N=3 occasions ET M=2 KOL : les deux sont requis", () => {
    const obs = [
      o("W", "o1", "kolA", "2026-06-01"), o("W", "o2", "kolA", "2026-06-02"),
      o("W", "o3", "kolB", "2026-06-03"),
    ];
    expect(computeRecurrence(obs).get("W")!.qualifies).toBe(true);
  });
});

describe("A - le backtest est HORS ÉCHANTILLON", () => {
  const obs: PreTweetObservation[] = [
    o("W1","o1","kA","2026-06-01"), o("W1","o2","kA","2026-06-02"), o("W1","o3","kB","2026-06-03"),
    o("W2","o1","kA","2026-06-01"),
    o("W1","o4","kB","2026-06-10"), o("W3","o4","kB","2026-06-10"),
  ];

  it("aucun wallet n'est retenu grâce à une occasion de TEST", () => {
    // Sans cette séparation, on mesurerait la capacité à décrire le passé.
    const r = backtestFrontRun(obs, at("2026-06-05"));
    expect(r.split.trainOccasions).toBe(3);
    expect(r.split.testOccasions).toBe(1);
    expect(r.flagged).toBe(1); // W1 seulement
  });

  it("un wallet apparu APRÈS la coupure n'est jamais retenu", () => {
    // W3 n'existe qu'en test : il ne peut pas être « prédit ».
    const r = backtestFrontRun(obs, at("2026-06-05"));
    expect(r.flaggedTrials).toBe(1);
    expect(r.flaggedHits).toBe(1);
  });

  it("le dénominateur est l'ESSAI (wallet, occasion), pas l'occasion", () => {
    const r = backtestFrontRun(obs, at("2026-06-05"));
    expect(r.baseTrials).toBe(r.trainWallets * r.split.testOccasions);
  });

  it("sans occasion de test, aucune séparation n'est inventée", () => {
    const r = backtestFrontRun(obs, at("2027-01-01"));
    expect(r.split.testOccasions).toBe(0);
    expect(r.flaggedRate).toBe(0);
    expect(r.separation).toBeNull();
  });
});

describe("A - la ventilation par KOL est une GARDE", () => {
  it("un test porté par un seul KOL se voit dans la ventilation", () => {
    const obs: PreTweetObservation[] = [
      o("W1","o1","kA","2026-06-01"), o("W1","o2","kA","2026-06-02"), o("W1","o3","kB","2026-06-03"),
      o("W1","o4","kA","2026-06-10"),
    ];
    const byKol = backtestByKol(obs, at("2026-06-05"));
    expect(byKol.get("kA")!.split.testOccasions).toBe(1);
    expect(byKol.get("kB")!.split.testOccasions).toBe(0);
    const avecTest = [...byKol.values()].filter(v => v.split.testOccasions > 0);
    expect(avecTest).toHaveLength(1);
  });
});
