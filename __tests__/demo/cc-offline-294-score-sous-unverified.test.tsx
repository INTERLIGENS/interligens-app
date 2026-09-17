// @vitest-environment jsdom
// ─── CC-OFFLINE-294 · M12 — LE REPLI NE S'AFFICHE PAS COMME « RISK SCORE » ──
//
// ██  UN REPLI INTERNE N'EST PAS UNE MESURE HUMAINE.                       ██
// ██  UNKNOWN + « RISK SCORE 20 » N'EST PAS UNE PROJECTION ACCEPTABLE.     ██
//
// CC-OFFLINE-292 avait fermé la PERMISSION : `computeScore([])` ne peut plus
// rendre ALLOW machine, SAFE partenaire, ni SAFE/CLEAN/Proceed retail. Il
// restait la DERNIÈRE MOITIÉ : le nombre lui-même, servi à un humain sous le
// libellé « RISK SCORE », rendait à cette non-mesure une AUTORITÉ VISUELLE.
//
// ⛔ CES TÉMOINS RENDENT LE COMPOSANT. Ils ne lisent pas la source : le défaut
//    fermé ici est « visible par un humain », et seule une sortie rendue en
//    répond. C'est la leçon de CC-OFFLINE-292, où un mécanisme SERVI et INERTE
//    était resté vert sous 8 048 témoins de texte.
//
// ⛔ AUCUNE SUBSTITUTION, AUCUNE SÉMANTIQUE null/zéro, AUCUN AUTRE SCORE.
//    La présentation est RETENUE, jamais remplacée.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import RetailVerdictBanner from "@/components/scan/RetailVerdictBanner";
import { computeScore } from "@/lib/scoring";

afterEach(cleanup);

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/** Le nombre exact que produit le repli legacy. Il n'est PAS écrit à la main. */
const REPLI = computeScore([]).score;

const PROPS_BASE = {
  proofs: [],
  address: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
  chain: "SOL",
  lang: "en" as const,
  actions: [],
  disclaimer: "",
};

// ═══ M12 · LE MUTANT DÉCISIF ════════════════════════════════════════════════

describe("CC-OFFLINE-294 · M12 — sous UNVERIFIED, aucun nombre ne fait autorité", () => {
  it("le repli est bien 20, et il vient de son autorité", () => {
    expect(REPLI).toBe(20);
  });

  it("⛔ M12 — GREEN + couverture insuffisante ⇒ NI le nombre, NI le libellé", () => {
    render(
      <RetailVerdictBanner {...PROPS_BASE} tier="GREEN" score={REPLI} coverageSufficient={false} />,
    );
    // L'en-tête dit l'ignorance…
    expect(screen.getByText("UNVERIFIED")).toBeTruthy();
    // …et le nombre a DISPARU du rendu, avec son libellé.
    expect(screen.queryByText(String(REPLI))).toBeNull();
    expect(screen.queryByText("RISK SCORE")).toBeNull();
  });

  it("⛔ ET RIEN N'EST SUBSTITUÉ — pas de zéro, pas de tiret, pas de « N/A »", () => {
    // Le défaut symétrique : inventer un nombre serait aussi faux que servir
    // le repli. La présentation est RETENUE, pas remplacée.
    const { container } = render(
      <RetailVerdictBanner {...PROPS_BASE} tier="GREEN" score={REPLI} coverageSufficient={false} />,
    );
    const texte = container.textContent ?? "";
    // ⚠️ Pas de cadratin nu dans cette liste : le sous-titre RATIFIÉ de l'état
    // UNKNOWN en porte un (« … did not complete — not a safety assessment »).
    // Ce qu'on interdit est un SUBSTITUT DE SCORE, pas la ponctuation d'une
    // phrase honnête.
    for (const inventé of ["N/A", "0/100", "RISK SCORE", "SCORE RISQUE"]) {
      expect(texte, inventé).not.toContain(inventé);
    }
    expect(texte).not.toMatch(/\b\d{1,3}\s*\/\s*100\b/);
    // Et aucun nombre isolé ne subsiste dans le rendu.
    expect(texte).not.toMatch(/\d/);
  });

  it("⛔ et la copie permissive reste absente — CLEAN n'est pas servi", () => {
    const { container } = render(
      <RetailVerdictBanner {...PROPS_BASE} tier="GREEN" score={REPLI} coverageSufficient={false} />,
    );
    const texte = (container.textContent ?? "").toLowerCase();
    for (const m of ["clean", "no major risk detected"]) {
      expect(texte, m).not.toContain(m);
    }
  });
});

// ═══ CONTRÔLE OBLIGATOIRE · LE NOMBRE N'A PAS ÉTÉ SUPPRIMÉ ══════════════════
//
// La preuve que la correction est une CONDITION et non une amputation.

