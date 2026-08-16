// __tests__/security/proceeds-containment.test.ts
//
// P0 — CONTAINMENT DES PROCEEDS.
//
// Ce que ces tests prouvent :
//   1. le gate lui-même — fail-closed, null ≠ 0, pas de republication ;
//   2. l'alignement code ↔ SQL — les motifs, portées et états acceptés par
//      TypeScript sont exactement ceux que la contrainte CHECK accepte ;
//   3. les surfaces — les six chemins qui publiaient un montant ne le publient
//      plus quand la décision de retrait est posée ;
//   4. le mutation testing — chaque garde ajouté est tué par au moins un test.
//
// CE QUE ÇA NE PROUVE PAS : le comportement de Postgres. Ni
// MIGRATION_proceeds_containment_v1.sql ni RETRAIT_proceeds_2026-08-16.sql ne
// sont appliqués sur ep-square-band (interdit du chantier), et aucun Postgres
// local n'existe sur cette machine. La preuve d'exécution contre la base réelle
// est un point du STOP 2, pas de ce fichier.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isProceedsPublished,
  redactProceeds,
  sumPublishedProceeds,
  PROCEEDS_DECISION_CODES,
  PROCEEDS_SCOPES,
  PROCEEDS_PUBLICATION_STATES,
  PUBLISHED_PROCEEDS_FILTER,
  PROCEEDS_WITHDRAWN_CODE,
} from "@/lib/kol/proceedsGate";

const MIGRATION = join(__dirname, "..", "..", "migrations", "MIGRATION_proceeds_containment_v1.sql");
const RETRAIT = join(__dirname, "..", "..", "migrations", "RETRAIT_proceeds_2026-08-16.sql");

