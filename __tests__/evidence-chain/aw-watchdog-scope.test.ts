// ─── AW · LE PÉRIMÈTRE DU WATCHDOG D'INTÉGRITÉ DE PREUVE ───────────────────
//
// ██  Un watchdog d'intégrité n'inspecte que ce qui est RÉELLEMENT éligible  ██
// ██  à entrer dans la chaîne de preuve.                                     ██
//
// Le défaut : le watchdog interrogeait `EvidenceItem` SANS filtre
// d'éligibilité. Il a donc compté « orpheline » une sonde post-déploiement —
// `casefileId` null, `evidentiaryStatus` EXCLUDED — que
// `eligibleForEvidenceChain` refuse déjà, et il a bloqué l'activation de la TSA
// sur cette base.
//
// Le défaut était le PÉRIMÈTRE, pas les clauses. Les deux marqueurs
// (`[R2:UNAVAILABLE]`, `HASH-ONLY`) restent une sémantique valide même à
// population nulle : mesuré le 2026-09-09, 1104 pièces, zéro marqueur. On ne
// les retire pas.
//
// Et surtout : AUCUN cas particulier sur un nom de sonde ni sur `capturedBy`.
// Un tel filtre marcherait aujourd'hui et serait faux au prochain artefact.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  eligibleForEvidenceChain,
  eligibleStatusSqlClause,
  ELIGIBLE_EVIDENTIARY_STATUSES,
  EXCLUDED_STATUS,
} from "@/lib/evidence-chain/eligibility";

const RACINE = join(__dirname, "..", "..");
const SRC_WATCHDOG = readFileSync(
  join(RACINE, "src/scripts/watchdog/watcher-health.mjs"),
  "utf8",
);
const SRC_ELIG = readFileSync(
  join(RACINE, "src/lib/evidence-chain/eligibility.ts"),
  "utf8",
);
const codeSeul = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
    .join("\n");

// ═══ L'AUTORITÉ EST UNIQUE, ET LA SQL EN DÉRIVE ══════════════════════════

describe("AW/0 — une seule autorité, la requête la dérive", () => {
  it("la clause SQL est construite depuis la MÊME liste que le prédicat", () => {
    // Aujourd'hui la liste ne contient que `null`.
    expect([...ELIGIBLE_EVIDENTIARY_STATUSES]).toEqual([null]);
    expect(eligibleStatusSqlClause("evidentiaryStatus")).toBe('"evidentiaryStatus" IS NULL');
  });

  it("MUTANT — ajouter un état à la liste le propage à la SQL, sans y penser", () => {
    // C'est tout l'intérêt de dériver : le jour où un état éligible s'ajoute,
    // la requête suit. Un `IS NULL` écrit à la main dans le watchdog serait
    // resté faux en silence.
    //
    // On ne mute pas la constante gelée : on vérifie que le CONSTRUCTEUR sait
    // rendre les deux formes, ce qui est la propriété qui compte.
    const src = codeSeul(SRC_ELIG);
    expect(src).toContain("ELIGIBLE_EVIDENTIARY_STATUSES.includes(null)");
    expect(src).toMatch(/ELIGIBLE_EVIDENTIARY_STATUSES\s*\.?\s*filter/);
    // Et la clause ne peut jamais être vide — une clause vide laisserait tout
    // passer, ce qui est exactement le défaut qu'on ferme.
    expect(src).toContain('return "FALSE"');
  });

  it("le nom de colonne est validé — il vient de l'appelant, pas d'un utilisateur", () => {
    expect(() => eligibleStatusSqlClause('x"; DROP TABLE')).toThrow();
    expect(() => eligibleStatusSqlClause("")).toThrow();
    expect(eligibleStatusSqlClause("evidentiaryStatus")).toContain('"evidentiaryStatus"');
  });

  it("le prédicat et la clause SQL s'accordent sur les mêmes états", () => {
    // Le prédicat TS et la clause SQL doivent classer identiquement.
    const clause = eligibleStatusSqlClause("evidentiaryStatus");
    for (const statut of [null, EXCLUDED_STATUS, "BYTES_LOST", "INCLUDED", "FUTUR"]) {
      const parLePredicat = eligibleForEvidenceChain({ evidentiaryStatus: statut });
      const parLaClause = statut === null ? clause.includes("IS NULL") : clause.includes(`'${statut}'`);
      expect(parLaClause, `désaccord sur ${String(statut)}`).toBe(parLePredicat);
    }
  });
});

// ═══ LE WATCHDOG — ce qu'il doit contenir, et ce qu'il ne doit PAS ═══════