describe("CC-OFFLINE-294 · CONTRÔLE — un score légitime reste affichable", () => {
  it("couverture SUFFISANTE ⇒ le nombre et son libellé sont SERVIS", () => {
    render(
      <RetailVerdictBanner {...PROPS_BASE} tier="GREEN" score={18} coverageSufficient={true} />,
    );
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("RISK SCORE")).toBeTruthy();
  });

  it("AUCUNE autorité de couverture (`undefined`) ⇒ comportement historique", () => {
    // Les chaînes EVM ne produisent pas de couverture. `undefined` ≠ `false`.
    render(<RetailVerdictBanner {...PROPS_BASE} tier="GREEN" score={31} />);
    expect(screen.getByText("31")).toBeTruthy();
    expect(screen.getByText("RISK SCORE")).toBeTruthy();
  });

  it("⛔ UNE GRAVITÉ GARDE SON NOMBRE, même sous couverture insuffisante", () => {
    // LA MÊME RÈGLE QU'EN M11, sur la présentation : la couverture restreint
    // une permission, elle ne réduit pas une gravité établie — et elle ne
    // supprime pas la preuve chiffrée d'une gravité réelle.
    for (const tier of ["ORANGE", "RED"] as const) {
      cleanup();
      render(
        <RetailVerdictBanner {...PROPS_BASE} tier={tier} score={87} coverageSufficient={false} />,
      );
      expect(screen.getByText("87"), tier).toBeTruthy();
      expect(screen.getByText("RISK SCORE"), tier).toBeTruthy();
    }
  });

  it("le français sert le même contrat", () => {
    render(
      <RetailVerdictBanner {...PROPS_BASE} lang="fr" tier="GREEN" score={REPLI} coverageSufficient={false} />,
    );
    expect(screen.queryByText(String(REPLI))).toBeNull();
    expect(screen.queryByText("SCORE RISQUE")).toBeNull();
    cleanup();
    render(<RetailVerdictBanner {...PROPS_BASE} lang="fr" tier="GREEN" score={12} coverageSufficient={true} />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("SCORE RISQUE")).toBeTruthy();
  });
});

// ═══ LES DEUX AUTRES PRÉSENTATIONS NUMÉRIQUES DE LA PAGE ════════════════════
//
// La bannière n'était pas la seule surface. L'anneau de score et la preuve
// « Score 20/100 · Risk assessment » rendue par `TigerRevealCard` portaient le
// même nombre. Les deux vivent sur un chemin LIBRE (les pages de démo).

