/**
 * __tests__/casefile/s3-c4-estampille-instance.test.ts
 *
 * BUILD 13 · S3 — CRITÈRE 4
 *
 *   L'ESTAMPILLE `CANONICAL` EST CONDITIONNÉE PAR L'**INSTANCE**,
 *   PAS DÉCLARÉE PAR LA **SURFACE**.
 *
 * ─── LA CONFUSION, NOMMÉE ─────────────────────────────────────────────────
 *
 *     src/lib/casefile/pdfGenerator.ts:56
 *     export const CASEFILE_AUTHORITY = "CANONICAL";
 *
 * Son commentaire dit vrai sur ce qu'elle EST : « l'état d'autorité, dans le
 * vocabulaire du registre des SURFACES ». `surfaceRegistry.ts` classe des
 * SURFACES — des routes, des modules — et dit de chacune quelle autorité elle
 * LIT. Que cette surface-ci sache lire le canonique est un fait vrai.
 *
 * ██  Mais elle est IMPRIMÉE sur le document comme une assertion sur     ██
 * ██  CE DOCUMENT-CI. Et ça, c'est une autre proposition.                ██
 *
 * Une constante ne peut pas être fausse. Une assertion sur l'instance, si.
 * `/api/casefile/generate` accepte `body.data` (l.72) : une charge arbitraire,
 * fournie par l'appelant, SANS aucun bloc canonique. Le document sort alors
 * estampillé `Authority · CANONICAL` en tête et `INTERLIGENS CaseFile ·
 * CANONICAL` en pied — en affirmant une autorité que cette instance-là n'a pas.
 *
 * Le dépôt SAIT déjà le dire : `buildHtml` pose l.406 un encart « Ce document
 * n'est adossé à AUCUN dossier canonique », et l.279 `refSource` bascule sur
 * « case metadata ». Le document se contredit donc LUI-MÊME, dans la même
 * page : l'encart dit « aucun dossier canonique », l'estampille dit CANONICAL.
 *
 * ─── LA CORRECTION PORTE SUR L'INSTANCE, PAS SUR LA CONSTANTE ─────────────
 *
 * On ne retire pas `CASEFILE_AUTHORITY` : la déclaration de surface est juste,
 * et `surfaceRegistry` s'en sert. On conditionne ce que l'INSTANCE imprime.
 *
 * ─── UN TROISIÈME SITE, MESURÉ ────────────────────────────────────────────
 *
 * GPT a nommé deux sites d'impression — l.329 (en-tête) et l.558 (pied). La
 * mesure en trouve un TROISIÈME, l.311, qui n'interpole aucune constante et
 * échappait donc à une recherche par symbole :
 *
 *     INTERLIGENS CaseFile · Canonical Artifact
 *
 * C'est le même défaut, dans le même fichier, sur la même propriété : une
 * assertion de canonicité sur l'instance. Le laisser en place rendrait le
 * critère décoratif — le document dirait `Authority · PRESET` sous un titre qui
 * annonce « Canonical Artifact ». Il est donc dans le critère, et il est NOMMÉ
 * ici plutôt que corrigé en silence.
 *
 * ─── TERRAIN LIBRE ────────────────────────────────────────────────────────
 *
 * `src/lib/casefile/` n'est pas un chemin gelé (`scripts/guard-offline.sh` gèle
 * `src/lib/pdf/`, pas `src/lib/casefile/`). Ce critère passe au vert AVANT la
 * fenêtre, et ne consomme aucune exemption.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { htmlCapture } = vi.hoisted(() => ({ htmlCapture: [] as string[] }));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: async () => ({
      newPage: async () => ({
        setContent: async (html: string) => {
          htmlCapture.push(html);
        },
        pdf: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      }),
      close: async () => {},
    }),
  },
}));

vi.mock("@sparticuz/chromium-min", () => ({
  default: { executablePath: async () => "/dev/null", args: [] as string[] },
}));

import { generateCaseFilePdf, type CaseFileInput } from "@/lib/casefile/pdfGenerator";
import { SURFACE_AUTHORITIES } from "@/lib/casefile/surfaceRegistry";
import { BOTIFY_CASEFILE_REF } from "@/lib/casefile/publicProjection";

/**
 * LA SONDE — toute assertion de CANONICITÉ portée par le document.
 *
 * Deux formes, parce que le dépôt en porte deux : le mot du vocabulaire de
 * registre en capitales (`CANONICAL`), et l'étiquette rédigée (« Canonical
 * Artifact »). Chercher la seule constante interpolée aurait manqué la seconde,
 * qui est un littéral — c'est précisément comme ça qu'elle avait été manquée.
 *
 * `canonical record`, valeur de `refSource` (l.279), n'en est PAS une : elle
 * est DÉJÀ conditionnée par l'instance et nomme la provenance du `ref`, pas
 * l'autorité du document. La sonde ne doit donc pas la voir.
 */
export function assertionsDeCanonicite(html: string): string[] {
  return [
    ...[...html.matchAll(/\bCANONICAL\b/g)].map((m) => m[0]),
    ...[...html.matchAll(/Canonical Artifact/g)].map((m) => m[0]),
  ];
}

/** L'état d'autorité effectivement imprimé, dans le vocabulaire du registre. */
export function etatsDAutoriteImprimes(html: string): string[] {
  return [...html.matchAll(/\b(CANONICAL|PRESET|NONE)\b/g)].map((m) => m[1]);
}

