// ─── Sonde « Veille LLM » — jamais silencieuse, jamais périmée ─────────────
//
// L'incident du 2026-08-27 tient en une phrase : un échec mesuré n'est jamais
// sorti nulle part. La première sonde a corrigé ça, puis commis la faute
// symétrique — crier la panne à partir d'un backlog vieux de deux mois, alors
// que le modèle répondait à nouveau. Ces tests verrouillent les deux sens :
// le rouge sort sur une panne RÉELLE, et seulement là.

import { describe, it, expect } from "vitest";
import {
  LLM_MODEL_OFF_PATTERN,
  LLM_VEILLE_QUERY,
  countsFromRow,
  classifyLiveProbe,
  evaluateLlmVeille,
  type LlmVeilleCounts,
  type LlmLiveProbe,
} from "../llmVeilleProbe";

const counts = (over: Partial<LlmVeilleCounts> = {}): LlmVeilleCounts => ({
  done: 590,
  pending: 6371,
  exhausted: 86,
  withError: 0,
  modelOff: 0,
  ...over,
});

const LIVE_OK: LlmLiveProbe = { status: "ok", model: "claude-sonnet-4-5", detail: "HTTP 200" };
const LIVE_OFF: LlmLiveProbe = { status: "model_off", model: "claude-sonnet-4-5", detail: "HTTP 404" };
const LIVE_UNK: LlmLiveProbe = { status: "unmeasured", model: "claude-sonnet-4-5", detail: "clé absente" };

// ─── LE CŒUR DU CORRECTIF ─────────────────────────────────────────────────

describe("veille LLM — le résidu ne déclenche PAS le critique", () => {
  it("modèle qui répond + backlog non vide → aucun 🔴", () => {
    const r = evaluateLlmVeille(counts({ withError: 218, modelOff: 217 }), LIVE_OK);
    expect(r.etat).not.toBe("FAILED");
    expect(r.problem?.severity).not.toBe("crit");
    expect(r.problem?.line ?? "").not.toContain("🔴");
    expect(r.line).not.toContain("🔴");
  });

  it("le résidu reste AFFICHÉ — informer sans alarmer, pas se taire", () => {
    const r = evaluateLlmVeille(counts({ withError: 218, modelOff: 217 }), LIVE_OK);
    expect(r.line).toContain("217");
    expect(r.problem?.severity).toBe("warn");
    expect(r.problem?.line).toContain("217");
  });

  it("la situation exacte du 2026-08-27 au soir ne crie plus la panne", () => {
    // 3 runs réels : 590 résumés, 217 MODEL_NOT_FOUND résiduels, modèle debout.
    const r = evaluateLlmVeille(counts({ withError: 218, modelOff: 217 }), LIVE_OK);
    expect(r.etat).toBe("partial");
    expect(r.line).toContain("modèle OK");
  });

  it("même 10 000 items résiduels ne font pas un rouge", () => {
    const r = evaluateLlmVeille(counts({ withError: 10_000, modelOff: 10_000 }), LIVE_OK);
    expect(r.etat).not.toBe("FAILED");
    expect(r.problem?.severity).toBe("warn");
  });
});

describe("veille LLM — une panne réelle sort en rouge", () => {
  it("l'appel de contrôle échoue en modèle inconnu → 🔴", () => {
    const r = evaluateLlmVeille(counts(), LIVE_OFF);
    expect(r.etat).toBe("FAILED");
    expect(r.problem?.severity).toBe("crit");
    expect(r.problem?.line).toContain("🔴");
    expect(r.problem?.line).toContain("MODÈLE LLM INDISPONIBLE");
  });

  it("🔴 dès la panne, AVANT que le backlog ne se remplisse", () => {
    // Le compteur est à zéro : aucune trace en base, la panne vient de commencer.
    const r = evaluateLlmVeille(counts({ withError: 0, modelOff: 0 }), LIVE_OFF);
    expect(r.etat).toBe("FAILED");
    expect(r.problem?.severity).toBe("crit");
  });

  it("l'alerte nomme le modèle testé et le fichier à corriger", () => {
    const r = evaluateLlmVeille(counts(), LIVE_OFF);
    expect(r.problem?.line).toContain("claude-sonnet-4-5");
    expect(r.problem?.line).toContain("llm.service.ts");
  });

  it("une panne pendant le drainage du résidu reste distinguable", () => {
    const r = evaluateLlmVeille(counts({ withError: 218, modelOff: 217 }), LIVE_OFF);
    expect(r.etat).toBe("FAILED");
    expect(r.problem?.severity).toBe("crit");
  });
});

// ─── LE VERDICT D'APPEL RÉEL ──────────────────────────────────────────────

