import { describe, it, expect, afterEach, vi } from "vitest";
import {
  envInt,
  envFloat,
  envIntOptional,
  envFloatOptional,
} from "@/lib/config/envNumber";

// NaN ne doit jamais gouverner un plafond. Ces tests couvrent les entrées
// réellement rencontrées au provisionnement — vide, espaces, séparateur de
// milliers, unité collée — pas seulement le cas d'école "abc".

const VAR = "ENV_NUMBER_UNDER_TEST";

afterEach(() => {
  delete process.env[VAR];
});

describe("envInt", () => {
  it("lit un entier valide", () => {
    process.env[VAR] = "42";
    expect(envInt(VAR, 7)).toBe(42);
  });

  it("retombe sur le défaut quand la variable est absente", () => {
    expect(envInt(VAR, 7)).toBe(7);
  });

  it("retombe sur le défaut sur la CHAÎNE VIDE", () => {
    // `process.env.X ?? "7"` ne retombait PAS ici : la chaîne vide est une
    // valeur, elle gagne sur le repli, et parseInt("") vaut NaN.
    process.env[VAR] = "";
    expect(envInt(VAR, 7)).toBe(7);
  });

  it.each([
    ["abc", "non numérique"],
    ["   ", "blancs seuls"],
    ["#commentaire", "valeur commentée"],
    ["null", "la chaîne null"],
    ["undefined", "la chaîne undefined"],
  ])("retombe sur le défaut pour %o (%s)", (raw) => {
    process.env[VAR] = raw as string;
    expect(envInt(VAR, 7)).toBe(7);
  });

  it("ne retombe PAS sur le défaut pour 0 — 0 est un kill switch légitime", () => {
    // Coercer 0 vers le défaut désarmerait un arrêt volontaire (« ne rien
    // laisser passer »). C'est la seule valeur « fausse » qu'on conserve.
    process.env[VAR] = "0";
    expect(envInt(VAR, 7)).toBe(0);
  });

  it("conserve les négatifs (pas de sur-interprétation)", () => {
    process.env[VAR] = "-5";
    expect(envInt(VAR, 7)).toBe(-5);
  });

  it("REJETTE un suffixe collé — lecture stricte, pas la tolérance parseInt", () => {
    // parseInt("15s") vaut 15 : fini, donc un garde sur Number.isFinite le
    // laisserait passer. La lecture stricte le refuse — une valeur à moitié
    // lisible est un provisionnement raté, pas une valeur.
    process.env[VAR] = "15s";
    expect(envInt(VAR, 7)).toBe(7);
  });

  it("REJETTE le séparateur de milliers — le cas qui échappe à Number.isFinite", () => {
    // LE cas réel : "24 000" recopié d'un tableur. parseInt rend 24, PAS NaN.
    // Un plafond de 24 000 posts devient un plafond de 24, sans un seul log.
    // Number.isFinite(24) est true : seul le strict attrape ça.
    process.env[VAR] = "24 000";
    expect(envInt(VAR, 24000)).toBe(24000);
    expect(Number.parseInt("24 000", 10)).toBe(24); // preuve du piège
  });

  it("accepte les blancs de bord (recopie humaine bénigne)", () => {
    process.env[VAR] = "  42  ";
    expect(envInt(VAR, 7)).toBe(42);
  });

  it("rejette une valeur non entière pour un entier", () => {
    process.env[VAR] = "12.5";
    expect(envInt(VAR, 7)).toBe(7);
  });
});

describe("envFloat", () => {
  it("lit un flottant valide", () => {
    process.env[VAR] = "0.0058";
    expect(envFloat(VAR, 1)).toBe(0.0058);
  });

  it.each([["", "vide"], ["abc", "non numérique"], ["   ", "blancs"]])(
    "retombe sur le défaut pour %o (%s)",
    (raw) => {
      process.env[VAR] = raw as string;
      expect(envFloat(VAR, 1.25)).toBe(1.25);
    },
  );

  it("retombe sur le défaut pour Infinity (fini, pas juste non-NaN)", () => {
    // C'est la raison d'utiliser Number.isFinite plutôt que !isNaN :
    // parseFloat("Infinity") vaut Infinity, qui n'est pas NaN mais ruine
    // autant un plafond.
    process.env[VAR] = "Infinity";
    expect(envFloat(VAR, 1.25)).toBe(1.25);
  });
});

