// __tests__/anti-regression/cronRoutesProdWriteGuard.test.ts
//
// Le garde par route est explicite et greppable, mais une route cron ajoutée
// demain l'oublierait sans que rien ne le signale. Ce test lit l'arborescence
// réelle : toute nouvelle route sous /api/cron ou /api/intelligence/ingest
// doit soit appeler le garde, soit être inscrite ci-dessous avec sa raison.
//
// Il ne remplace pas __tests__/security/prodWriteGuard.test.ts, qui prouve le
// comportement. Celui-ci prouve seulement la couverture.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const API_DIR = path.resolve(__dirname, "../../src/app/api");
const SCANNED = ["cron", "intelligence/ingest"];

/**
 * Routes délibérément non gardées, avec justification écrite.
 * Une entrée sans raison n'est pas une dispense.
 */
const UNGUARDED_BY_DESIGN: Readonly<Record<string, string>> = Object.freeze({
  "cron/digest/route.ts":
    "no-op déprécié — fusionné dans weekly-digest, ne touche ni la base ni aucune API",
  "cron/security-weekly-digest/route.ts":
    "no-op déprécié — fusionné dans weekly-digest, ne touche ni la base ni aucune API",
});

function findRoutes(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) findRoutes(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

const routes = SCANNED.flatMap((sub) => findRoutes(path.join(API_DIR, sub))).map((full) =>
  path.relative(API_DIR, full),
);

describe("couverture du garde d'écriture production sur les routes cron", () => {
  it("trouve bien les routes sur le disque (le test ne doit pas être vert à vide)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(20);
  });

  it.each(routes)("%s appelle le garde, ou est dispensée avec raison", (rel) => {
    const src = readFileSync(path.join(API_DIR, rel), "utf8");
    const guarded = src.includes("prodWriteGuardResponse(");

    if (guarded) {
      expect(guarded).toBe(true);
      return;
    }

    const reason = UNGUARDED_BY_DESIGN[rel.split(path.sep).join("/")];
    expect(
      typeof reason === "string" && reason.trim() !== "",
      `${rel} n'appelle pas prodWriteGuardResponse et n'est pas inscrite dans ` +
        `UNGUARDED_BY_DESIGN. Ajoutez le garde, ou inscrivez la route avec sa raison.`,
    ).toBe(true);
  });

  it("aucune dispense périmée : chaque entrée pointe une route qui existe encore", () => {
    const onDisk = new Set(routes.map((r) => r.split(path.sep).join("/")));
    for (const rel of Object.keys(UNGUARDED_BY_DESIGN)) {
      expect(onDisk.has(rel), `dispense périmée pour ${rel}`).toBe(true);
    }
  });
});
