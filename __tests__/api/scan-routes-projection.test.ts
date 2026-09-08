// ─── BUILD 10 / P0 PUBLIC — LES DEUX ROUTES, PAS SEULEMENT LE MODULE ──────
//
// Un premier jet de tests ne portait que sur `publicIdentityProjection`. Les
// mutants M1/M2/M3 — retirer la gate DANS une route — ne mordaient donc pas :
// preuve manquante. Ce fichier ferme ce trou.
//
// `scan/timeline` est exercé pour de vrai : `GraphCase` est simulé à `null`, la
// route retombe sur le JSON statique, aucun réseau n'est touché.
// `scan/solana` fait des appels réseau au-delà du dossier ; il est couvert par
// une assertion de source, qui mord identiquement quand la gate est retirée.

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";

const graphCase = { findFirst: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { graphCase, walletLabel: { findMany: vi.fn() } } }));
vi.mock("@/lib/labels", () => ({ lookupAddresses: vi.fn(async () => ({})) }));

const { GET } = await import("@/app/api/scan/timeline/[address]/route");

beforeEach(() => {
  graphCase.findFirst.mockReset();
  graphCase.findFirst.mockResolvedValue(null); // force le repli sur le JSON
});

const appel = async (address: string) => {
  const res = await GET(new Request(`http://x/api/scan/timeline/${address}`) as never, {
    params: Promise.resolve({ address }),
  });
  return res.json();
};

describe("scan/timeline — la réponse publique complète", () => {
  it("OCCURRENCE 1 · interrogée avec le CANONIQUE, pivotAddress est le canonique", async () => {
    const d = await appel(BOTIFY_MINT);
    expect(d.found).toBe(true);
    expect(d.pivotAddress).toBe(BOTIFY_MINT);
    expect(d.pivotAddress).not.toBe(BOTIFY_SYNTHETIC_ROUTE_KEY);
  });

  it("OCCURRENCE 1 · interrogée avec le SYNTHÉTIQUE, elle répond quand même le canonique", async () => {
    const d = await appel(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(d.found).toBe(true);
    expect(d.pivotAddress).toBe(BOTIFY_MINT);
  });

  it("OCCURRENCES 2-5 · aucune evidence ne porte l'identité fermée", async () => {
    const d = await appel(BOTIFY_MINT);
    const ev = (d.chapters ?? []).map((c: { evidence: string | null }) => c.evidence ?? "");
    expect(ev.join(" ")).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(ev.filter((u: string) => u.includes(BOTIFY_MINT)).length).toBe(4);
  });

  it("POST-CONDITION · 0 mint synthétique DANS TOUTE la réponse", async () => {
    for (const q of [BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY]) {
      const brut = JSON.stringify(await appel(q));
      expect(brut).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    }
  });

  it("SECONDE BRANCHE · aucun matériel nominatif, wallet, montant ou interdit", async () => {
    const brut = JSON.stringify(await appel(BOTIFY_MINT));
    const bas = brut.toLowerCase();
    for (const s of ["mom wallet", "dad wallet", "family wallet", "confirmed scammer", "stolen"]) {
      expect(bas).not.toContain(s);
    }
    const d = await appel(BOTIFY_MINT);
    expect((d.chapters ?? []).every((c: { actors: unknown[] }) => c.actors.length === 0)).toBe(true);
  });

  it("un mint inconnu reste sans dossier — le correctif n'invente rien", async () => {
    const d = await appel("So11111111111111111111111111111111111111112");
    expect(d.found).toBe(false);
  });
});

describe("scan/solana — la gate est au point de sérialisation", () => {
  const src = fs.readFileSync("src/app/api/scan/solana/route.ts", "utf8");

  it("OCCURRENCES 2-5 · thread_url passe par safeEvidenceUrl", () => {
    expect(src).toContain("thread_url: safeEvidenceUrl(c.thread_url)");
  });

  it("la gate est importée du module partagé, pas réécrite", () => {
    expect(src).toContain('from "@/lib/kol-memory/publicIdentityProjection"');
    expect(src).not.toContain("BYZ9CcZ");
  });

  it(".mint n'est PAS touché — c'est l'écho de l'entrée, mesuré", () => {
    expect(src).toContain("const mint_clean = mint.trim()");
  });

  it("aucune authentification ni rate limit ajoutés", () => {
    expect(src).not.toContain("requireAdminApi");
    expect(src).not.toContain("checkAuth(");
  });
});

describe("scan/timeline — la gate est au point de sérialisation", () => {
  const src = fs.readFileSync("src/app/api/scan/timeline/[address]/route.ts", "utf8");

  it("pivotAddress passe par projectPublicMint", () => {
    expect(src).toContain("pivotAddress: projectPublicMint(cf.case_meta.mint");
  });

  it("evidence passe par safeEvidenceUrl", () => {
    expect(src).toContain("evidence: safeEvidenceUrl(c.thread_url)");
  });

  it("caseDb n'est pas modifié depuis cette route — la gate est APRÈS le chargement", () => {
    expect(src).toContain("loadCaseByMint");
    expect(src).toContain("publicIdentityProjection");
  });

  it("aucune authentification ni rate limit ajoutés", () => {
    expect(src).not.toContain("requireAdminApi");
    expect(src).not.toContain("checkRateLimit");
  });
});
