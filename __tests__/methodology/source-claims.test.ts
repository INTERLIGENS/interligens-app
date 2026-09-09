// ─── WATCHDOG §1 · UNE CAPACITÉ ANNONCÉE DOIT AVOIR TOURNÉ ─────────────────
//
// ██  On n'annonce pas une source qui n'a jamais produit une ligne.        ██
//
// Mesuré en production le 2026-09-09 :
//
//   slug        registre        lots  observations
//   goplus      ABSENT          0     0
//   goplusec    présent         0     0
//   amf         ABSENT          0     0
//   fca         ABSENT          0     0
//   forta       présent         0     3   (écrites hors pipeline)
//
// Les pages de méthodologie annonçaient pourtant, en EN et en FR :
//   « GoPlus — Honeypot and phishing contract detection. »
//   « OFAC / sanctions, Scam Sniffer, GoPlus, … »
//   { name: "GoPlus", status: "LIVE" }
//
// Une capacité annoncée `LIVE` pour un collecteur qui n'a jamais tourné est une
// revendication fausse. Elle est retirée, et ce test empêche son retour.
//
// ─── Périmètre, et il est étroit ──────────────────────────────────────────
//
// GoPlus UNIQUEMENT. `amf`, `fca` et `forta` apparaissent ailleurs dans le
// produit et ne sont PAS touchées ici : elles sont énumérées dans le rapport,
// et leur sort est un arbitrage, pas une exécution.
//
// Ce test ne dit pas « GoPlus est mauvais ». Il dit : tant que le collecteur
// n'a produit aucune ligne, la page ne l'annonce pas. Le jour où il tourne, on
// retire la source de la liste ci-dessous et la revendication redevient
// légitime — c'est un verrou daté, pas un interdit permanent.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..", "..");

/**
 * Les sources dont AUCUNE ligne n'existe en production au 2026-09-09, et qui ne
 * peuvent donc pas être annoncées comme une capacité.
 *
 * `forta` n'y est PAS : il a 3 observations. Elles sont hors pipeline et non
 * retail-admissibles (AX), mais elles existent — c'est un autre défaut, et le
 * confondre avec celui-ci brouillerait les deux.
 */
const SOURCES_SANS_AUCUNE_LIGNE = ["goplus", "goplusec"] as const;

/** Les surfaces PUBLIÉES qui décrivent la méthodologie au lecteur. */
const SURFACES = ["src/app/en/methodology", "src/app/fr/methodology"];

function fichiersDe(dir: string): string[] {
  const abs = join(RACINE, dir);
  const out: string[] = [];
  const marcher = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marcher(p);
      else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
    }
  };
  marcher(abs);
  return out;
}

describe("les pages de méthodologie n'annoncent aucune source sans run", () => {
  const fichiers = SURFACES.flatMap(fichiersDe);

  it("les surfaces publiées sont bien trouvées", () => {
    // Sans ça, un test qui ne lit aucun fichier passerait pour vert.
    expect(fichiers.length).toBeGreaterThanOrEqual(4);
  });

  for (const source of SOURCES_SANS_AUCUNE_LIGNE) {
    it(`MUTANT — \`${source}\` n'est annoncé sur aucune surface publiée`, () => {
      const coupables: string[] = [];
      for (const f of fichiers) {
        const src = readFileSync(f, "utf8");
        if (new RegExp(source, "i").test(src)) {
          coupables.push(f.replace(RACINE + "/", ""));
        }
      }
      expect(
        coupables,
        `\`${source}\` n'a produit AUCUNE ligne en production. ` +
          `L'annoncer est une capacité qui n'existe pas. Fichiers : ${coupables.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("SUR-CORRECTION — les sources qui ONT tourné restent annonçables", () => {
    // Retirer toutes les sources serait aussi faux que d'en annoncer une qui
    // n'existe pas. `ofac` (869 observations, 29 lots) et `scamsniffer`
    // (341 195 observations, 32 lots) doivent rester présentes.
    const tout = fichiers.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(tout).toMatch(/OFAC/i);
    expect(tout).toMatch(/Scam ?Sniffer/i);
  });

  it("aucune surface ne présente une source sans run comme `LIVE`", () => {
    // La formulation la plus forte, et celle qui était publiée :
    // `{ name: "GoPlus", status: "LIVE" }`.
    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      for (const source of SOURCES_SANS_AUCUNE_LIGNE) {
        const ligneLive = new RegExp(`${source}[^\\n]*LIVE|LIVE[^\\n]*${source}`, "i");
        expect(ligneLive.test(src), `${f} annonce ${source} en LIVE`).toBe(false);
      }
    }
  });
});
