/**
 * __tests__/api/cronInventory.test.ts
 *
 * L'inventaire de docs/CRON_INVENTORY.md n'a de valeur que s'il reste vrai.
 * Ces tests lient le document à vercel.json et au disque : une route ajoutée,
 * renommée ou planifiée sans passer par l'arbitrage fait échouer la suite.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
};
const doc = fs.readFileSync("docs/CRON_INVENTORY.md", "utf8");

/** Toutes les routes réellement présentes sous src/app/api/cron. */
function cronRoutesOnDisk(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") {
        out.push("/" + path.relative("src/app", path.dirname(p)));
      }
    }
  };
  walk("src/app/api/cron");
  return out.sort();
}

describe("inventaire cron — le document reste vrai", () => {
  it("chaque route sur disque est arbitrée dans le document", () => {
    const manquantes = cronRoutesOnDisk().filter((r) => !doc.includes(r));
    expect(manquantes, `routes non arbitrées : ${manquantes.join(", ")}`).toEqual([]);
  });

  it("chaque cron planifié dans vercel.json apparaît dans le document", () => {
    const manquants = vercel.crons.map((c) => c.path).filter((p) => !doc.includes(p));
    expect(manquants, `crons non documentés : ${manquants.join(", ")}`).toEqual([]);
  });

  it("chaque cron planifié pointe sur une route qui existe vraiment", () => {
    for (const c of vercel.crons) {
      // Les routes dynamiques ([slug]) ne se résolvent pas par chemin littéral.
      const literal = path.join("src/app", c.path, "route.ts");
      const dynamic = c.path.replace(/\/[^/]+$/, "/[slug]");
      const dynamicFile = path.join("src/app", dynamic, "route.ts");
      const exists = fs.existsSync(literal) || fs.existsSync(dynamicFile);
      expect(exists, `${c.path} : aucune route sur disque`).toBe(true);
    }
  });

  it("price-cache-refresh reste NON planifié tant que TokenPriceTracker n'a pas de lecteur", () => {
    // Le jour où un lecteur existe, ce test doit être mis à jour EN MÊME TEMPS
    // que la planification — c'est le point : la décision est explicite.
    const planifie = vercel.crons.some((c) => c.path === "/api/cron/price-cache-refresh");
    expect(planifie).toBe(false);
  });

  it("aucun doublon de chemin dans vercel.json", () => {
    const paths = vercel.crons.map((c) => c.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