describe("variantes optionnelles", () => {
  it("rendent undefined quand la variable est absente ou vide", () => {
    expect(envIntOptional(VAR)).toBeUndefined();
    expect(envFloatOptional(VAR)).toBeUndefined();
    process.env[VAR] = "";
    expect(envIntOptional(VAR)).toBeUndefined();
    expect(envFloatOptional(VAR)).toBeUndefined();
  });

  it("rendent undefined — PAS NaN — sur une valeur illisible", () => {
    // Le piège du motif `X ? parseFloat(X) : undefined` : "abc" passe le test
    // de présence, parseFloat rend NaN, et le seuil devient NaN — actif en
    // apparence, toujours false à la comparaison. Un filtre qui se croit armé
    // et ne filtre rien.
    process.env[VAR] = "abc";
    expect(envIntOptional(VAR)).toBeUndefined();
    expect(envFloatOptional(VAR)).toBeUndefined();
    expect(Number.isNaN(envFloatOptional(VAR) as number)).toBe(false);
  });

  it("lisent une valeur valide", () => {
    process.env[VAR] = "2500";
    expect(envIntOptional(VAR)).toBe(2500);
    expect(envFloatOptional(VAR)).toBe(2500);
  });
});

// ── LE CAS CRITIQUE : le plafond posts du watcher ─────────────────────────
// X_API_HARD_CAP_POSTS gouverne la décision de blocage AUTORITATIVE du cron
// watcher-v2. C'est la seule chose entre un provisionnement raté et une facture
// X réelle.

describe("X_API_HARD_CAP_POSTS (cron/watcher-v2)", () => {
  const ORIGINAL = process.env.X_API_HARD_CAP_POSTS;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.X_API_HARD_CAP_POSTS;
    else process.env.X_API_HARD_CAP_POSTS = ORIGINAL;
    vi.resetModules();
  });

  async function loadCap(raw: string | undefined): Promise<number> {
    vi.resetModules();
    if (raw === undefined) delete process.env.X_API_HARD_CAP_POSTS;
    else process.env.X_API_HARD_CAP_POSTS = raw;
    const mod = await import("@/app/api/cron/watcher-v2/route");
    return mod.X_API_HARD_CAP_POSTS;
  }

  it("vaut 24000 quand la variable est absente (défaut inchangé)", async () => {
    expect(await loadCap(undefined)).toBe(24000);
  });

  it("lit une valeur valide", async () => {
    expect(await loadCap("30000")).toBe(30000);
  });

  it.each([
    ["", "chaîne vide — le provisionnement raté le plus courant"],
    ["24 000", "séparateur de milliers recopié d'un tableur"],
    ["abc", "valeur illisible"],
    ["24000 posts", "unité collée"],
  ])("retombe sur 24000 pour %o (%s)", async (raw) => {
    const cap = await loadCap(raw as string);
    expect(Number.isNaN(cap)).toBe(false);
    expect(cap).toBe(24000);
  });

  it("AVANT/APRÈS sur '24 000' : parseInt donnait 24, le cap donne 24000", async () => {
    // La régression que ce correctif ferme, montrée des deux côtés.
    expect(Number.parseInt("24 000", 10)).toBe(24);
    expect(await loadCap("24 000")).toBe(24000);
  });

  it("PREUVE DU DANGER : un plafond NaN ne bloque jamais", async () => {
    vi.resetModules();
    const { evaluateBudgetCapPosts } = await import(
      "@/app/api/cron/watcher-v2/route"
    );

    // Consommation très au-dessus du plafond : avec un vrai plafond, on bloque.
    const reel = evaluateBudgetCapPosts({
      usagePosts: 999_999,
      estimatePosts: 1_000,
      capPosts: 24_000,
    });
    expect(reel.capReached).toBe(true);

    // Le même dépassement, avec le plafond en NaN : `999999 + 1000 >= NaN`
    // est false. Le garde-fou ne se déclenche PLUS JAMAIS, sans une ligne de
    // log. C'est exactement ce que le correctif rend impossible.
    const casse = evaluateBudgetCapPosts({
      usagePosts: 999_999,
      estimatePosts: 1_000,
      capPosts: NaN,
    });
    expect(casse.capReached).toBe(false);
    expect(casse.warning).toBe(false);
  });

  it("le plafond réellement chargé bloque le dépassement", async () => {
    // Bouclage : on repart de la valeur qui sort de l'env cassé et on vérifie
    // qu'elle déclenche bien la décision de blocage.
    const cap = await loadCap("");
    const { evaluateBudgetCapPosts } = await import(
      "@/app/api/cron/watcher-v2/route"
    );
    expect(
      evaluateBudgetCapPosts({
        usagePosts: 23_000,
        estimatePosts: 2_000,
        capPosts: cap,
      }).capReached,
    ).toBe(true);
  });
});