describe("CC-OFFLINE-294 · l'anneau et la preuve de score suivent la même autorité", () => {
  for (const p of ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const) {
    const code = sansCommentaires(lire(p));

    it(`${p} — l'anneau n'est pas monté sous UNVERIFIED`, () => {
      expect(code).toContain("{!_nonVerifie && (");
      expect(code).toMatch(/\{!_nonVerifie && \(\s*<AnimatedScoreRing/);
    });

    it(`${p} — la preuve « Score » est retenue, par ÉGALITÉ et non par motif`, () => {
      expect(code).toContain('const LABEL_PREUVE_SCORE = "Score";');
      expect(code).toContain("result.proofs.filter((p) => p.label !== LABEL_PREUVE_SCORE)");
      // Le libellé n'est plus recopié : reconnaître six copies serait une
      // heuristique, pas une égalité.
      expect(code).not.toContain('label: "Score"');
      expect(code).toContain("label: LABEL_PREUVE_SCORE");
    });

    it(`${p} — les DEUX consommateurs de preuves reçoivent la liste projetée`, () => {
      expect(code).toContain("proofs={_proofsProjetees}");
      expect(code).not.toContain("proofs={result.proofs}");
      const occurrences = [...code.matchAll(/proofs=\{_proofsProjetees\}/g)];
      expect(occurrences.length).toBe(2);
    });

    it(`${p} — ⛔ la projection ne s'applique QU'À la présentation`, () => {
      // `result.score` et `result.tier` ne sont pas touchés ; `finalScore` non
      // plus. Seule leur MONTÉE À L'ÉCRAN est conditionnée.
      expect(code).toContain("const finalScore = _fv.score;");
      expect(code).toContain("score={result.score}");
      expect(code).not.toMatch(/finalScore\s*=\s*_nonVerifie/);
      expect(code).not.toMatch(/score=\{_nonVerifie/);
    });
  }
});

// ═══ §2 · LA TRACE CLUSTER — CAS A, AUCUN CHANGEMENT DE CODE ════════════════
//
// MESURÉ sur le SERVI, pas inféré :
//   GET https://app.interligens.com/api/scan/cluster?address=<BOTIFY>&chain=sol
//   → deployerKnown=true · kolHandle="bkokoski" · relatedTokens=2 · redTokens=0
//     clusterRisk="HIGH" · fallback=false
//     signal="Deployer linked to @bkokoski — 0 prior rugs detected"
//
// `HIGH` a DEUX causes suffisantes INDÉPENDANTES : `deployerKnown` OU
// `redTokens >= 3`. Ici c'est la PREMIÈRE — et « 0 prior rugs » est
// INDÉPENDAMMENT VRAI. C'est la définition du CAS A.
//
// La phrase NOMME SA PROPRE CAUSE, EN PREMIER : « Deployer linked to
// @bkokoski » EST la raison du HIGH ; le décompte suit comme un fait mesuré
// distinct. La présentation est donc DÉJÀ sémantiquement claire.
//
// ⇒ AUCUN CHANGEMENT DE CODE. AUCUNE LEASE SUR `ClusterRiskBadge.tsx`.
//    AUCUNE MODIFICATION DE LA MÉTHODOLOGIE CLUSTER.
//
// Ces témoins TIENNENT la trace : ils ne changent rien, ils empêchent que la
// détermination se perde.

describe("CC-OFFLINE-294 · §2 — la trace cluster est TENUE (lecture seule)", () => {
  const route = lire("src/app/api/scan/cluster/route.ts");
  const badge = lire("src/components/ClusterRiskBadge.tsx");

  it("A · HIGH a DEUX causes suffisantes indépendantes, et MEDIUM deux autres", () => {
    expect(route).toContain('if (deployerKnown || redTokens >= 3) {');
    expect(route).toContain('} else if (relatedTokens >= 5 || redTokens >= 1) {');
    expect(route).toContain("const deployerKnown = !!badEntry || !!kolHandle;");
  });

  it("B · le nombre de « prior rugs » est `redTokens`, et RIEN D'AUTRE", () => {
    expect(route).toContain("${redTokens} prior rug${redTokens !== 1 ? \"s\" : \"\"} detected");
    expect(route).toContain("deployer linked to ${redTokens} prior rug");
    // `relatedTokens` n'apparaît JAMAIS dans une phrase « prior rugs ».
    expect(route).not.toMatch(/\$\{relatedTokens\} prior rug/);
  });

  it("C · l'en-tête HIGH nomme sa cause EN PREMIER quand un handle existe", () => {
    // C'est le cas BOTIFY mesuré. La cause (`linked to @handle`) précède le
    // décompte : le lecteur ne peut pas prendre « 0 » pour la raison du HIGH.
    expect(route).toContain("Deployer linked to @${kolHandle} — ${redTokens} prior rug");
  });

  it("D · le badge PROJETTE — il ne calcule ni seuil ni décompte", () => {
    expect(badge).toContain("const risk = result.clusterRisk");
    expect(badge).toContain("const signalText = isFr ? result.signalFr : result.signal");
    for (const m of ["redTokens >=", "relatedTokens >=", "fetch(", "isKnownBad", "prisma"]) {
      expect(badge, m).not.toContain(m);
    }
  });

  it("⛔ CAS A — la méthodologie cluster est INTACTE", () => {
    // Aucun seuil déplacé, aucun libellé réécrit, aucune dimension ajoutée.
    expect(route).toContain('clusterRisk = "HIGH";');
    expect(route).toContain('clusterRisk = "MEDIUM";');
    expect(route).toContain('let clusterRisk: ClusterRiskLevel = "LOW";');
    // Et le badge se tait toujours sur ce qui n'est pas une gravité.
    expect(badge).toContain("if (risk === 'UNKNOWN' || risk === 'LOW') return null");
  });
});

// ═══ CE QUE LA BANNIÈRE N'A PAS APPRIS À FAIRE ══════════════════════════════

describe("CC-OFFLINE-294 · la bannière PROJETTE toujours, elle ne dérive rien", () => {
  const code = sansCommentaires(lire("src/components/scan/RetailVerdictBanner.tsx"));

  it("aucune sonde, aucune autorité locale n'a été introduite", () => {
    for (const m of ["fetch(", "loadCaseByMint", "computeScore", "publishStatus", "useEffect"]) {
      expect(code, m).not.toContain(m);
    }
  });

  it("la condition est la MÊME que celle déjà ratifiée — aucune seconde règle", () => {
    expect(code).toContain("const couvertureInsuffisante = coverageSufficient === false");
    expect(code).toContain("const nonVerifie = couvertureInsuffisante && tier === 'GREEN'");
    expect(code).toContain("{!nonVerifie && (");
    // ⛔ Pas de seuil, pas de nombre écrit en dur dans la garde.
    expect(code).not.toMatch(/score\s*===\s*20/);
    expect(code).not.toMatch(/score\s*<\s*\d+\s*&&/);
  });
});
