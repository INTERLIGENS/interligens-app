// ─── LE TERMINAL DE COLLECTION — ET LA COUCHE 2 TENUE PAR LE TYPE ────────
//
// `projeterCollection` rend une `CollectionGouvernee`. La frontière, elle,
// n'accepte qu'un `Admissible`. Sans terminal, une surface ayant fait tout le
// travail d'appartenance devrait sortir par un `NextResponse.json` nu — et la
// marque cesserait d'être portante AU DERNIER MÈTRE, précisément là où elle
// compte.
//
// Deux niveaux, comme partout dans ce module :
//   LE TYPE   une collection qui transporte un champ nu NE COMPILE PAS.
//   LA GARDE  un `as` fait taire le compilateur ; le filet est dessous.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { admettreAnonyme, repondre } from "@/lib/governance/audienceProjection";
import {
  declarerCollection,
  projeterCollectionAdmissible,
  type AutoriteDAppartenance,
} from "@/lib/governance/appartenance";
import {
  constaterDecision,
  gouverner,
  type EnregistrementGouverne,
} from "@/lib/governance/uniteGouvernee";

const APPARTENANCE = resolve("src/lib/governance/appartenance");
const UNITE = resolve("src/lib/governance/uniteGouvernee");
const PROJECTION = resolve("src/lib/governance/audienceProjection");

// ═══════════════════════════════════════════════════════════════════════════
// NIVEAU 1 — LE TYPE
// ═══════════════════════════════════════════════════════════════════════════

const CORPUS: ReadonlyArray<{ nom: string; compile: boolean; source: string }> = [
  {
    // Une collection NON_ASSERTIVE dispensée de décision d'appartenance, dont
    // les membres présentent chacun la leur. C'est la forme ratifiée.
    nom: "collection-dispensee-membres-gouvernes",
    compile: true,
    source: `import { admettreAnonyme, repondre } from "${PROJECTION}";
import { declarerCollection, projeterCollectionAdmissible } from "${APPARTENANCE}";
import { constaterDecision, gouverner } from "${UNITE}";
const d = constaterDecision("PlatformCaseFile.publishStatus", "R", "published", true)!;
export function GET() {
  const a = admettreAnonyme("index public");
  const membres = [{ ref: gouverner("OBSERVATION", "R-1", d) }];
  return repondre(projeterCollectionAdmissible(a, declarerCollection("Dossiers", "NON_ASSERTIVE", null), membres));
}`,
  },
  {
    // ██ LE MUTANT DE LA COUCHE 2 ██
    //
    // La dispense porte sur l'APPARTENANCE, jamais sur le CONTENU. Une
    // collection dispensée qui transporterait un champ nu doit être refusée
    // par le compilateur — sinon `NON_ASSERTIVE` deviendrait une porte de
    // sortie pour la donnée brute, ce qui serait pire que son absence.
    nom: "collection-dispensee-champ-nu",
    compile: false,
    source: `import { admettreAnonyme, repondre } from "${PROJECTION}";
import { declarerCollection, projeterCollectionAdmissible } from "${APPARTENANCE}";
export function GET() {
  const a = admettreAnonyme("index public");
  const membres = [{ ref: "R-1", interne: "ne sort pas" }];
  return repondre(projeterCollectionAdmissible(a, declarerCollection("Dossiers", "NON_ASSERTIVE", null), membres));
}`,
  },
  {
    // La sémantique d'appartenance n'est pas un booléen, et elle n'est pas
    // optionnelle. On ne peut pas « oublier » de déclarer.
    nom: "semantique-booleenne",
    compile: false,
    source: `import { declarerCollection } from "${APPARTENANCE}";
export const c = declarerCollection("Dossiers", false, null);`,
  },
  {
    nom: "semantique-omise",
    compile: false,
    source: `import { declarerCollection } from "${APPARTENANCE}";
export const c = declarerCollection("Dossiers", null);`,
  },
  {
    // Et la valeur inventée ne passe pas davantage : l'union est fermée.
    nom: "semantique-inventee",
    compile: false,
    source: `import { declarerCollection } from "${APPARTENANCE}";
export const c = declarerCollection("Dossiers", "PEUT-ETRE", null);`,
  },
];

