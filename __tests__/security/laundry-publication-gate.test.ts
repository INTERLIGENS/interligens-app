// __tests__/security/laundry-publication-gate.test.ts
//
// A12 — le chemin de dépublication de `LaundryTrail`.
//
// Ce que la suite prouve, en une phrase : **un narratif retiré, ou dont l'état
// est illisible, n'apparaît sur aucune des six surfaces.**
//
// `LaundryTrail` porte des affirmations nominatives chiffrées sur des personnes
// publiées. Jusqu'à ce chantier, la seule façon d'en retirer une était un
// `DELETE` SQL — une destruction. Ces tests verrouillent l'interrupteur qui la
// remplace, et surtout son sens du refus : **le doute ne publie pas.**

import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isLaundryTrailPublished,
  redactLaundryTrail,
  filterPublishedLaundryTrails,
  readPublishedLaundryTrail,
  PUBLISHED_LAUNDRY_FILTER,
  LAUNDRY_PUBLICATION_SELECT,
  LAUNDRY_DECISION_CODES,
  LAUNDRY_DECISION_SCOPES,
  LAUNDRY_PUBLICATION_STATES,
} from "@/lib/laundry/publicationGate";

const PUBLISHED = { publication: "published", laundryRisk: "HIGH", narrativeText: "…$210K…" };

// Toutes les façons de NE PAS être publié. Chacune doit refuser.
const NOT_PUBLISHED: Array<[string, unknown]> = [
  ["retiré explicitement", { publication: "withdrawn" }],
  ["état absent du select", { laundryRisk: "HIGH" }],
  ["état null", { publication: null }],
  ["état undefined", { publication: undefined }],
  ["chaîne vide", { publication: "" }],
  ["espaces", { publication: "  published  " }],
  ["casse différente", { publication: "Published" }],
  ["MAJUSCULES", { publication: "PUBLISHED" }],
  ["valeur inattendue", { publication: "draft" }],
  ["booléen vrai", { publication: true }],
  ["nombre", { publication: 1 }],
  ["objet", { publication: { toString: () => "published" } }],
  ["trail null", null],
  ["trail undefined", undefined],
];

describe("isLaundryTrailPublished — le doute ne publie pas", () => {
  it("publie le seul cas explicite", () => {
    expect(isLaundryTrailPublished(PUBLISHED)).toBe(true);
  });

  for (const [label, value] of NOT_PUBLISHED) {
    it(`refuse : ${label}`, () => {
      expect(isLaundryTrailPublished(value as never)).toBe(false);
    });
  }
});

describe("redactLaundryTrail — rend null, jamais un objet vidé", () => {
  it("laisse passer un trail publié, intact", () => {
    expect(redactLaundryTrail(PUBLISHED)).toBe(PUBLISHED);
  });

  for (const [label, value] of NOT_PUBLISHED) {
    it(`efface : ${label}`, () => {
      expect(redactLaundryTrail(value as never)).toBeNull();
    });
  }

  it("rend `null` et non un objet vide — un `if (trail)` suffit à faire disparaître le bloc", () => {
    const redacted = redactLaundryTrail({ publication: "withdrawn", narrativeText: "…$210K…" });
    expect(redacted).toBeNull();
    // Le piège évité : un objet aux champs vidés porterait encore le nom.
    expect(redacted).not.toEqual({});
  });
});

describe("filterPublishedLaundryTrails", () => {
  it("ne garde que les publiés", () => {
    const list = [PUBLISHED, { publication: "withdrawn" }, { laundryRisk: "LOW" }, null];
    expect(filterPublishedLaundryTrails(list as never)).toEqual([PUBLISHED]);
  });

  it("rend un tableau vide sur une entrée non-tableau", () => {
    for (const v of [null, undefined, "nope", 42, {}]) {
      expect(filterPublishedLaundryTrails(v as never)).toEqual([]);
    }
  });
});

describe("readPublishedLaundryTrail — la lecture unique", () => {
  const reader = (impl: () => Promise<unknown>) => ({ laundryTrail: { findFirst: impl } });

  it("pose le filtre dans le `where` ET revérifie l'objet", async () => {
    const findFirst = vi.fn().mockResolvedValue(PUBLISHED);
    const out = await readPublishedLaundryTrail(reader(findFirst) as never, "someone", { laundryRisk: true });
    expect(out).toEqual(PUBLISHED);
    const args = findFirst.mock.calls[0][0];
    expect(args.where).toMatchObject({ kolHandle: "someone", ...PUBLISHED_LAUNDRY_FILTER });
    // L'état est toujours demandé, même quand l'appelant ne le demande pas.
    expect(args.select).toMatchObject(LAUNDRY_PUBLICATION_SELECT);
  });

  it("refuse un trail que la base rendrait malgré le filtre (défense en profondeur)", async () => {
    const out = await readPublishedLaundryTrail(
      reader(async () => ({ publication: "withdrawn", narrativeText: "…" })) as never,
      "someone",
    );
    expect(out).toBeNull();
  });

  it("CAS 4 — une lecture qui LÈVE ne publie pas, et ne propage pas l'exception", async () => {
    // Colonne pas encore créée, base injoignable, client non régénéré : entre
    // la mise en production du code et l'exécution de la migration, ce chemin
    // est le chemin normal. Il doit rendre « aucun trail », pas une 500.
    const out = await readPublishedLaundryTrail(
      reader(async () => {
        throw new Error('Unknown field `publication` for select statement on model `LaundryTrail`');
      }) as never,
      "someone",
    );
    expect(out).toBeNull();
  });

  it("refuse un handle vide sans toucher la base", async () => {
    const findFirst = vi.fn();
    expect(await readPublishedLaundryTrail(reader(findFirst) as never, "")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rend null quand la base ne trouve rien", async () => {
    expect(await readPublishedLaundryTrail(reader(async () => null) as never, "someone")).toBeNull();
  });
});

describe("aucune sortie par l'environnement", () => {
  it("le module ne lit aucune variable d'environnement", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/laundry/publicationGate.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/SKIP_|FORCE_|ALLOW_|BYPASS_|DISABLE_|NODE_ENV/);
  });
});