describe("classifyLiveProbe — avare en accusations", () => {
  const m = "claude-sonnet-4-5";

  it("200 → ok", () => {
    expect(classifyLiveProbe({ model: m, httpStatus: 200 }).status).toBe("ok");
  });

  it("404 → model_off, le seul verdict de panne franc", () => {
    expect(classifyLiveProbe({ model: m, httpStatus: 404 }).status).toBe("model_off");
  });

  it("400 nommant le modèle → model_off", () => {
    const r = classifyLiveProbe({ model: m, httpStatus: 400, errorMessage: "unknown model: x" });
    expect(r.status).toBe("model_off");
  });

  it.each([401, 403])("%i (clé) → unmeasured, JAMAIS model_off", (s) => {
    const r = classifyLiveProbe({ model: m, httpStatus: s });
    expect(r.status).toBe("unmeasured");
    expect(r.detail).toMatch(/clé/);
  });

  it("429 (quota) → unmeasured, un quota ne prouve pas un modèle mort", () => {
    expect(classifyLiveProbe({ model: m, httpStatus: 429 }).status).toBe("unmeasured");
  });

  it("500 → unmeasured", () => {
    expect(classifyLiveProbe({ model: m, httpStatus: 500 }).status).toBe("unmeasured");
  });

  it("coupure réseau → unmeasured", () => {
    const r = classifyLiveProbe({ model: m, errorName: "FetchError", errorMessage: "ECONNREFUSED" });
    expect(r.status).toBe("unmeasured");
  });

  it("appel non tenté (clé absente) → unmeasured, avec le motif", () => {
    const r = classifyLiveProbe({ model: m, skippedReason: "ANTHROPIC_API_KEY absente" });
    expect(r.status).toBe("unmeasured");
    expect(r.detail).toContain("ANTHROPIC_API_KEY");
  });

  it("le modèle testé est reporté tel quel", () => {
    expect(classifyLiveProbe({ model: "un-autre-modele", httpStatus: 200 }).model).toBe("un-autre-modele");
  });
});

// ─── NE PAS SAVOIR SE DIT ─────────────────────────────────────────────────

describe("veille LLM — l'aveuglement du contrôle est un incident", () => {
  it("non mesuré → un warn explicite, pas un vert", () => {
    const r = evaluateLlmVeille(counts(), LIVE_UNK);
    expect(r.problem?.severity).toBe("warn");
    expect(r.problem?.line).toContain("NON MESURÉE");
  });

  it("non mesuré n'est pas non plus un 🔴", () => {
    const r = evaluateLlmVeille(counts(), LIVE_UNK);
    expect(r.problem?.line).not.toContain("🔴");
    expect(r.etat).not.toBe("FAILED");
  });

  it("la ligne le dit aussi", () => {
    expect(evaluateLlmVeille(counts(), LIVE_UNK).line).toContain("NON MESURÉ");
  });
});

// ─── LA LIGNE EXISTE TOUJOURS ─────────────────────────────────────────────

describe("veille LLM — jamais silencieuse", () => {
  it.each([
    ["tout va bien", counts(), LIVE_OK],
    ["résidu seul", counts({ withError: 218, modelOff: 217 }), LIVE_OK],
    ["panne réelle", counts(), LIVE_OFF],
    ["contrôle aveugle", counts(), LIVE_UNK],
  ] as const)("%s → une ligne est émise", (_l, c, live) => {
    const r = evaluateLlmVeille(c, live);
    expect(r.line).toContain("Veille LLM");
    expect(r.line.length).toBeGreaterThan(30);
  });

  it("la ligne porte tous les compteurs, y compris les abandonnés", () => {
    const r = evaluateLlmVeille(counts({ withError: 218, modelOff: 217 }), LIVE_OK);
    for (const n of ["6371", "590", "218", "217", "86"]) expect(r.line).toContain(n);
  });
});

// ─── LECTURE DE LA BASE ───────────────────────────────────────────────────

describe("veille LLM — comptage et requête", () => {
  it("reconnaît les DEUX formats d'erreur, neuf et ancien", () => {
    const re = new RegExp(LLM_MODEL_OFF_PATTERN);
    expect(re.test("MODEL_NOT_FOUND: 404 model not found")).toBe(true);
    expect(re.test("Error:404 model claude-sonnet-4-20250514")).toBe(true);
    expect(re.test("NotFoundError: model")).toBe(true);
  });

  it("n'attrape pas un 404 cité au milieu d'un message", () => {
    expect(new RegExp(LLM_MODEL_OFF_PATTERN).test("TIMEOUT: upstream said 404 once")).toBe(false);
  });

  it("la requête est en lecture seule", () => {
    expect(LLM_VEILLE_QUERY).toMatch(/^\s*SELECT/);
    expect(LLM_VEILLE_QUERY).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
  });

  it("une ligne absente ne fait pas exploser la sonde", () => {
    expect(countsFromRow(undefined)).toEqual({
      done: 0, pending: 0, exhausted: 0, withError: 0, modelOff: 0,
    });
  });

  it("les entiers arrivent parfois en texte", () => {
    const c = countsFromRow({ done: "5", pending: "6", exhausted: "1", with_error: "2", model_off: "1" });
    expect(c).toEqual({ done: 5, pending: 6, exhausted: 1, withError: 2, modelOff: 1 });
  });
});
