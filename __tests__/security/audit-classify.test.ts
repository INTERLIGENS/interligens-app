// ─────────────────────────────────────────────────────────────────────────────
// Dependency Audit — le classement doit distinguer ce qui est livré de ce qui
// ne l'est pas. « 57 high » indistincts ne disent rien : sur ce dépôt, 29 des
// 57 vivent dans l'outillage et ne s'exécutent jamais en production.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { racine, classer, resume, bloquantes, versBaseline } from "../../scripts/audit-classify.mjs";
import { compare, total } from "../../scripts/ratchet-check.mjs";

const pkg = {
  dependencies: { next: "16", "@aws-sdk/client-s3": "3" },
  devDependencies: { eslint: "9", vitest: "4" },
};

const adv = (module: string, severity: string, paths: string[]) => ({
  module_name: module,
  severity,
  github_advisory_id: `GHSA-${module}`,
  findings: [{ paths }],
});

describe("audit — racine d'un chemin de dépendance", () => {
  it("« .>eslint>minimatch » a pour racine eslint", () => {
    expect(racine(".>eslint>minimatch")).toBe("eslint");
  });
  it("un chemin sans « . » de tête reste lisible", () => {
    expect(racine("next>postcss")).toBe("next");
  });
});

describe("audit — classement prod / dev / inconnu", () => {
  it("une faille sous une dépendance de production est PROD", () => {
    const l = classer({ advisories: { a: adv("postcss", "high", [".>next>postcss"]) } }, pkg);
    expect(l[0].portee).toBe("prod");
    expect(l[0].lien).toBe("transitive");
  });

  it("une faille sous une dépendance de DÉVELOPPEMENT est DEV, pas prod", () => {
    const l = classer({ advisories: { a: adv("minimatch", "high", [".>eslint>minimatch"]) } }, pkg);
    expect(l[0].portee).toBe("dev");
  });

  it("le paquet vulnérable qui EST la dépendance directe est marqué directe", () => {
    const l = classer({ advisories: { a: adv("next", "high", [".>next"]) } }, pkg);
    expect(l[0].lien).toBe("directe");
    expect(l[0].portee).toBe("prod");
  });

  it("atteinte par DEUX racines dont une de prod → PROD l'emporte", () => {
    // Le pire cas gouverne : si un seul chemin atteint le code livré, la faille
    // est livrée. Compter la même advisory comme « dev » serait la perdre.
    const l = classer(
      { advisories: { a: adv("postcss", "high", [".>eslint>postcss", ".>next>postcss"]) } },
      pkg
    );
    expect(l[0].portee).toBe("prod");
    expect(l[0].racines).toEqual(["eslint", "next"]);
  });

  it("une racine absente des deux listes est INCONNU, pas silencieusement dev", () => {
    const l = classer({ advisories: { a: adv("x", "high", [".>mystere>x"]) } }, pkg);
    expect(l[0].portee).toBe("inconnu");
  });

  it("le résumé ventile par portée ET par sévérité", () => {
    const l = classer(
      {
        advisories: {
          a: adv("next", "high", [".>next"]),
          b: adv("minimatch", "high", [".>eslint>minimatch"]),
          c: adv("y", "moderate", [".>eslint>y"]),
        },
      },
      pkg
    );
    expect(resume(l)).toEqual({ prod: { high: 1 }, dev: { high: 1, moderate: 1 } });
  });

  it("un audit vide ne casse pas", () => {
    expect(classer({}, pkg)).toEqual([]);
    expect(resume([])).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LE CLIQUET D'AUDIT — c'est lui qui porte désormais le verdict bloquant du job
// Dependency Audit. `pnpm audit --audit-level=moderate` était rouge sur 112
// advisories historiques : toujours rouge, donc muet. Le cliquet accepte la
// baseline versionnée et n'échoue que sur la dette NEUVE.
//
// Il n'y a pas de deuxième mécanique : `compare()` est celle de la dette de
// lint, importée telle quelle. Ces tests le vérifient sur la forme des
// advisories.
// ─────────────────────────────────────────────────────────────────────────────
describe("audit — le cliquet sur la dette atteignant le code livré", () => {
  const prodHigh = adv("next", "high", [".>next"]);
  const prodMod = adv("postcss", "moderate", [".>next>postcss"]);
  const devHigh = adv("minimatch", "high", [".>eslint>minimatch"]);

  it("seules les advisories PROD high+ entrent dans le périmètre bloquant", () => {
    // Une faille dans une dépendance d'ESLint ne s'exécute jamais en
    // production : elle reste mesurée et imprimée, elle ne bloque pas.
    const l = classer({ advisories: { a: prodHigh, b: prodMod, c: devHigh } }, pkg);
    expect(bloquantes(l).map((x: { module: string }) => x.module)).toEqual(["next"]);
  });

  it("une advisory critical de prod bloque aussi, pas seulement high", () => {
    const l = classer({ advisories: { a: adv("next", "critical", [".>next"]) } }, pkg);
    expect(bloquantes(l)).toHaveLength(1);
  });

  it("la baseline a la forme que compare() sait lire : module → id → count", () => {
    const l = classer({ advisories: { a: prodHigh } }, pkg);
    expect(versBaseline(bloquantes(l))).toEqual({ next: { "GHSA-next": { count: 1 } } });
    expect(total(versBaseline(bloquantes(l)))).toBe(1);
  });

  it("la baseline historique, inchangée, ne fait AUCUN manquement", () => {
    const l = bloquantes(classer({ advisories: { a: prodHigh } }, pkg));
    const map = versBaseline(l);
    expect(compare(map, map)).toEqual([]);
  });

  it("une advisory NEUVE atteignant le code livré est un manquement", () => {
    const base = versBaseline(bloquantes(classer({ advisories: { a: prodHigh } }, pkg)));
    const head = versBaseline(
      bloquantes(
        classer({ advisories: { a: prodHigh, b: adv("@aws-sdk/client-s3", "high", [".>@aws-sdk/client-s3"]) } }, pkg)
      )
    );
    const faults = compare(base, head);
    expect(faults.length).toBeGreaterThan(0);
    expect(faults.join(" ")).toContain("GHSA-@aws-sdk/client-s3");
  });

  it("une advisory NEUVE bloque MÊME SI une autre a été corrigée (total constant)", () => {
    // Le piège que la seule règle de total laisserait passer : on remplace une
    // dette par une autre, le compte ne bouge pas, et la régression est neuve.
    const base = versBaseline(bloquantes(classer({ advisories: { a: prodHigh } }, pkg)));
    const head = versBaseline(
      bloquantes(classer({ advisories: { b: adv("@aws-sdk/client-s3", "high", [".>@aws-sdk/client-s3"]) } }, pkg))
    );
    expect(total(base)).toBe(total(head));
    expect(compare(base, head)).not.toEqual([]);
  });

  it("corriger une advisory de la baseline ne bloque pas — le cliquet descend", () => {
    const base = versBaseline(
      bloquantes(
        classer({ advisories: { a: prodHigh, b: adv("@aws-sdk/client-s3", "high", [".>@aws-sdk/client-s3"]) } }, pkg)
      )
    );
    const head = versBaseline(bloquantes(classer({ advisories: { a: prodHigh } }, pkg)));
    expect(compare(base, head)).toEqual([]);
  });

  it("une advisory qui PASSE de dev à prod devient neuve, donc bloque", () => {
    // Elle existait, mais elle n'atteignait pas le code livré. Le jour où une
    // dépendance de prod l'introduit, c'est une régression réelle.
    const base = versBaseline(bloquantes(classer({ advisories: { c: devHigh } }, pkg)));
    expect(total(base)).toBe(0);
    const head = versBaseline(
      bloquantes(classer({ advisories: { c: adv("minimatch", "high", [".>next>minimatch"]) } }, pkg))
    );
    expect(compare(base, head)).not.toEqual([]);
  });
});
