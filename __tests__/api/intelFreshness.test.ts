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

  it("aucune cadence infra-quotidienne — le plan Vercel est Hobby, le deploy échouerait", () => {
    for (const c of vercel().crons as Array<{ schedule: string; path: string }>) {
      const [minute, hour] = c.schedule.split(" ");
      expect(hour, `${c.path} a une cadence horaire`).not.toBe("*");
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
