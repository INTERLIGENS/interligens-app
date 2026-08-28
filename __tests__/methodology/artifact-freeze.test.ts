import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FINANCIAL_ESTIMATES_V1,
  FINANCIAL_ESTIMATES_V1_SHA256,
  serializeArtifactBody,
} from "@/lib/methodology/artifact";
import {
  resolveMethodRef,
  isKnownMethodRef,
  EST_PROCEEDS_V1,
  RETAIL_LOSS_ESTIMATE_RULE,
} from "@/lib/methodology/registry";

const ARTIFACT_PATH = join(
  process.cwd(),
  "content/methodologies/financial-estimates/v1.md",
);

function artifactFile(): string {
  return readFileSync(ARTIFACT_PATH, "utf8");
}

/** Le corps gelé : tout ce qui suit le chapeau, c.-à-d. à partir du 1er composant. */
function frozenBody(md: string): string {
  const first = md.indexOf(`## ${FINANCIAL_ESTIMATES_V1.components[0].id} `);
  expect(first).toBeGreaterThan(-1);
  return md.slice(first).replace(/\n+$/, "");
}

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("S5-A · l'artefact de méthodologie est GELÉ", () => {
  it("le corps du .md correspond au contentSha256 déclaré dans son frontmatter", () => {
    const md = artifactFile();
    const declared = /contentSha256: ([0-9a-f]{64})/.exec(md)?.[1];
    expect(declared).toBeDefined();
    expect(sha(frozenBody(md))).toBe(declared);
  });

  it("le miroir TypeScript reproduit le .md OCTET POUR OCTET", () => {
    // C'est ce test qui autorise la page à lire le miroir plutôt que le fichier :
    // sans lui, les deux dériveraient en silence.
    expect(serializeArtifactBody(FINANCIAL_ESTIMATES_V1)).toBe(frozenBody(artifactFile()));
  });

  it("le hash exporté est celui du miroir", () => {
    expect(sha(serializeArtifactBody(FINANCIAL_ESTIMATES_V1))).toBe(
      FINANCIAL_ESTIMATES_V1_SHA256,
    );
    expect(FINANCIAL_ESTIMATES_V1.contentSha256).toBe(FINANCIAL_ESTIMATES_V1_SHA256);
  });

  it("l'artefact est déclaré FROZEN et daté", () => {
    const md = artifactFile();
    expect(md).toContain("status: FROZEN");
    expect(FINANCIAL_ESTIMATES_V1.effectiveFrom).toBe("2026-03-19");
    expect(FINANCIAL_ESTIMATES_V1.version).toBe("v1");
  });

  it("les identifiants de composants sont stables et uniques", () => {
    const ids = FINANCIAL_ESTIMATES_V1.components.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("est-proceeds");
    expect(ids).toContain("est-investor-losses");
  });
});

describe("S5-A · la page est une VUE, pas la source", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/en/methodology/page.tsx"),
    "utf8",
  );

  it("la page ne contient plus AUCUN corps de méthode en dur", () => {
    for (const c of FINANCIAL_ESTIMATES_V1.components) {
      // Un fragment suffisamment long pour être discriminant.
      expect(page).not.toContain(c.body.slice(0, 60));
    }
  });

  it("la page rend l'artefact", () => {
    expect(page).toContain("FINANCIAL_ESTIMATES_V1.components.map");
    expect(page).toContain("@/lib/methodology/artifact");
  });
});

describe("S5-A · la convention <slug>/<component>@<version>", () => {
  it("résout la référence citée par les 10 KolCase de S5-B", () => {
    const r = resolveMethodRef(EST_PROCEEDS_V1);
    expect(EST_PROCEEDS_V1).toBe("financial-estimates/est-proceeds@v1");
    expect(r).not.toBeNull();
    expect(r!.componentId).toBe("est-proceeds");
    expect(r!.artifact.version).toBe("v1");
    expect(r!.componentBody).toContain("insider-linked or promoter-linked wallets");
  });

  it("REFUSE tout ce qui ne résout pas sur un artefact gelé", () => {
    // Une méthodologie qui ne résout pas ne doit jamais atteindre la base.
    for (const bad of [
      "legacy",                                  // la fausse référence interdite
      "/en/methodology",                         // la route actuelle, non versionnée
      "financial-estimates@v1",                  // composant manquant
      "financial-estimates/est-proceeds",        // version manquante
      "financial-estimates/est-proceeds@v2",     // version inexistante
      "financial-estimates/does-not-exist@v1",   // composant inexistant
      "unknown/est-proceeds@v1",                 // méthodologie inconnue
      "",
    ]) {
      expect(isKnownMethodRef(bad)).toBe(false);
      expect(resolveMethodRef(bad)).toBeNull();
    }
  });
});

describe("S5-A · la règle retailLossEstimateUsd est écrite, pas encore contrainte", () => {
  it("nomme sa condition et son composant, et déclare le CHECK différé", () => {
    expect(RETAIL_LOSS_ESTIMATE_RULE.table).toBe("KolTokenInvolvement");
    expect(RETAIL_LOSS_ESTIMATE_RULE.requiresMethodRefWhen).toContain("ESTIMATE");
    expect(isKnownMethodRef(
      `${RETAIL_LOSS_ESTIMATE_RULE.applicableComponent}@v1`,
    )).toBe(true);
    expect(RETAIL_LOSS_ESTIMATE_RULE.dbConstraint).toContain("DEFERRED");
  });
});
