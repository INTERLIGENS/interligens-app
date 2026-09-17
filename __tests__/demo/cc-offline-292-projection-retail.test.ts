// ─── CC-OFFLINE-292 · LOT DE CLÔTURE — LA PROJECTION RETAIL ────────────────
//
// ██  LE RENDERER PROJETTE UNE AUTORITÉ, IL NE LA FABRIQUE PAS.            ██
// ██  UNE FORME AFFIRMÉE N'EST PAS UNE DONNÉE PRÉSENTE.                    ██
//
// CE QUI AVAIT ÉTÉ MESURÉ SUR LE SERVI : la bannière retail portait déjà la
// projection correcte (CC-OFFLINE-284), et pourtant VINE et BOTIFY rendaient
// un verdict rassurant. La cause liante n'était pas la bannière : c'était le
// TRANSPORT. `normalizeScanData` ne portait pas `risk`, et le montage lisait
// la couverture à travers `(result as { risk?… })` — un cast qui AFFIRMAIT une
// forme que `NormalizedScan` n'avait pas. TypeScript s'est tu. La prop valait
// `undefined`. 8 048 témoins sont restés verts sur un mécanisme INERTE.
//
// Ce lot ferme les deux moitiés :
//   · le TRANSPORT — le champ est DÉCLARÉ, RECOPIÉ, et plus aucun cast ne
//     dispense le compilateur de le vérifier ;
//   · la SÉLECTION — la copie permissive n'est plus choisie quand sa
//     précondition sémantique n'est pas satisfaite.
//
// ⛔ CE LOT NE RÉÉCRIT AUCUN PALIER, AUCUN BARÈME, AUCUN SCORE.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectVerdictCopy, getVerdictCopy } from "@/lib/copy/verdictCopy";
import { getTierOrUnknownColor, computeFinalVerdict } from "@/lib/risk/tier";
import { computeScore } from "@/lib/scoring";
import { canonicalPreBuyDecision } from "@/lib/prebuy/canonicalDecision";
import { projectPreBuy, toPartnerVerdict } from "@/lib/prebuy/projection";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const PAGES = ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const;

/** Les phrases que le fondateur a vues sur le servi, et qui ne doivent pas
 *  être SÉLECTIONNÉES sans couverture. Elles ne sont ni réécrites ni
 *  supprimées : elles restent exactes pour l'état qu'elles décrivent. */
const PHRASES_PERMISSIVES = [
  "No critical alerts detected",
  "No major risk detected",
  "No critical signals detected",
  "SAFE",
  "Proceed",
  "clean",
  "Pas d'alerte critique",
];

// ═══ LE COMPORTEMENT · LA SÉLECTION SUIT L'AUTORITÉ ═════════════════════════

