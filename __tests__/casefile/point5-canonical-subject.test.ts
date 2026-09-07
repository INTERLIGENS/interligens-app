// ─── POINT 5 — alias et canonique doivent rendre LE MÊME sujet ─────────────
//
// L'écart mesuré par T1, stable sur 3 passes : `casefileLookupKey` n'était
// appliqué qu'à la lecture de CASE_DB. Les trois appels on-chain, la
// déclaration d'actif et la déclaration d'entrée recevaient la valeur brute.
//
//   case.input.value   = la chaîne de 43 caractères, verbatim
//   on_chain.asset.mint = la même, annoncée comme un mint
//   enrichissement on-chain = null partout
//   deux vérités concurrentes : RED/75 vs RED/70, deux report_hash
//
// Le contrat d'alias était correct. Il n'était appliqué qu'à UN des deux
// consommateurs.
//
// ─── Pourquoi ces tests lisent la source ───────────────────────────────────
//
// Le handler est un module de route Next qui ouvre des appels réseau (Helius,
// marchés, holders) et exige une authentification. L'exercer ici testerait le
// simulacre plutôt que la route. On vérifie donc ce qui est vérifiable sans
// réseau : que CHAQUE consommateur reçoit l'identité résolue, et que la
// réponse déclare sa résolution. Le comportement bout-en-bout est validé par
// T1 sur le déploiement.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  BOTIFY_MINT,
  BOTIFY_SYNTHETIC_ROUTE_KEY,
  casefileLookupKey,
} from "@/lib/kol-memory/tokenIdentity";
import { canonicalRefForMint } from "@/lib/casefile/publicProjection";

const ROUTE = readFileSync("src/app/api/casefile/route.ts", "utf8");
const PUBLIC = readFileSync("src/app/api/casefile/public/route.ts", "utf8");
const PDF = readFileSync("src/app/api/casefile/pdf/route.ts", "utf8");

/** Le corps du handler, commentaires retirés — les en-têtes citent le défaut. */
const codeSeul = ROUTE.split("\n")
  .filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

describe("POINT 5 — chaque consommateur reçoit l'identité résolue", () => {
  it("les TROIS appels on-chain interrogent `lookupKey`, plus la valeur brute", () => {
    for (const fn of ["fetchMetadata", "fetchMarkets", "fetchHolders"]) {
      expect(codeSeul, fn).toContain(`${fn}(lookupKey)`);
      expect(codeSeul, `${fn} ne doit plus recevoir le brut`).not.toContain(
        `${fn}(sanitizeMint)`,
      );
    }
  });

  it("`on_chain.asset.mint` porte l'identité canonique", () => {
    // On inspecte le bloc `onChain` seul : le `console.log` en amont journalise
    // délibérément le brut À CÔTÉ du résolu, ce qui est de l'observabilité et
    // non le défaut. Un regex sur tout le fichier l'attraperait à tort.
    const bloc = codeSeul.slice(
      codeSeul.indexOf("const onChain = {"),
      codeSeul.indexOf("const caseId"),
    );
    expect(bloc).toContain("mint: lookupKey,");
    expect(bloc).not.toMatch(/mint:\s*sanitizeMint/);
  });

  it("le journal, lui, garde les DEUX — brut et résolu", () => {
    // C'est ce qui permettra de constater une entrée alias en production.
    const log = codeSeul.slice(codeSeul.indexOf('console.log("[OFFCHAIN]"'), codeSeul.indexOf("const onChain"));
    expect(log).toContain("mint: sanitizeMint");
    expect(log).toContain("lookupKey");
  });

  it("MUTANT — un seul consommateur resté au brut devient rouge", () => {
    // C'est exactement le défaut d'origine : un consommateur oublié suffit à
    // rouvrir les deux vérités concurrentes.
    const restants = ["fetchMetadata", "fetchMarkets", "fetchHolders"].filter((fn) =>
      codeSeul.includes(`${fn}(sanitizeMint)`),
    );
    expect(restants).toEqual([]);
  });
});