const erreurs = new Map<string, string>();

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "terminal-"));
  try {
    const chemins = CORPUS.map((c) => {
      const p = join(dir, `${c.nom}.ts`);
      writeFileSync(p, c.source, "utf8");
      return p;
    });
    let sortie = "";
    try {
      execFileSync(
        "npx",
        ["tsc", "--noEmit", "--strict", "--target", "es2022", "--module", "esnext",
         "--moduleResolution", "bundler", "--lib", "es2022,dom", ...chemins],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) {
      sortie = String((e as { stdout?: string }).stdout ?? "");
    }
    for (const ligne of sortie.split("\n")) {
      const m = ligne.match(/([^/\\]+)\.ts\(\d+,\d+\): (error TS\d+: .*)/);
      if (m && !erreurs.has(m[1])) erreurs.set(m[1], m[2]);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 180_000);

describe("LE TYPE — la couche 2 n'est pas rachetée par la dispense", () => {
  it("PRÉALABLE — le compilateur a effectivement tourné", () => {
    // Un « rien à signaler » et un « je n'ai pas regardé » rendent le même vert.
    expect(erreurs.size, "tsc n'a pas tourné").toBeGreaterThan(0);
  });

  it.each(CORPUS.map((c) => [c.nom, c.compile] as const))("%s — compile = %s", (nom, compile) => {
    const err = erreurs.get(nom);
    if (compile) expect(err, `${nom} devait compiler : ${err}`).toBeUndefined();
    else {
      expect(err, `${nom} devait être REFUSÉ, et il passe`).toBeDefined();
      expect(err).toMatch(/TS2345|TS2322|TS2739|TS2554/);
    }
  });

  it("██ le champ nu est refusé SUR LA VALEUR, pas sur autre chose", () => {
    expect(erreurs.get("collection-dispensee-champ-nu")).toMatch(/not assignable|missing/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NIVEAU 2 — LA GARDE, SOUS LE TYPE
// ═══════════════════════════════════════════════════════════════════════════

const admission = admettreAnonyme("test terminal");
const decision = () => constaterDecision("KolProfile.publishStatus", "s", "published", true)!;
const membres = (n: number): EnregistrementGouverne[] =>
  Array.from({ length: n }, (_, i) => ({
    handle: gouverner("OBSERVATION", `sujet_${i}`, decision()),
  }));

const corps = async (autorite: AutoriteDAppartenance<string>, m: EnregistrementGouverne[]) =>
  (await repondre(projeterCollectionAdmissible(admission, autorite, m)).text());

describe("LE TERMINAL — il délègue, il ne re-décide pas", () => {
  it("NON_ASSERTIVE traverse, et les membres sortent DÉVOILÉS", async () => {
    const c = JSON.parse(await corps(declarerCollection("Dossiers", "NON_ASSERTIVE", null), membres(3)));
    expect(c.collection).toBe("Dossiers");
    expect(c.membres).toEqual([{ handle: "sujet_0" }, { handle: "sujet_1" }, { handle: "sujet_2" }]);
    // Les symboles ne voyagent pas : ce qui part sur le fil est du JSON
    // ordinaire. La marque a fait son travail AVANT, pas pendant.
    expect(JSON.stringify(c)).not.toContain("fondeePar");
    expect(JSON.stringify(c)).not.toContain("nature");
  });

  it("██ LE MUTANT D'OR TRAVERSE INTACT — 107 membres irréprochables, refus quand même", async () => {
    const c = JSON.parse(await corps(declarerCollection("Watchlist", "ASSERTIVE", null), membres(107)));
    expect(c).toEqual({ refus: true, code: "APPARTENANCE_NON_AUTORISEE", surface: "Watchlist" });
    expect(JSON.stringify(c)).not.toContain("sujet_");
  });

  it("██ LE TERMINAL NE ROUVRE PAS LA PORTE DE L'OMISSION", () => {
    // Le terminal n'ajoute AUCUNE branche de décision : il délègue. Une
    // collection muette est donc refusée ICI parce qu'elle l'est LÀ-BAS —
    // pas parce qu'on l'aurait revérifiée autrement. Deux expressions de la
    // même règle, c'est la faute qu'on ferme partout.
    for (const muet of [undefined, null, "", "non_assertive", true, 0]) {
      const contrefaite = { collection: "Muette", semantique: muet, fondeePar: null } as unknown as AutoriteDAppartenance<string>;
      const charge = projeterCollectionAdmissible(admission, contrefaite, membres(107)) as unknown as {
        valeur: { code?: string };
      };
      expect(charge.valeur.code, `sémantique=${String(muet)}`).toBe("APPARTENANCE_NON_DECLAREE");
    }
  });

  it("le corps de refus ne porte AUCUN compte — trois clés, zéro chiffre", async () => {
    const brut = await corps(declarerCollection("Watchlist", "ASSERTIVE", null), membres(107));
    expect(Object.keys(JSON.parse(brut)).sort()).toEqual(["code", "refus", "surface"]);
    expect(brut.replace(/[A-Z_]+/g, "")).not.toMatch(/[0-9]/);
  });

  it("MUTATION DISCRIMINANTE — la même collection FONDÉE passe, membres compris", async () => {
    // Une garde qui refuserait toujours serait désarmée.
    const c = JSON.parse(await corps(declarerCollection("Publiees", "ASSERTIVE", decision()), membres(2)));
    expect(c.refus).toBeUndefined();
    expect(c.membres).toHaveLength(2);
  });
});
