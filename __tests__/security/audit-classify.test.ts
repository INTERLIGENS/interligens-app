// ─────────────────────────────────────────────────────────────────────────────
// Dependency Audit — le classement doit distinguer ce qui est livré de ce qui
// ne l'est pas. « 57 high » indistincts ne disent rien : sur ce dépôt, 29 des
// 57 vivent dans l'outillage et ne s'exécutent jamais en production.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { racine, classer, resume } from "../../scripts/audit-classify.mjs";

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