describe("vocabulaire aligné sur le registre des proceeds", () => {
  it("les motifs sont exactement ceux de KolProceedsPublicationLog", () => {
    // Deux registres qui parlent de publication nominative doivent s'agréger
    // ensemble : une liste qui diverge rend le décompte « combien de retraits
    // pour erratum » impossible à produire.
    expect([...LAUNDRY_DECISION_CODES].sort()).toEqual(
      ["approved", "contested", "duplicate", "erratum", "evidence_withdrawn", "legal", "other", "rejected"],
    );
  });

  it("les états sont les deux mêmes que pour les proceeds", () => {
    expect([...LAUNDRY_PUBLICATION_STATES]).toEqual(["published", "withdrawn"]);
  });

  it("les portées couvrent le texte, le risque, et la ligne entière", () => {
    expect([...LAUNDRY_DECISION_SCOPES]).toEqual(["trail_full", "trail_narrative", "trail_risk"]);
  });
});

describe("les six surfaces — couverture, y compris ce qui n'est pas encore appliqué", () => {
  // Ce test est la garantie de complétude. Il énumère les six surfaces
  // relevées en A11 et exige que CHACUNE soit soit filtrée dans l'arbre, soit
  // couverte par un patch prêt — jamais oubliée.
  //
  // Quatre d'entre elles vivent sur des chemins GELÉS par
  // scripts/guard-offline.sh. Aucun contournement n'a été fait : leurs
  // correctifs attendent sous docs/prep/patches/, vérifiés `git apply`,
  // typecheck et suite complète au vert avant d'être remis à l'état d'origine.
  const SURFACES: Array<{ label: string; file: string; via: "arbre" | "patch" | "gate" }> = [
    { label: "GET /api/laundry/{handle}", file: "src/app/api/laundry/[handle]/route.ts", via: "patch" },
    { label: "GET /api/kol/{handle}/pedigree", file: "src/app/api/kol/[handle]/pedigree/route.ts", via: "patch" },
    { label: "GET /api/pdf/kol (mode lawyer)", file: "src/app/api/pdf/kol/route.ts", via: "patch" },
    { label: "LaundryTrailCard (fr/kol/[handle])", file: "src/components/LaundryTrailCard.tsx", via: "patch" },
    { label: "/api/scan/ask", file: "src/lib/ask/groundingContext.ts", via: "arbre" },
    { label: "/api/mobile/v1/ask", file: "src/lib/ask/groundingContext.ts", via: "arbre" },
  ];

  const patchDir = path.join(process.cwd(), "docs/prep/patches");

  for (const s of SURFACES) {
    it(`${s.label} — filtrée (${s.via})`, () => {
      if (s.via === "arbre") {
        const src = fs.readFileSync(path.join(process.cwd(), s.file), "utf8");
        expect(src, s.file).toContain("publicationGate");
        return;
      }
      // Un patch doit exister ET nommer le fichier ET importer le gate.
      const patches = fs.readdirSync(patchDir).filter((f) => f.startsWith("A12-surface"));
      const hit = patches
        .map((f) => fs.readFileSync(path.join(patchDir, f), "utf8"))
        .find((body) => body.includes(s.file));
      expect(hit, `aucun patch ne couvre ${s.file}`).toBeDefined();
      expect(hit).toContain("publicationGate");
    });
  }

  it("les deux surfaces `ask` sont couvertes par le MÊME point, pas par deux copies", () => {
    // C'est l'intérêt du point unique : `/api/scan/ask` et `/api/mobile/v1/ask`
    // consomment tous deux `hasLaundryTrail` depuis groundingContext. Filtrer
    // une fois les couvre tous les deux — et aucune des deux routes, toutes
    // deux gelées, n'a eu besoin d'être touchée.
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/ask/groundingContext.ts"), "utf8");
    expect(src).toContain("readPublishedLaundryTrail");
    expect(src).not.toMatch(/laundryTrails:\s*\{\s*select/);
  });

  it("la migration qui pose l'interrupteur existe, et n'est pas appliquée", () => {
    const sql = fs.readFileSync(path.join(patchDir, "A12-MIGRATION_laundry_publication_v1.sql"), "utf8");
    expect(sql).toContain("STATUS: NON APPLIQUÉE");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "publication"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "LaundryTrailPublicationLog"');
    // Aucune destruction, jamais — vérifié sur le SQL DÉPOUILLÉ de ses
    // commentaires : le fichier DIT « aucun DROP », et cette phrase ne doit pas
    // faire échouer sa propre vérification. (Même piège qu'en A9.)
    const statements = sql.replace(/^\s*--.*$/gm, "");
    expect(statements).not.toMatch(/\bDROP\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
    // Et aucune décision : la migration pose l'interrupteur, elle ne l'actionne pas.
    expect(statements).not.toMatch(/UPDATE\s+"LaundryTrail"/i);
  });
});
