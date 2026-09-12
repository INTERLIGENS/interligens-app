// ─── BUILD 8 — Le câblage des 4 fichiers gelés ─────────────────────────────
//
// Ces quatre fichiers sont le résidu gelé du chantier. Ils ne contiennent
// aucune logique propre : ils branchent ce que src/lib/kol-memory/ décide. Ces
// tests vérifient exactement ça — que la délégation est réelle, et que le
// défaut d'origine ne peut pas revenir par la porte de derrière.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { emisParLeCode } from "../casefile/codeSeul";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const IDENTITY = lire("src/lib/kol/identity.ts");
const HANDLE_TO_MINT = lire("src/lib/kol/handleToMint.ts");
const ROUTE = lire("src/app/api/kol/[handle]/route.ts");
const CANONICAL = lire("src/lib/kol/canonical.ts");

describe("BUILD 8 — identity.ts délègue, il ne décide plus", () => {
  it("réexporte le module d'autorité et ne réimplémente rien", () => {
    expect(IDENTITY).toContain("@/lib/kol-memory/attribution");
    expect(IDENTITY).toContain("resolveWalletAttribution(address, chain)");
  });

  it("MUTANT — le `exact`/`manual` en dur a DISPARU du fichier", () => {
    // C'était littéralement `confidence: "exact", source: "manual"` rendu pour
    // toute ligne existante. Il ne doit plus exister nulle part ici.
    //
    // `identity.ts:10` CITE les deux littéraux pour expliquer le défaut : c'est
    // une mention, pas une émission. Le dépouillement n'est donc pas une
    // précaution théorique ici, il est la condition du vert.
    expect(emisParLeCode(IDENTITY, /confidence:\s*["']exact["']/)).toBe(false);
    expect(emisParLeCode(IDENTITY, /source:\s*["']manual["']/)).toBe(false);
  });

  it("l'ancienne table de correspondance fictive n'existe plus", () => {
    expect(IDENTITY).not.toContain("function mapDbConfidence");
    expect(IDENTITY).not.toContain("function mapDbSource");
  });
});

describe("BUILD 8 — handleToMint.ts rend le mint canonique", () => {
  it("délègue à tokenIdentity et ne porte plus de constante propre", () => {
    expect(HANDLE_TO_MINT).toContain("@/lib/kol-memory/tokenIdentity");
    expect(HANDLE_TO_MINT).toContain("kolHandleToCanonicalMint");
  });

  it("MUTANT — la clé synthétique 43 caractères n'est plus écrite en dur", () => {
    // La constante littérale …UnZacja4… ne doit plus apparaître : elle n'existe
    // dans aucune ligne de la base, et c'est le module d'autorité qui la nomme.
    expect(HANDLE_TO_MINT).not.toContain("UnZacja4");
  });

  it("la liste BOTIFY_KOLS n'est pas dupliquée ici", () => {
    expect(HANDLE_TO_MINT).not.toContain("const BOTIFY_KOLS");
  });
});

describe("BUILD 8 — la route filtre ses wallets", () => {
  it("applique PUBLISHABLE_WALLET_FILTER dans la requête", () => {
    expect(ROUTE).toContain("@/lib/kol-memory/walletPublication");
    expect(ROUTE).toContain("kolWallets: { where: PUBLISHABLE_WALLET_FILTER }");
  });

  it("MUTANT — la lecture non filtrée `kolWallets: true` a disparu", () => {
    // C'est elle qui servait 229 wallets dont 65 non publiables.
    // On interroge le code seul : l'en-tête du correctif (`route.ts:33`) CITE la
    // ligne fautive pour l'expliquer, et une recherche naïve la retrouverait.
    expect(emisParLeCode(ROUTE, /kolWallets:\s*true/)).toBe(false);
  });

  it("refiltre aussi en mémoire — deux gardes valent mieux qu'un WHERE oublié", () => {
    expect(ROUTE).toContain("selectPublishableWallets(");
  });
});

describe("BUILD 8 — canonical.ts : la condition morte est fermée", () => {
  it("MUTANT — `attributionSource === \"manual\"` n'est plus une condition", () => {
    // Mesuré : 0 ligne sur 482 porte ce vocabulaire. La condition ne pouvait
    // jamais être vraie, donc `exact` était inatteignable pour 412 profils.
    // Deux en-têtes (`canonical.ts:122` et `:150`) la citent en prose.
    expect(emisParLeCode(CANONICAL, /attributionSource\s*===\s*["']manual["']/)).toBe(false);
  });

  it("la dérivation vient du module d'autorité", () => {
    expect(CANONICAL).toContain("deriveAttributionConfidence");
    expect(CANONICAL).toContain("deriveAttributionSource");
    expect(CANONICAL).toContain("@/lib/kol-memory/attribution");
  });

  it("`claimType` est sélectionné — sans lui la dérivation retombe partout en candidate", () => {
    expect(CANONICAL).toContain("claimType: true");
  });

  it("la provenance des proceeds est portée par le snapshot", () => {
    expect(CANONICAL).toContain("proceedsProvenance");
    expect(CANONICAL).toContain("buildProceedsProvenance");
  });

  it("elle sort en NOT_VERIFIED tant que la source n'est pas lue", async () => {
    // `toSnapshot` est une projection pure : elle n'interroge pas la base, donc
    // elle ne peut pas affirmer que le chiffre est reproductible.
    const { buildProceedsProvenance } = await import("@/lib/kol-memory/proceedsProvenance");
    const p = buildProceedsProvenance({ servedUsd: 141_594 });
    expect(p.reproducibility).toBe("NOT_VERIFIED");
    expect(p.source).toBeNull();
  });
});

describe("BUILD 8 — aucun des 4 fichiers ne réimplémente la doctrine", () => {
  it("tous importent kol-memory, aucun ne redéfinit ses règles", () => {
    for (const [nom, src] of Object.entries({ IDENTITY, HANDLE_TO_MINT, ROUTE, CANONICAL })) {
      expect(src, nom).toContain("@/lib/kol-memory/");
    }
  });
});
