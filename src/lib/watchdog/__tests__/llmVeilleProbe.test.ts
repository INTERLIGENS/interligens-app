// ─── Sonde « Veille LLM » — jamais silencieuse ─────────────────────────────
//
// L'incident du 2026-08-27 tient en une phrase : un échec mesuré n'est jamais
// sorti nulle part. Ces tests verrouillent le contraire — quoi qu'il arrive, la
// sonde produit une ligne, et un modèle indisponible produit un marqueur rouge.

import { describe, it, expect } from "vitest";
import {
  LLM_MODEL_OFF_PATTERN,
  LLM_VEILLE_QUERY,
  countsFromRow,
  evaluateLlmVeille,
  type LlmVeilleCounts,
} from "../llmVeilleProbe";

const counts = (over: Partial<LlmVeilleCounts> = {}): LlmVeilleCounts => ({
  done: 560,
  pending: 6401,
  exhausted: 86,
  withError: 0,
  modelOff: 0,
  ...over,
});

describe("veille LLM — échec total du modèle", () => {
  it("un run en échec total porte le marqueur rouge", () => {
    const r = evaluateLlmVeille(counts({ withError: 247, modelOff: 247 }));
    expect(r.etat).toBe("FAILED");
    expect(r.problem).not.toBeNull();
    expect(r.problem?.severity).toBe("crit");
    expect(r.problem?.line).toContain("🔴");
    expect(r.problem?.line).toContain("MODÈLE LLM INDISPONIBLE");
    expect(r.problem?.line).toContain("247");
  });

  it("UN SEUL item suffit — un modèle mort l'est pour tout le monde", () => {
    const r = evaluateLlmVeille(counts({ withError: 1, modelOff: 1 }));
    expect(r.etat).toBe("FAILED");
    expect(r.problem?.severity).toBe("crit");
  });

  it("l'alerte nomme le fichier à corriger et la portée réelle", () => {
    // Le cron de veille n'est que le symptôme visible : l'assistant de dossier
    // et les synthèses passent par le même service.
    const r = evaluateLlmVeille(counts({ withError: 5, modelOff: 5 }));
    expect(r.problem?.line).toContain("llm.service.ts");
    expect(r.problem?.line).toMatch(/assistant|synthèses/);
  });
});

describe("veille LLM — les autres états", () => {
  it("des erreurs sans modèle mort → partiel, pas critique", () => {
    const r = evaluateLlmVeille(counts({ withError: 3, modelOff: 0 }));
    expect(r.etat).toBe("partial");
    expect(r.problem?.severity).toBe("warn");
    expect(r.problem?.line).toContain("⚠️");
  });

  it("file saine → aucun problème remonté", () => {
    const r = evaluateLlmVeille(counts());
    expect(r.etat).toBe("ok");
    expect(r.problem).toBeNull();
  });
});

describe("veille LLM — jamais silencieuse", () => {
  it.each([
    ["échec total", counts({ withError: 9, modelOff: 9 }), "FAILED"],
    ["partiel", counts({ withError: 2 }), "partial"],
    ["sain", counts(), "ok"],
    ["file vide", counts({ done: 0, pending: 0, exhausted: 0 }), "ok"],
  ])("%s → une ligne de résumé est TOUJOURS produite", (_l, c, etat) => {
    const r = evaluateLlmVeille(c as LlmVeilleCounts);
    expect(r.line).toContain("Veille LLM");
    expect(r.line).toContain(etat as string);
    expect(r.line).toMatch(/MODEL_NOT_FOUND/);
  });

  it("la ligne porte les compteurs mesurés, pas un résumé vague", () => {
    const r = evaluateLlmVeille(counts({ done: 560, pending: 6401, exhausted: 86, withError: 247, modelOff: 247 }));
    for (const n of ["560", "6401", "86", "247"]) expect(r.line).toContain(n);
  });
});

describe("veille LLM — les deux formats d'erreur en base", () => {
  const re = new RegExp(LLM_MODEL_OFF_PATTERN);

  it.each([
    ['MODEL_NOT_FOUND: NotFoundError:model', true, "format d'après le correctif"],
    ['Error:404 {"type":"error","error":{"type"', true, "format réellement en base (247 lignes)"],
    ["NotFoundError:model: claude-sonnet-4-20250514", true, "nom de classe SDK"],
    ['Error:400 {"type":"error"', false, "un 400 n'est pas un modèle mort"],
    ["RATE_LIMIT: 429", false, "un quota n'est pas un modèle mort"],
    ["timeout après 404 tentatives", false, "un 404 cité au milieu ne compte pas"],
  ])("%s → %s (%s)", (msg, expected) => {
    expect(re.test(msg as string)).toBe(expected as boolean);
  });
});

describe("veille LLM — la requête", () => {
  it("est en LECTURE SEULE", () => {
    expect(LLM_VEILLE_QUERY.trim().toUpperCase().startsWith("SELECT")).toBe(true);
    expect(LLM_VEILLE_QUERY).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  });

  it("normalise les entiers renvoyés en texte par pg", () => {
    const c = countsFromRow({ done: "560", pending: "6401", exhausted: "86", with_error: "247", model_off: "247" });
    expect(c).toEqual({ done: 560, pending: 6401, exhausted: 86, withError: 247, modelOff: 247 });
  });

  it("une ligne absente ne devient pas un silence — tout à zéro, état lisible", () => {
    const r = evaluateLlmVeille(countsFromRow(undefined));
    expect(r.etat).toBe("ok");
    expect(r.line).toContain("Veille LLM");
  });
});