const META: CaseFileInput["case_meta"] = {
  case_id: "CASE-2024-BOTIFY-001",
  token_name: "BOTIFY",
  ticker: "$BOTIFY",
  mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
  chain: "solana",
  severity: "CRITICAL",
  status: "Investigating",
};

/** Une instance SANS bloc canonique — la charge `body.data` de la route. */
const SANS_DOSSIER: CaseFileInput = { case_meta: META };

/** La MÊME instance, adossée à un dossier gouverné. */
const AVEC_DOSSIER: CaseFileInput = {
  case_meta: META,
  canonical: { ref: BOTIFY_CASEFILE_REF, claims: [] },
};

async function rendre(input: CaseFileInput): Promise<string> {
  htmlCapture.length = 0;
  const res = await generateCaseFilePdf(input);
  expect(res.success, `rendu échoué : ${res.success ? "" : res.error}`).toBe(true);
  expect(htmlCapture.length).toBe(1);
  return htmlCapture[0];
}

beforeEach(() => {
  htmlCapture.length = 0;
});

describe("S3 · C4 — PRÉALABLE : la sonde lit bien l'estampille du document rendu", () => {
  it("le document est rendu et la sonde y trouve des assertions de canonicité", async () => {
    const vues = assertionsDeCanonicite(await rendre(AVEC_DOSSIER));
    expect(
      vues.length,
      "la sonde ne lit AUCUNE estampille : elle est aveugle, pas satisfaite",
    ).toBeGreaterThan(0);
  });

  it("elle en voit les TROIS sites — en-tête rédigé, en-tête d'autorité, pied", async () => {
    const html = await rendre(AVEC_DOSSIER);
    expect(assertionsDeCanonicite(html)).toHaveLength(3);
    expect(html).toContain("Canonical Artifact"); // l.311, littéral
    expect(html).toMatch(/Authority<\/span>[^<]*·[^<]*<span[^>]*>CANONICAL</); // l.329
    expect(html).toMatch(/INTERLIGENS CaseFile · CANONICAL/); // l.558
  });

  it("l'instance SANS dossier est bien reconnue comme telle PAR AILLEURS dans le même document", async () => {
    const html = await rendre(SANS_DOSSIER);
    // Le document dit déjà, l.406, qu'il n'est adossé à aucun dossier
    // canonique — et l.279 que le `ref` vient des métadonnées.
    expect(html).toContain("AUCUN dossier canonique");
    expect(html).toContain("case metadata");
    // C'est ce qui rend l'estampille contradictoire, et non simplement fausse.
  });

  it("la sonde ne confond pas `canonical record` avec une assertion d'autorité", () => {
    expect(assertionsDeCanonicite("Reference · IL-X-1 (canonical record)")).toEqual([]);
  });
});

describe("S3 · C4 — CRITÈRE : une instance sans dossier gouverné n'affirme pas CANONICAL", () => {
  it("aucune assertion de canonicité sur une instance sans bloc canonique", async () => {
    expect(assertionsDeCanonicite(await rendre(SANS_DOSSIER))).toEqual([]);
  });

  it("elle imprime tout de même un état d'autorité — elle se tait sur CANONICAL, pas sur sa provenance", async () => {
    const etats = etatsDAutoriteImprimes(await rendre(SANS_DOSSIER));
    expect(etats.length, "le document ne dit RIEN de son autorité").toBeGreaterThan(0);
    for (const e of etats) {
      expect(SURFACE_AUTHORITIES as readonly string[]).toContain(e);
      expect(e).not.toBe("CANONICAL");
    }
  });

  it("CONTRÔLE NÉGATIF DÉCISIF — la MÊME instance, adossée au dossier, affiche CANONICAL sur les trois sites", async () => {
    // Sans lui, le critère serait satisfait en retirant l'estampille partout.
    // C'est la leçon RC-3 de S2 : prouver « nulle part » est gratuit.
    expect(assertionsDeCanonicite(await rendre(AVEC_DOSSIER))).toHaveLength(3);
  });
});

describe("S3 · C4 — MUTANT : la condition porte sur l'INSTANCE, pas sur la forme d'une chaîne", () => {
  it("un `case_id` qui RESSEMBLE à un ref gouverné n'achète pas l'estampille", async () => {
    // Le piège : conditionner sur `/^IL-/` plutôt que sur la présence du bloc.
    const deguise: CaseFileInput = {
      case_meta: { ...META, case_id: "IL-SHILL-BOTIFY-001" },
    };
    expect(assertionsDeCanonicite(await rendre(deguise))).toEqual([]);
  });

  it("un bloc canonique au `ref` VIDE n'est pas un dossier — pas d'estampille", async () => {
    const creux: CaseFileInput = {
      case_meta: META,
      canonical: { ref: "", claims: [] },
    };
    expect(assertionsDeCanonicite(await rendre(creux))).toEqual([]);
  });

  it("la constante de SURFACE, elle, n'est pas retirée — elle reste déclarée", async () => {
    const { CASEFILE_AUTHORITY } = await import("@/lib/casefile/pdfGenerator");
    expect(CASEFILE_AUTHORITY).toBe("CANONICAL");
  });
});