describe("CC-OFFLINE-292 · `selectVerdictCopy` — la précondition de la copie permissive", () => {
  it("GREEN + couverture DÉCLARÉE INSUFFISANTE ⇒ la copie permissive n'est plus choisie", () => {
    for (const lang of ["en", "fr"] as const) {
      const { presentation, copy } = selectVerdictCopy("GREEN", lang, false);
      expect(presentation).toBe("UNVERIFIED");
      const tout = [copy.label, copy.subtitle, ...copy.actions].join(" ");
      // ⚠️ Frontières de MOT, délibérément. « This is not a safety assessment »
      // est une NÉGATION : y lire le mot permissif « safe » par sous-chaîne
      // ferait rougir la phrase la plus honnête du lot. Le mot interdit est le
      // mot entier, pas une syllabe partagée.
      for (const m of PHRASES_PERMISSIVES) {
        const mot = new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        expect(tout, `${lang} · ${m}`).not.toMatch(mot);
      }
    }
  });

  it("GREEN + couverture ÉTABLIE ⇒ la copie historique est INTACTE", () => {
    // ⛔ Rien n'est réécrit globalement. La phrase reste vraie là où elle
    //    l'était, et elle y est toujours servie.
    for (const lang of ["en", "fr"] as const) {
      const { presentation, copy } = selectVerdictCopy("GREEN", lang, true);
      expect(presentation).toBe("GREEN");
      expect(copy).toEqual(getVerdictCopy("GREEN", lang));
    }
  });

  it("GREEN + AUCUNE autorité de couverture ⇒ comportement historique inchangé", () => {
    // `undefined` n'est pas `false`. NOT_ESTABLISHED ≠ ABSENT : une chaîne qui
    // ne produit pas de couverture (les chaînes EVM) ne bascule pas.
    for (const lang of ["en", "fr"] as const) {
      expect(selectVerdictCopy("GREEN", lang, undefined).presentation).toBe("GREEN");
      expect(selectVerdictCopy("GREEN", lang).copy).toEqual(getVerdictCopy("GREEN", lang));
    }
  });

  it("⛔ M11 — UNE GRAVITÉ N'EST JAMAIS RELÂCHÉE PAR UNE COUVERTURE MANQUANTE", () => {
    // LE MUTANT DÉCISIF. Élargir la bascule au-delà de GREEN inverserait la
    // doctrine : la couverture RESTREINT une permission, elle ne RÉDUIT PAS
    // une gravité établie. ORANGE et RED traversent, identiques au mot près.
    for (const lang of ["en", "fr"] as const) {
      for (const gravite of ["ORANGE", "RED"] as const) {
        const { presentation, copy } = selectVerdictCopy(gravite, lang, false);
        expect(presentation, `${gravite}/${lang}`).toBe(gravite);
        expect(copy).toEqual(getVerdictCopy(gravite, lang));
      }
    }
    // Et la source ne connaît qu'UNE porte, sur GREEN seul.
    const src = sansCommentaires(lire("src/lib/copy/verdictCopy.ts"));
    expect(src).toContain('coverageSufficient === false && tier === "GREEN"');
    expect(src).not.toMatch(/tier\s*!==\s*"GREEN"/);
  });

  it("l'état projeté ne porte AUCUNE accusation — une ignorance n'est pas un soupçon", () => {
    for (const lang of ["en", "fr"] as const) {
      const { copy } = selectVerdictCopy("GREEN", lang, false);
      const tout = [copy.label, copy.subtitle, ...copy.actions].join(" ").toLowerCase();
      for (const m of ["scam", "fraud", "dangerous", "arnaque", "danger", "rug", "avoid", "éviter"]) {
        expect(tout, `${lang} · ${m}`).not.toContain(m);
      }
      // Elle DIT ce qu'elle est, et ce qu'elle n'est pas.
      expect(copy.subtitle).toMatch(/not a safety assessment|pas une évaluation de sécurité/);
    }
  });

  it("UNKNOWN est GRIS — l'état existant est PROJETÉ, aucune classification neuve", () => {
    expect(getTierOrUnknownColor("UNKNOWN")).toBe("#6b7280");
    expect(getTierOrUnknownColor("GREEN")).not.toBe("#6b7280");
  });
});

// ═══ LE TRANSPORT · LA CAUSE LIANTE ═════════════════════════════════════════

