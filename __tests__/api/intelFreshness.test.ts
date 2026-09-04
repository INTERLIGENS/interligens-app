/**
 * __tests__/api/intelFreshness.test.ts
 *
 * TigerScore applique un floor sur match OFAC (scorer.ts) et matchEntity ne
 * filtre QUE sur listIsActive : aucune notion d'âge n'existe dans le calcul.
 * Mesuré le 2026-08-14 — une observation OFAC de 133 jours modifiait un score
 * en direct (80 → 72). La donnée périmée ne se voit nulle part dans le produit.
 *
 * Deux garde-fous en découlent, et ces tests les figent :
 *   1. l'ingestion réglementaire est planifiée ;
 *   2. la péremption est détectée et alertée.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";

const vercel = () => JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const watchdog = () => fs.readFileSync("src/scripts/watchdog/watcher-health.mjs", "utf8");

describe("ingestion réglementaire — planifiée", () => {
  it("OFAC a un cron", () => {
    const e = vercel().crons.find((c: { path: string }) => c.path === "/api/intelligence/ingest/ofac");
    expect(e).toBeDefined();
  });

  it("scamsniffer a son propre cron, séparé", () => {
    const e = vercel().crons.find((c: { path: string }) => c.path === "/api/intelligence/ingest/scamsniffer");
    expect(e).toBeDefined();
  });

  it("'all' n'est PAS planifié — mesure : ofac 148s + scamsniffer 196s = 344s > maxDuration 300s", () => {
    const all = vercel().crons.find((c: { path: string }) => c.path.endsWith("/ingest/all"));
    expect(all).toBeUndefined();
  });

  /**
   * CADENCE INFRA-QUOTIDIENNE — LISTE BLANCHE EXPLICITE.
   *
   * Cette garde portait « le plan Vercel est Hobby, le deploy échouerait ».
   * L'hypothèse est FAUSSE : le plan est Pro, confirmé le 2026-09-04, et les
   * crons sous-quotidiens y sont autorisés.
   *
   * La garde n'est pas levée pour autant, parce qu'elle protégeait deux choses
   * et que la seconde tient toujours : une cadence infra-quotidienne multiplie
   * la charge — et, pour une route qui dépense, la facture. Elle doit rester un
   * choix EXPLICITE, pas une valeur qu'on pose sans y penser.
   *
   * Le motif change donc de nature : ce n'est plus « le plan l'interdit » mais
   * « nommez la route et dites pourquoi ». Ajouter une entrée ici est un acte
   * de revue ; en oublier une fait échouer la suite.
   */
  const SUB_DAILY_ALLOWED: Record<string, string> = {
    "/api/cron/shill-feed":
      "Helius-free — coût marginal = une requête base. Suit le watcher au plus " +
      "près pour que le feed ne prenne pas 24 h de retard sur la capture sociale.",
  };

  it("une cadence infra-quotidienne est NOMMÉE, jamais implicite", () => {
    for (const c of vercel().crons as Array<{ schedule: string; path: string }>) {
      const [minute, hour] = c.schedule.split(" ");
      const subDaily = hour === "*" || hour.includes("/") || minute.includes("/");
      if (!subDaily) continue;
      expect(
        SUB_DAILY_ALLOWED[c.path],
        `${c.path} a une cadence infra-quotidienne sans justification déclarée`,
      ).toBeDefined();
    }
  });

  it("le feed est horaire, le shadow reste quotidien — deux coûts, deux cadences", () => {
    // Le shadow DÉPENSE : 100 000 crédits Helius par passage. Le passer en
    // horaire multiplierait la facture par 24 sans qu'aucune ligne ne l'annonce.
    const crons = vercel().crons as Array<{ schedule: string; path: string }>;
    const feed = crons.find((c) => c.path === "/api/cron/shill-feed");
    const shadow = crons.find((c) => c.path === "/api/cron/shill-shadow");
    expect(feed?.schedule).toBe("0 * * * *");
    expect(shadow?.schedule).toBe("0 7 * * *");
    expect(shadow!.schedule.split(" ")[1]).not.toBe("*");
  });

  it("aucune cadence sous-horaire — même sur la liste blanche", () => {
    // Le pas de minute reste interdit partout : une route qui tourne toutes
    // les cinq minutes est un choix d'architecture, pas un réglage de cadence.
    for (const c of vercel().crons as Array<{ schedule: string; path: string }>) {
      const minute = c.schedule.split(" ")[0];
      expect(minute.includes("/"), `${c.path} a une cadence sous-horaire`).toBe(false);
    }
  });
});

describe("détection de péremption — watchdog", () => {
  it("un seuil d'âge existe par source", () => {
    expect(watchdog()).toContain("INTEL_MAX_AGE_DAYS");
  });

  it("les sources réglementaires ont un seuil plus serré que le défaut", () => {
    const s = watchdog();
    const def = Number(s.match(/INTEL_MAX_AGE_DAYS_DEFAULT = parseInt\([^?]*\?\?\s*"(\d+)"/)![1]);
    const ofac = Number(s.match(/ofac: parseInt\([^?]*\?\?\s*"(\d+)"/)![1]);
    expect(ofac).toBeLessThan(def);
  });

  it("une source réglementaire périmée est CRITIQUE, pas un simple warn", () => {
    const s = watchdog();
    const bloc = s.slice(s.indexOf("staleTier1"), s.indexOf("staleOther"));
    expect(bloc).toContain('severity: "crit"');
  });

  it("un intel vault vide est traité, pas seulement un vault vieux", () => {
    expect(watchdog()).toContain("intel_empty");
  });

  it("les batches d'ingestion bloqués en 'running' sont détectés", () => {
    const s = watchdog();
    expect(s).toContain("intel_zombie_batch");
    expect(s).toContain("status = 'running'");
  });
});