describe("POINT 5 — aucune assertion disant que le 43 est un mint", () => {
  it("`input.type` vaut `route_alias` quand l'entrée est un alias", () => {
    expect(codeSeul).toContain('type: isAlias ? "route_alias" : "mint"');
    // L'ancienne forme affirmait le contraire, sans condition.
    expect(codeSeul).not.toContain('input: {type:"mint", value:sanitizeMint}');
  });

  it("le contrat d'alias reconnaît bien les deux chaînes", () => {
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).toHaveLength(43);
    expect(BOTIFY_MINT).toHaveLength(44);
    expect(casefileLookupKey(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(BOTIFY_MINT);
    expect(casefileLookupKey(BOTIFY_MINT)).toBe(BOTIFY_MINT);
  });

  it("et une chaîne de 43 caractères QUELCONQUE n'est pas traitée en alias", () => {
    // Le correctif ne repose pas sur une règle de longueur.
    const autre43 = "So111111111111111111111111111111111111111ab";
    expect(autre43).toHaveLength(43);
    expect(casefileLookupKey(autre43)).toBe(autre43);
  });
});

describe("POINT 5 — la résolution est VISIBLE dans la réponse", () => {
  it("`input` porte le brut reçu ET l'identité vers laquelle il résout", () => {
    expect(codeSeul).toContain("value: sanitizeMint,");
    expect(codeSeul).toContain("resolved_to: lookupKey,");
    expect(codeSeul).toContain("alias_of: isAlias ? lookupKey : null,");
    expect(codeSeul).toContain('resolution: isAlias ? "botify_synthetic_route_key" : "identity"');
  });

  it("une résolution silencieuse serait non auditable — elle ne l'est plus", () => {
    // Un lecteur qui reçoit le dossier canonique pour une entrée alias doit
    // pouvoir voir POURQUOI, sans relire le code.
    expect(codeSeul).toContain("const isAlias = lookupKey !== sanitizeMint;");
  });

  it("la version du moteur est incrémentée — le contrat de réponse a changé", () => {
    expect(codeSeul).toContain('engine_version: "CaseFile-v1.2"');
  });
});

describe("POINT 5 — déterminisme : ce qui peut l'être, et ce qui ne peut pas", () => {
  it("`report_hash` NE PEUT PAS être déterministe, et le test le consigne", () => {
    // Il couvre `caseFile` entier, qui porte `case_id = randomBytes(4)` et
    // `scan_timestamp = new Date()`. Deux appels à entrée identique rendent
    // donc deux hachages différents — par construction, pas par défaut.
    expect(codeSeul).toContain("crypto.randomBytes(4)");
    expect(codeSeul).toContain("scan_timestamp: new Date().toISOString()");
    expect(codeSeul).toContain(
      'caseFile.report_hash = crypto.createHash("sha256")',
    );
  });

  it("`canonical_hash` couvre le DOSSIER, et rien de ce qui varie par émission", () => {
    const bloc = codeSeul.slice(
      codeSeul.indexOf("caseFile.case.canonical_hash"),
      codeSeul.indexOf("caseFile.report_hash"),
    );
    for (const champ of ["subject: lookupKey", "verdict", "on_chain", "off_chain", "evidence_linking"]) {
      expect(bloc, champ).toContain(champ);
    }
    // Ce qui varie par émission en est EXCLU — sinon il ne prouverait rien.
    expect(bloc).not.toContain("case_id");
    expect(bloc).not.toContain("scan_timestamp");
  });

  it("le sujet du hachage est l'identité RÉSOLUE, jamais l'entrée brute", () => {
    const bloc = codeSeul.slice(
      codeSeul.indexOf("caseFile.case.canonical_hash"),
      codeSeul.indexOf("caseFile.report_hash"),
    );
    expect(bloc).toContain("subject: lookupKey");
    expect(bloc).not.toContain("sanitizeMint");
  });

  it("deux entrées du même sujet produisent le MÊME canonical_hash", () => {
    // Reproduction de la formule sur un dossier identique : seul `subject`
    // pourrait différer entre les deux entrées, et il est résolu.
    const dossier = (entree: string) => ({
      subject: casefileLookupKey(entree),
      chain: "solana",
      verdict: { tier: "RED", score: 70 },
      on_chain: { asset: { mint: casefileLookupKey(entree) } },
      off_chain: { claims: [1, 2, 3] },
      evidence_linking: [],
    });
    const h = (o: unknown) =>
      createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16);

    expect(h(dossier(BOTIFY_SYNTHETIC_ROUTE_KEY))).toBe(h(dossier(BOTIFY_MINT)));
  });
});

describe("POINT 5 — les deux routes voisines résolvent le même sujet", () => {
  // ── BUILD 9 / ÉTAPE 5 — la propriété survit, sa preuve change de place ───
  //
  // Ce test épinglait l'EXPRESSION `MINT_TO_PRESET[casefileLookupKey(mint)]`.
  // Les deux routes ont été recâblées sur l'autorité canonique et cette carte
  // n'existe plus : elle désignait un preset, c'est-à-dire une seconde
  // autorité de contenu.
  //
  // Ce qu'elle GARANTISSAIT — alias et canonique désignent le même sujet — est
  // inchangé et vérifié ici sur le comportement, plus sur la forme du code.
  // Un test qui rougit parce que l'implémentation a bougé alors que la
  // propriété tient n'est pas un garde-fou, c'est un frein.
  it("alias et mint canonique désignent LE MÊME dossier", () => {
    expect(canonicalRefForMint(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(
      canonicalRefForMint(BOTIFY_MINT),
    );
    expect(canonicalRefForMint(BOTIFY_MINT)).toBeTruthy();
  });

  it("les deux routes passent par le résolveur partagé, pas par une carte locale", () => {
    for (const [nom, src] of Object.entries({ PUBLIC, PDF })) {
      expect(src, nom).toContain("canonicalRefForMint");
      // Une carte locale par route, c'était deux vérités à tenir d'accord.
      expect(src, nom).not.toContain("MINT_TO_PRESET");
    }
  });

  it("ni l'une ni l'autre ne fait d'appel on-chain ni de déclaration d'actif", () => {
    for (const [nom, src] of Object.entries({ PUBLIC, PDF })) {
      for (const fn of ["fetchMetadata", "fetchMarkets", "fetchHolders"]) {
        expect(src, `${nom}/${fn}`).not.toContain(fn);
      }
      expect(src, nom).not.toContain("asset:");
    }
  });
});