describe("CC-OFFLINE-292 · M10 — LE CHAMP EXISTE, ET PLUS AUCUN CAST NE LE SIMULE", () => {
  for (const p of PAGES) {
    const brut = lire(p);
    const code = sansCommentaires(brut);

    it(`${p} — ⛔ LE MUTANT : aucun cast n'affirme une forme absente`, () => {
      // C'EST LE DÉFAUT EXACT QUI A ÉTÉ LIVRÉ. Réintroduire le cast rend ce
      // témoin ROUGE — et c'est tout l'objet de M10 : le mécanisme de garde
      // n'est plus un témoin de texte, c'est le COMPILATEUR. Sans cast, lire
      // `result.risk` sur un `NormalizedScan` qui ne le déclare pas ne
      // compile pas. Le témoin garde la porte ouverte pour `tsc`.
      expect(code).not.toMatch(/as\s*\{\s*risk\?/);
      expect(code).not.toContain("{ coverage?: { sufficient?: boolean } }");
    });

    it(`${p} — le champ est DÉCLARÉ sur le type normalisé`, () => {
      expect(code).toContain("risk?: { coverage?: ScanCoverage };");
      expect(code).toContain("interface ScanCoverage {");
      expect(code).toContain("sufficient?: boolean;");
    });

    it(`${p} — le normaliseur RECOPIE l'autorité, il ne la dérive pas`, () => {
      expect(code).toContain(
        "risk: data?.risk?.coverage ? { coverage: data.risk.coverage as ScanCoverage } : undefined,",
      );
      // ⛔ Aucun défaut permissif : `sufficient` absent reste absent.
      expect(code).not.toMatch(/sufficient\s*(\?\?|\|\|)\s*true/);
      expect(code).not.toMatch(/coverage\s*(\?\?|\|\|)\s*\{/);
    });

    it(`${p} — la bannière reçoit la couverture SANS cast`, () => {
      expect(code).toContain("coverageSufficient={result.risk?.coverage?.sufficient}");
    });
  }
});

// ═══ LA PROJECTION DE PAGE · CE QUE LA COLONNE GAUCHE REND ══════════════════

describe("CC-OFFLINE-292 · la page SÉLECTIONNE, elle ne décide pas", () => {
  for (const p of PAGES) {
    const code = sansCommentaires(lire(p));

    it(`${p} — la copie vient du sélecteur, plus du palier seul`, () => {
      expect(code).toContain("const _sel = selectVerdictCopy(_fv.tier,");
      expect(code).toContain("result.risk?.coverage?.sufficient)");
      expect(code).toContain('const _nonVerifie = _sel.presentation === "UNVERIFIED"');
      // L'appel inconditionnel a disparu du chemin de rendu.
      expect(code).not.toContain("getVerdictCopy(_fv.tier");
    });

    it(`${p} — ⛔ LE PALIER N'EST PAS RÉÉCRIT`, () => {
      // `finalTier` reste le produit de la décision canonique. Ce qui bascule
      // est `_tierProjete`, et il ne sert QU'À la couleur et au libellé.
      expect(code).toContain("const finalTier = _fv.tier;");
      expect(code).toMatch(/const _tierProjete: TierOrUnknown = _nonVerifie \? "UNKNOWN" : finalTier;/);
      // La bannière reçoit le palier NON PROJETÉ : elle fait sa propre
      // projection depuis `coverageSufficient` (CC-OFFLINE-284).
      expect(code).toContain("tier={finalTier}");
      expect(code).not.toContain("tier={_tierProjete}");
    });

    it(`${p} — la couleur et le libellé SUIVENT l'état projeté`, () => {
      expect(code).toContain("const getTierColorFinal = getTierOrUnknownColor;");
      expect(code).toContain("getTierColorFinal(_tierProjete)");
      // Plus aucun site de la colonne gauche ne colore depuis le palier nu.
      expect(code).not.toContain("getTierColorFinal(finalTier)");
    });

    it(`${p} — ⛔ AUCUNE DÉCISION CANONIQUE N'EST DUPLIQUÉE DANS REACT`, () => {
      for (const interdit of [
        "canonicalPreBuyDecision",
        "projectPreBuy",
        "INSUFFICIENT_COVERAGE",
        "computeScore(",
        "expectedMeasured",
      ]) {
        expect(code, interdit).not.toContain(interdit);
      }
    });
  }
});

// ═══ DÉCISION ② · LE REPLI `computeScore([])` EST-IL ENCORE ATTEIGNABLE ? ═══
//
// LA QUESTION DE L'ARCHITECTE, telle qu'elle a été posée : après la réparation
// de la projection, `computeScore([])` peut-il encore causer une ASSERTION
// POSITIVE VISIBLE EN RC, ou une PERMISSION CONSOMMABLE PAR MACHINE ?
//
// RÉPONSE MESURÉE : NON. Les témoins ci-dessous sont la mesure, pas l'avis.
// Le repli n'est pas supprimé — le corriger appartient à `lib/scoring` et
// resterait hors périmètre. Ce qui est fermé est sa CONSÉQUENCE.

describe("CC-OFFLINE-292 · ② — le repli 20/GREEN ne produit plus ni permission ni assertion", () => {
  const identiteResolue = { resolved: true, authorities: ["helius"] } as const;
  // Le contrat SOL tel qu'il est DÉCLARÉ dans `api/v1/score` : trois capacités
  // NOMMÉES, dont `off_chain_claims` — comptée mesurée UNIQUEMENT si une
  // assertion gouvernée a réellement été consommée.
  const CONTRAT_SOL = 3;

  it("le repli existe toujours, et il rend toujours 20 / GREEN", () => {
    const r = computeScore([]);
    expect(r.score).toBe(20);
    expect(r.tier).toBe("GREEN");
    expect(r.flags).toContain("NO_CLAIMS_FALLBACK");
  });

  it("⛔ SURFACE MACHINE — zéro assertion consommée ⇒ WARN, jamais ALLOW", () => {
    // `market` et `scam_lineage` ont abouti ; `off_chain_claims` non — c'est
    // EXACTEMENT le cas où `computeScore([])` a produit le 20.
    const d = canonicalPreBuyDecision({
      score: computeScore([]).score,
      measurement: {
        expected: CONTRAT_SOL,
        expectedMeasured: CONTRAT_SOL - 1,
        missing: [{ engine: "off_chain_claims", reason: "NOT_MEASURED" }],
      },
      identity: identiteResolue as never,
    });
    expect(d.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(d.expectedContractSatisfied).toBe(false);
    const p = projectPreBuy(d);
    expect(p.level).toBe("WARN");
    expect(p.reassurance).toBeNull();
    expect(toPartnerVerdict(p)).toBe("WARNING");
  });

  it("la frontière est bien la COUVERTURE — contrat satisfait ⇒ ALLOW reste possible", () => {
    // ⛔ Pas un WARNING permanent : la porte n'est pas condamnée, elle est
    //    conditionnée. C'est ce qui distingue une permission gouvernée d'une
    //    suppression de fonctionnalité.
    const d = canonicalPreBuyDecision({
      score: computeScore([]).score,
      measurement: { expected: CONTRAT_SOL, expectedMeasured: CONTRAT_SOL, missing: [] },
      identity: identiteResolue as never,
    });
    expect(projectPreBuy(d).level).toBe("ALLOW");
  });

  it("⛔ SURFACE RETAIL — le même repli ne sélectionne plus la copie permissive", () => {
    // `sufficient` est produit par `api/scan/solana` comme
    // `rawClaims.length > 0` : le repli `computeScore([])` et
    // `sufficient === false` sont le MÊME événement, pas deux coïncidences.
    const route = lire("src/app/api/scan/solana/route.ts");
    expect(route).toContain("const scoring = computeScore(rawClaims);");
    expect(route).toContain("const offChainClaimsMesuree = rawClaims.length > 0");
    expect(route).toContain("sufficient: offChainClaimsMesuree,");
    // Donc, sur cette surface, le repli arrive TOUJOURS avec `sufficient=false`.
    expect(selectVerdictCopy("GREEN", "en", false).presentation).toBe("UNVERIFIED");
  });

  it("les deux autres consommateurs du repli sont GARDÉS, et le restent", () => {
    // `api/pdf/casefile` et `api/report/v2` appellent aussi `computeScore` sur
    // des claims possiblement vides. Aucun n'est atteignable en anonyme : ils
    // ne sont donc pas des surfaces RC. Le témoin garde cette porte fermée.
    const pdf = lire("src/app/api/pdf/casefile/route.ts");
    expect(pdf).toContain("const _auth = await checkAuth(request);");
    expect(pdf).toContain("if (!_auth.authorized) return _auth.response!;");
    // Et, en plus de l'authentification, il REFUSE sans dossier gouverné.
    expect(pdf).toContain("if (!dossierGouverne) return refuserArtefact();");
    const v2 = lire("src/app/api/report/v2/route.ts");
    expect(v2).toMatch(/checkAuth|requireAuth/);
  });
});

// ═══ LA MESURE BORNÉE DU BADGE CLUSTER (CHEMIN GELÉ · LECTURE SEULE) ════════
//
// `src/components/ClusterRiskBadge.tsx` est GELÉ (`^src/components/`). La
// question posée était bornée : sa cohérence avec la projection retail exige-
// t-elle une lease ?
//
// MESURÉ : NON. Le badge ne rend RIEN sur `UNKNOWN`, sur `LOW` et sur
// `fallback` — il ne sait produire qu'une GRAVITÉ (MEDIUM / HIGH). Il ne porte
// aucune assertion rassurante, donc il n'y a rien à conditionner à la
// couverture. Le silence sous ignorance est déjà la bonne conduite : ni
// « aucun risque cluster », ni un risque inventé.
//
// ⛔ AUCUNE LEASE DEMANDÉE, AUCUNE REDÉFINITION DE « CLUSTER RISK ». Ce bloc
//    est une MESURE. Il ne modifie pas le fichier gelé — il le tient.

describe("CC-OFFLINE-292 · badge cluster — mesure bornée, aucun changement", () => {
  const badge = lire("src/components/ClusterRiskBadge.tsx");

  it("il se TAIT sur l'ignorance, et sur l'absence de gravité", () => {
    expect(badge).toContain("if (!result) return null");
    expect(badge).toContain("if (result.fallback) return null");
    expect(badge).toContain("if (risk === 'UNKNOWN' || risk === 'LOW') return null");
  });

  it("⛔ il ne porte AUCUNE assertion rassurante — il n'y a rien à conditionner", () => {
    const code = sansCommentaires(badge);
    for (const m of ["No cluster", "Aucun cluster", "clean", "safe", "Pas de risque", "OK"]) {
      expect(code, m).not.toMatch(new RegExp(`\\b${m}\\b`, "i"));
    }
  });

  it("et une gravité cluster TRAVERSE — même sous une couverture insuffisante", () => {
    // Le badge ne consomme pas `coverageSufficient` et ne doit pas le
    // consommer : conditionner une GRAVITÉ à la couverture serait exactement
    // l'inversion que M11 interdit sur l'autre surface.
    expect(badge).not.toContain("coverageSufficient");
    expect(badge).toContain("risk === 'HIGH'");
  });
});

// ═══ CE QUI N'A PAS BOUGÉ ═══════════════════════════════════════════════════

describe("CC-OFFLINE-292 · le barème est INTACT", () => {
  it("aucun seuil, aucune escalade n'a été touchée", () => {
    const tier = lire("src/lib/risk/tier.ts");
    expect(tier).toContain('if (score >= 70) return "RED";');
    expect(tier).toContain('if (score >= 35) return "ORANGE";');
    // L'escalade de récidive reste souveraine, et la couverture est mesurée
    // APRÈS elle : une gravité escaladée ne peut pas être relâchée.
    expect(computeFinalVerdict(20, "GREEN", true, "HIGH").tier).toBe("RED");
    expect(selectVerdictCopy(computeFinalVerdict(20, "GREEN", true, "HIGH").tier, "en", false).presentation)
      .toBe("RED");
  });

  it("les trois copies historiques sont mot pour mot ce qu'elles étaient", () => {
    expect(getVerdictCopy("GREEN", "en").subtitle).toBe("No critical alerts detected. Still verify URLs.");
    expect(getVerdictCopy("ORANGE", "en").label).toBe("CAUTION");
    expect(getVerdictCopy("RED", "en").label).toBe("AVOID");
  });
});