function sqlInList(sql: string, anchor: string): string[] {
  const block = sql.slice(sql.indexOf(anchor));
  const inList = block.slice(0, block.indexOf("))"));
  return Array.from(inList.matchAll(/'([a-z_]+)'/g)).map((m) => m[1]);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LE GATE — fail-closed
// ═══════════════════════════════════════════════════════════════════════════

describe("isProceedsPublished — fail-closed", () => {
  it("rend true UNIQUEMENT sur la valeur exacte 'published'", () => {
    expect(isProceedsPublished({ proceedsPublication: "published" })).toBe(true);
  });

  // Le mode de défaillance réel : une nouvelle surface lit totalDocumented sans
  // sélectionner proceedsPublication. En fail-open, cet oubli republierait
  // silencieusement un chiffre retiré — l'incident qu'on est en train de
  // contenir. Ce test est le mutant tueur du choix fail-closed.
  it("rend false quand le champ n'a PAS été sélectionné (undefined)", () => {
    expect(isProceedsPublished({})).toBe(false);
  });

  it.each([
    ["null", null],
    ["chaîne vide", ""],
    ["valeur inconnue", "PUBLISHED"],
    ["valeur inconnue 2", "active"],
    ["withdrawn", "withdrawn"],
    ["espace avant", " published"],
    ["espace après", "published "],
  ])("rend false sur %s", (_label, value) => {
    expect(isProceedsPublished({ proceedsPublication: value as string })).toBe(false);
  });

  it("rend false sur null / undefined en entrée", () => {
    expect(isProceedsPublished(null)).toBe(false);
    expect(isProceedsPublished(undefined)).toBe(false);
  });
});

describe("redactProceeds — null, jamais zéro", () => {
  const published = { proceedsPublication: "published" };
  const withdrawn = { proceedsPublication: "withdrawn" };

  it("laisse passer le montant quand la publication est active", () => {
    expect(redactProceeds(published, 579645)).toBe(579645);
  });

  // Zéro est une AFFIRMATION (« cette personne n'a rien encaissé »), null une
  // ABSENCE (« nous ne publions pas de chiffre »). Sur une plateforme qui note
  // des personnes, les confondre est une faute — pas un détail de typage.
  it("rend null — et surtout PAS 0 — quand la publication est retirée", () => {
    const r = redactProceeds(withdrawn, 579645);
    expect(r).toBeNull();
    expect(r).not.toBe(0);
  });

  it("rend null pour les six montants réellement retirés", () => {
    for (const v of [817000, 579645, 380000, 210900, 141594, 127036]) {
      expect(redactProceeds(withdrawn, v)).toBeNull();
    }
  });

  it("rend null (pas 0) sur un montant absent, même publié", () => {
    expect(redactProceeds(published, null)).toBeNull();
    expect(redactProceeds(published, undefined)).toBeNull();
  });

  it("fail-close si le champ n'a pas été sélectionné", () => {
    expect(redactProceeds({}, 579645)).toBeNull();
  });

  it("conserve un montant nul légitimement publié comme 0, pas comme null", () => {
    // 0 publié reste 0 : la redaction ne doit pas transformer une valeur en
    // absence. Elle ne fait que retirer, jamais réinterpréter.
    expect(redactProceeds(published, 0)).toBe(0);
  });
});

describe("sumPublishedProceeds — les agrégats n'additionnent que du publié", () => {
  const rows = [
    { proceedsPublication: "withdrawn", v: 817000 },
    { proceedsPublication: "withdrawn", v: 579645 },
    { proceedsPublication: "withdrawn", v: 380000 },
    { proceedsPublication: "withdrawn", v: 210900 },
    { proceedsPublication: "withdrawn", v: 141594 },
    { proceedsPublication: "withdrawn", v: 127036 },
    { proceedsPublication: "published", v: 2932 },
    { proceedsPublication: "published", v: 2082 },
  ];

  // Le chiffre qui compte : /api/kol/leaderboard publie totalObservedProceeds
  // et /api/explorer minimumObservedProceeds. Les deux valaient 2 261 189 $,
  // dont 2 104 000 $ (95,5 %) issus de six lignes d'import CSV.
  it("2 261 189 $ deviennent 5 014 $ après les six retraits", () => {
    expect(rows.reduce((s, r) => s + r.v, 0)).toBe(2261189);
    expect(sumPublishedProceeds(rows, (r) => r.v)).toBe(5014);
  });

  it("une ligne sans état de publication n'entre pas dans la somme", () => {
    expect(sumPublishedProceeds([{ v: 999 } as never], (r: { v: number }) => r.v)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ALIGNEMENT CODE ↔ SQL
// ═══════════════════════════════════════════════════════════════════════════
//
// Un code accepté par TypeScript et refusé par la contrainte CHECK ferait
// échouer l'INSERT au moment exact où l'on consigne une décision de retrait.

describe("alignement code ↔ contraintes SQL", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("PROCEEDS_DECISION_CODES == le CHECK reasonCode", () => {
    expect(sqlInList(sql, '"reasonCode" IN (').sort()).toEqual(
      [...PROCEEDS_DECISION_CODES].sort(),
    );
  });

  it("PROCEEDS_SCOPES == le CHECK scope", () => {
    expect(sqlInList(sql, '"scope" IN (').sort()).toEqual([...PROCEEDS_SCOPES].sort());
  });

  it("PROCEEDS_PUBLICATION_STATES == le CHECK d'état de KolProfile", () => {
    expect(sqlInList(sql, '"proceedsPublication" IN (').sort()).toEqual(
      [...PROCEEDS_PUBLICATION_STATES].sort(),
    );
  });

  it("les motifs sont identiques à ceux du journal P0-2, pour rester agrégeables", async () => {
    const { PUBLICATION_DECISION_CODES } = await import(
      "@/lib/watcher-bridge/linkPublicationJournal"
    );
    expect([...PROCEEDS_DECISION_CODES].sort()).toEqual([...PUBLICATION_DECISION_CODES].sort());
  });

  it("PUBLISHED_PROCEEDS_FILTER cible bien 'published'", () => {
    expect(PUBLISHED_PROCEEDS_FILTER).toEqual({ proceedsPublication: "published" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. LA MIGRATION ET LE RETRAIT — ce qu'ils font, et surtout ce qu'ils NE font pas
// ═══════════════════════════════════════════════════════════════════════════

describe("migration — additive, non destructive", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const statements = sql.replace(/--[^\n]*/g, "");

  it.each(["DROP", "TRUNCATE", "DELETE"])("ne contient aucun %s", (kw) => {
    expect(new RegExp(`\\b${kw}\\b`, "i").test(statements)).toBe(false);
  });

  it("n'écrit jamais NULL dans totalDocumented", () => {
    expect(/totalDocumented"?\s*=\s*NULL/i.test(statements)).toBe(false);
  });

  it("crée la colonne avec DEFAULT 'published' — comportement inchangé après exécution", () => {
    expect(statements).toMatch(/ADD COLUMN IF NOT EXISTS "proceedsPublication" TEXT NOT NULL DEFAULT 'published'/);
  });

  it("interdit l'acteur non attribuable 'admin' au niveau de la base", () => {
    expect(statements).toMatch(/lower\(btrim\("actorId"\)\)\s*<>\s*'admin'/);
  });

  it("interdit une transition fictive (fromStatus = toStatus)", () => {
    expect(statements).toMatch(/"fromStatus"\s*<>\s*"toStatus"/);
  });
});

describe("retrait — les six décisions, et rien de plus", () => {
  const sql = readFileSync(RETRAIT, "utf8");
  const body = sql.replace(/--[^\n]*/g, "");

  const WITHDRAWN = ["OrbitApe", "GordonGekko", "James", "bkokoski", "sxyz500", "Myrrha"];
  const KEPT = ["0xBossman", "Geppetto"];

  it.each(["DROP", "TRUNCATE", "DELETE"])("ne contient aucun %s", (kw) => {
    expect(new RegExp(`\\b${kw}\\b`, "i").test(body)).toBe(false);
  });

  it("n'écrit jamais NULL dans un montant", () => {
    expect(/totalDocumented"?\s*=\s*NULL/i.test(body)).toBe(false);
    expect(/totalProceedsUsd"?\s*=\s*NULL/i.test(body)).toBe(false);
  });

  it.each(WITHDRAWN)("consigne une décision pour %s", (h) => {
    expect(body).toContain(`('${h}', 'profile_total', 'published', 'withdrawn'`);
  });

  // Les deux montants intégralement adossés à des observations on-chain ne sont
  // pas retirés : le containment est une décision de preuve, pas un effacement
  // de précaution.
  it.each(KEPT)("ne touche PAS %s", (h) => {
    expect(body).not.toContain(`'${h}'`);
  });

  it("l'acteur est une personne réelle, jamais 'admin'", () => {
    const actors = Array.from(body.matchAll(/'(person:[a-z0-9-]+)'/g)).map((m) => m[1]);
    expect(new Set(actors)).toEqual(new Set(["person:david-douville"]));
    expect(body).not.toMatch(/'admin'/);
  });

  it("sxyz500 est un erratum, les cinq autres un evidence_withdrawn", () => {
    const erratum = Array.from(body.matchAll(/'erratum'/g)).length;
    const withdrawn = Array.from(body.matchAll(/'evidence_withdrawn'/g)).length;
    expect(erratum).toBe(1);
    expect(withdrawn).toBe(5);
  });

  // Demandé explicitement au STOP 1 : le motif de sxyz500 doit dire que les
  // 85 000 $ Arkham ne sont pas mieux soutenus que le reste, et pas seulement
  // que 56 594 $ sont orphelins.
  it("le motif de sxyz500 qualifie les DEUX composantes comme non soutenues", () => {
    const start = body.indexOf("('sxyz500', 'profile_total'");
    expect(start).toBeGreaterThan(-1);
    const reason = body.slice(start, body.indexOf("person:david-douville", start));
    expect(reason).toContain("85 000");
    expect(reason).toContain("56 594");
    expect(reason).toMatch(/PREMIER TITRE/);
    expect(reason).toMatch(/SECOND TITRE/);
    expect(reason).toMatch(/aucune des deux composantes ne tient/);
  });

  it("le journal est écrit AVANT la bascule d'état", () => {
    expect(body.indexOf('INSERT INTO "KolProceedsPublicationLog"')).toBeLessThan(
      body.indexOf('UPDATE "KolProfile"'),
    );
  });

  it("chaque décision fige la valeur publiée et sa part primaire", () => {
    for (const [h, published, primary] of [
      ["OrbitApe", "817000", "0"],
      ["GordonGekko", "579645", "94644.79"],
      ["James", "380000", "0"],
      ["bkokoski", "210900", "900.06"],
      ["sxyz500", "141594", "0"],
      ["Myrrha", "127036", "36.16"],
    ] as const) {
      const start = body.indexOf(`('${h}', 'profile_total'`);
      expect(body.slice(start, start + 200)).toContain(`${published}, ${primary},`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. LES SURFACES — mutation testing
// ═══════════════════════════════════════════════════════════════════════════
//
// Cinq mutants, un par garde ajouté. Chacun décrit la régression exacte qu'il
// réintroduirait, et le test qui le tue.

describe("mutation testing — chaque garde a son tueur", () => {
  it("MUTANT 1 — isProceedsPublished fail-OPEN (undefined ⇒ publié)", () => {
    const mutant = (p?: { proceedsPublication?: string }) =>
      p?.proceedsPublication !== "withdrawn";
    // Le mutant republie un chiffre dès qu'une surface oublie de sélectionner
    // la colonne. Le vrai gate ne le fait pas.
    expect(mutant({})).toBe(true);
    expect(isProceedsPublished({})).toBe(false);
  });

  it("MUTANT 2 — redactProceeds rend 0 au lieu de null", () => {
    const mutant = (p: { proceedsPublication?: string }, v: number) =>
      isProceedsPublished(p) ? v : 0;
    // 0 affirmerait « rien encaissé » sur les six personnes concernées, ce qui
    // est une autre assertion fausse — pas un retrait.
    expect(mutant({ proceedsPublication: "withdrawn" }, 579645)).toBe(0);
    expect(redactProceeds({ proceedsPublication: "withdrawn" }, 579645)).toBeNull();
  });

  it("MUTANT 3 — l'agrégat somme tout, publié ou non", () => {
    const rows = [
      { proceedsPublication: "withdrawn", v: 579645 },
      { proceedsPublication: "published", v: 2932 },
    ];
    const mutant = rows.reduce((s, r) => s + r.v, 0);
    expect(mutant).toBe(582577);
    expect(sumPublishedProceeds(rows, (r) => r.v)).toBe(2932);
  });

  it("MUTANT 4 — /api/v1/kol sans clause WHERE sur le résumé", () => {
    const route = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "v1", "kol", "route.ts"),
      "utf8",
    );
    // Le défaut d'origine : SELECT ... FROM "KolProceedsSummary" sans WHERE,
    // qui servait les 24 résumés en reviewStatus='draft' au même titre que les 4
    // publiés.
    expect(route).toMatch(/FROM "KolProceedsSummary"/);
    expect(route).toMatch(/s\."reviewStatus" = 'published'/);
    expect(route).toMatch(/p\."proceedsPublication" = 'published'/);
  });

  it("MUTANT 5 — le PDF figé reste servi après le retrait", () => {
    const route = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "pdf", "[handle]", "route.ts"),
      "utf8",
    );
    // reports/{handle}/latest.pdf est un objet R2 immuable : aucun filtre de
    // lecture en base ne le modifie. Il faut cesser de le SERVIR.
    expect(route).toContain("isProceedsPublished");
    // La route reference la constante partagee plutot que le litteral : c'est
    // ce qui garantit que le code rendu au client et celui teste ici ne peuvent
    // pas diverger.
    expect(route).toContain("PROCEEDS_WITHDRAWN_CODE");
    expect(PROCEEDS_WITHDRAWN_CODE).toBe("proceeds_withdrawn");
    expect(route).toMatch(/status: 409/);
    // …et ne jamais le supprimer.
    expect(route).not.toMatch(/DeleteObject|deleteVaultObject|\.delete\(/);
  });

  it("MUTANT 6 — le cron régénère un dossier pour un handle retiré", () => {
    const cron = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "cron", "helius-scan", "route.ts"),
      "utf8",
    );
    // Sans la garde, le cron de 04:00 créerait chaque nuit une archive
    // horodatée de plus portant le chiffre qu'on vient de retirer.
    expect(cron).toContain("isProceedsPublished");
    expect(cron).toMatch(/if \(after !== before && proceedsPublishedForPdf\)/);
  });

  it("MUTANT 7 — le montant repart dans le prompt LLM", () => {
    const grounding = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "ask", "groundingContext.ts"),
      "utf8",
    );
    // Le seul endroit où un filtre en aval est impossible : une fois le montant
    // dans le prompt, le modèle le reformule librement en prose.
    expect(grounding).toContain("redactProceeds");
    expect(grounding).toContain("proceedsPublication: true");
    expect(grounding).not.toMatch(/if \(profile\.totalDocumented != null/);
  });

  it("MUTANT 8 — /api/scan/ask reste hors du gate nominatif", async () => {
    const { isNominativeApiPath } = await import("@/lib/security/nominativeApiGate");
    const proxy = readFileSync(join(__dirname, "..", "..", "src", "proxy.ts"), "utf8");
    // Un chemin déclaré nominatif que le matcher n'atteint pas est un gate qui
    // ne s'exécute jamais : les deux doivent bouger ensemble.
    expect(isNominativeApiPath("/api/scan/ask")).toBe(true);
    expect(proxy).toContain('"/api/scan/ask"');
    // Le reste de /api/scan/* doit rester ouvert : le scan public en dépend.
    expect(isNominativeApiPath("/api/scan/resolve")).toBe(false);
    expect(isNominativeApiPath("/api/scan/solana")).toBe(false);
  });

  it("MUTANT 9 — le préréglage botify de la plainte reste générable", () => {
    const route = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "admin", "plainte", "generate", "route.ts"),
      "utf8",
    );
    expect(route).toContain('body.preset === "botify"');
    expect(route).toContain("preset_frozen");
    expect(route).toMatch(/status: 409/);
    // Le refus doit précéder la génération du PDF.
    expect(route.indexOf("preset_frozen")).toBeLessThan(route.indexOf("puppeteer.launch"));
  });
});