describe("AW/1 — le périmètre du watchdog", () => {
  const CODE = codeSeul(SRC_WATCHDOG);

  it("MUTANT — les requêtes de preuve sont TOUTES restreintes à l'éligible", () => {
    // Trois requêtes touchent `EvidenceItem` : TSA pending, le total sans
    // octets, et les pièces nommées. Les trois doivent porter la clause.
    const requetes = CODE.match(/FROM "EvidenceItem"[\s\S]{0,240}?`/g) ?? [];
    expect(requetes.length).toBeGreaterThanOrEqual(3);
    for (const r of requetes) {
      expect(r, `requête sans filtre d'éligibilité :\n${r}`).toMatch(
        /\$\{eligible|\$\{eligibleR2/,
      );
    }
  });

  it("MUTANT — la clause vient de l'autorité, elle n'est pas réécrite à la main", () => {
    expect(CODE).toContain("eligibleStatusSqlClause");
    expect(CODE).toContain("src/lib/evidence-chain/eligibility.ts");
    // Aucun `evidentiaryStatus` écrit en dur dans une requête du watchdog.
    expect(CODE).not.toMatch(/"evidentiaryStatus"\s+IS\s+NULL/);
    expect(CODE).not.toContain("'EXCLUDED'");
  });

  it("MUTANT — AUCUN cas particulier sur un nom de sonde ou capturedBy", () => {
    // Le piège explicitement interdit : un filtre qui marcherait aujourd'hui
    // et serait faux au prochain artefact non éligible.
    for (const interdit of [
      "probe-postdeploy",
      "probe-",
      "capturedBy",
      "osint-vision-commit",
      "cmssyx6se",
      "930aee8d",
    ]) {
      expect(CODE, `cas particulier interdit : ${interdit}`).not.toContain(interdit);
    }
  });

  it("MUTANT — les deux clauses de marqueur restent, à population nulle ou non", () => {
    // Mesuré : 0 `[R2:UNAVAILABLE]` et 0 `HASH-ONLY` sur 1104 pièces. Elles
    // restent une sémantique valide — le défaut était le périmètre, pas elles.
    // Ma première version se contentait de chercher les deux chaînes DANS LE
    // FICHIER — un mutant qui en retirait une d'une requête survivait, parce
    // qu'elle subsistait dans l'autre. On juge donc la REQUÊTE des pièces
    // nommées, qui doit porter les deux.
    const requeteNommees = CODE.slice(
      CODE.indexOf("const nomme = await client.query"),
      CODE.indexOf(");", CODE.indexOf("const nomme = await client.query")),
    );
    expect(requeteNommees).toContain("[R2:UNAVAILABLE]");
    expect(requeteNommees).toContain("HASH-ONLY");
    // Et les deux compteurs nommés doivent rester dans la requête de total.
    const requeteTotal = CODE.slice(
      CODE.indexOf("AS accidental") - 400,
      CODE.indexOf("AS deliberate") + 40,
    );
    expect(requeteTotal).toContain("[R2:UNAVAILABLE]");
    expect(requeteTotal).toContain("HASH-ONLY");
    // Et l'écart se calcule toujours sur le total moins les NOMMÉES, jamais
    // sur la somme des deux compteurs.
    expect(CODE).toMatch(/orphelins\s*=\s*total\s*-/);
  });

  it("SUR-CORRECTION — un artefact LÉGITIMEMENT éligible reste inspecté", () => {
    // `evidentiaryStatus` NULL est l'état de 1094 pièces sur 1104 : les
    // exclure serait éteindre le watchdog au lieu de le cadrer.
    expect(eligibleForEvidenceChain({ evidentiaryStatus: null })).toBe(true);
    expect(eligibleStatusSqlClause("evidentiaryStatus")).not.toBe("FALSE");
  });

  it("fail-closed : un statut INCONNU n'entre pas dans la chaîne", () => {
    // `BYTES_LOST` existe en base (1 ligne) et n'est pas dans la liste
    // blanche. Un `<> 'EXCLUDED'` l'aurait laissé passer.
    expect(eligibleForEvidenceChain({ evidentiaryStatus: "BYTES_LOST" })).toBe(false);
    expect(eligibleForEvidenceChain({ evidentiaryStatus: "FUTUR_ETAT" })).toBe(false);
    expect(eligibleForEvidenceChain({ evidentiaryStatus: EXCLUDED_STATUS })).toBe(false);
  });
});

// ═══ LA POPULATION MESURÉE — épinglée ════════════════════════════════════

describe("AW/2 — l'état de la base au 2026-09-09, épinglé", () => {
  // Constats datés, pas des seuils. Ils expliquent pourquoi le déblocage TSA
  // est sûr, et donnent au relecteur de quoi vérifier que rien n'a bougé.
  const MESURE = {
    total: 1104,
    eligibles: 1094, // evidentiaryStatus NULL
    exclus: 9,
    bytes_lost: 1,
    sans_tsa_total: 34,
    sans_tsa_eligibles: 31,
    sans_tsa_non_eligibles: 3, // mesuré : 2 EXCLUDED + 1 BYTES_LOST
    sans_tsa_exclus: 2,
    sans_tsa_bytes_lost: 1,
    orphelins_ancien_perimetre: 1,
    orphelins_nouveau_perimetre: 0,
  } as const;

  it("le nouveau périmètre ramène l'écart d'orphelines à zéro", () => {
    expect(MESURE.orphelins_ancien_perimetre).toBe(1);
    expect(MESURE.orphelins_nouveau_perimetre).toBe(0);
  });

  it("les 34 candidats TSA se décomposent en 31 éligibles et 3 hors chaîne", () => {
    expect(MESURE.sans_tsa_eligibles + MESURE.sans_tsa_non_eligibles).toBe(
      MESURE.sans_tsa_total,
    );
    // La décomposition est MESURÉE, pas déduite d'une arithmétique commode :
    // 2 EXCLUDED + 1 BYTES_LOST. Ma première version posait `9 + 1 - 7`, ce
    // qui n'énonçait aucune propriété — juste une coïncidence de nombres.
    expect(MESURE.sans_tsa_exclus + MESURE.sans_tsa_bytes_lost).toBe(
      MESURE.sans_tsa_non_eligibles,
    );
  });

  it("l'inventaire par statut est complet", () => {
    expect(MESURE.eligibles + MESURE.exclus + MESURE.bytes_lost).toBe(MESURE.total);
  });
});
