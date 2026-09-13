// ─── S1 · PHASE A — LE REFUS PUBLIC EST INDISCERNABLE ──────────────────────
//
// « Mint inconnu » et « mint qui résout mais dossier draft » DOIVENT rendre
// la même réponse, octet pour octet — statut, en-têtes, corps. Sinon on a
// remplacé un oracle de contenu par un oracle d'existence.
//
// Le témoin compare l'EMPREINTE complète (statut + tous les en-têtes triés +
// corps), pas seulement le corps : un en-tête de plus sur un des deux chemins
// suffirait à distinguer.

import { describe, it, expect, vi } from "vitest";
import {
  resolvePublicCasefile,
  publicRefusalResponse,
  responseFingerprint,
  PUBLIC_CASEFILE_REFUSAL,
} from "@/lib/casefile/publicRefusal";
import { VINE_MINT, BOTIFY_MINT_FOR_TEST } from "./s1-fixtures";
import type { PublicProjection } from "@/lib/casefile/publicProjection";

/** Un mint valide qui ne résout vers AUCUN dossier. */
const MINT_INCONNU = "So11111111111111111111111111111111111111112";

/** Ce que rend le producteur pour un dossier draft : REFUSED, sans cause. */
const chargeurDraft = vi.fn(async () => ({ decision: "REFUSED" as const }));

const PROJECTION_FACTICE: PublicProjection = {
  ref: "IL-TEST-000",
  codename: "TEST",
  ticker: "$TEST",
  title: "t",
  tigerScore: null,
  verdict: "UNDETERMINED",
  claims: [],
  sources: [],
  withheld: [],
};

describe("S1 — mint inconnu et mint draft : même réponse, octet pour octet", () => {
  it("les deux chemins rendent REFUSE", async () => {
    const inconnu = await resolvePublicCasefile(MINT_INCONNU, "test", { loadIfPublished: chargeurDraft });
    const draft = await resolvePublicCasefile(VINE_MINT, "test", { loadIfPublished: chargeurDraft });
    expect(inconnu.kind).toBe("REFUSE");
    expect(draft.kind).toBe("REFUSE");
    // Le chemin « inconnu » n'a PAS consulté le producteur ; le chemin
    // « draft » l'a consulté une fois. C'est la seule différence, et elle
    // n'est pas dans la réponse.
    expect(chargeurDraft).toHaveBeenCalledTimes(1);
  });

  it("empreintes identiques : statut, en-têtes triés, corps", async () => {
    const inconnu = await resolvePublicCasefile(MINT_INCONNU, "test", { loadIfPublished: chargeurDraft });
    const draft = await resolvePublicCasefile(VINE_MINT, "test", { loadIfPublished: chargeurDraft });
    if (inconnu.kind !== "REFUSE" || draft.kind !== "REFUSE") throw new Error("inatteignable");
    const a = await responseFingerprint(inconnu.response);
    const b = await responseFingerprint(draft.response);
    expect(a).toBe(b);
  });

  it("corps byte-identiques (Buffer.compare = 0)", async () => {
    const inconnu = await resolvePublicCasefile(MINT_INCONNU, "test", { loadIfPublished: chargeurDraft });
    const draft = await resolvePublicCasefile(VINE_MINT, "test", { loadIfPublished: chargeurDraft });
    if (inconnu.kind !== "REFUSE" || draft.kind !== "REFUSE") throw new Error("inatteignable");
    const a = Buffer.from(await inconnu.response.arrayBuffer());
    const b = Buffer.from(await draft.response.arrayBuffer());
    expect(Buffer.compare(a, b)).toBe(0);
    expect(a.length).toBeGreaterThan(0);
  });

  it("le refus est celui de la constante gelée, et rien ne s'y ajoute", async () => {
    const res = publicRefusalResponse();
    expect(res.status).toBe(PUBLIC_CASEFILE_REFUSAL.status);
    expect(await res.text()).toBe(PUBLIC_CASEFILE_REFUSAL.body);
    const attendus = Object.entries(PUBLIC_CASEFILE_REFUSAL.headers).map(([k, v]) => `${k}=${v}`).sort();
    const rendus = [...res.headers.entries()].map(([k, v]) => `${k.toLowerCase()}=${v}`).sort();
    expect(rendus).toEqual(attendus);
    expect(Object.isFrozen(PUBLIC_CASEFILE_REFUSAL)).toBe(true);
  });

  it("le corps de refus ne nomme ni cause, ni ref, ni mint", async () => {
    const draft = await resolvePublicCasefile(VINE_MINT, "test", { loadIfPublished: chargeurDraft });
    if (draft.kind !== "REFUSE") throw new Error("inatteignable");
    const corps = await draft.response.text();
    for (const fuite of ["draft", "IL-SHILL", "VINE", VINE_MINT, "missing", "canonical", "cause"]) {
      expect(corps).not.toContain(fuite);
    }
  });
});

describe("S1 — le chemin publié SERT, et c'est le seul", () => {
  it("un dossier publié rend SERVE avec la projection du producteur", async () => {
    const chargeurPublie = vi.fn(async () => ({
      decision: "PUBLISHABLE" as const,
      projection: PROJECTION_FACTICE,
    }));
    const r = await resolvePublicCasefile(BOTIFY_MINT_FOR_TEST, "test", { loadIfPublished: chargeurPublie });
    expect(r.kind).toBe("SERVE");
    if (r.kind !== "SERVE") throw new Error("inatteignable");
    expect(r.projection).toBe(PROJECTION_FACTICE);
    expect(r.ref).toBe("IL-SHILL-BOTIFY-001");
  });

  it("l'alias BOTIFY synthétique résout vers le même dossier (contrat d'alias E2)", async () => {
    const chargeur = vi.fn(async () => ({ decision: "REFUSED" as const }));
    await resolvePublicCasefile("BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", "test", { loadIfPublished: chargeur });
    expect(chargeur).toHaveBeenCalledWith("IL-SHILL-BOTIFY-001", "test");
  });
});
