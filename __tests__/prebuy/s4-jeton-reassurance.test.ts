// ─── BUILD 12 · S4 — LE JETON EST UNE RÉASSURANCE, PAS UN NIVEAU ───────────
//
// ██  Une règle qui interdit une PHRASE rassurante vaut pour le JETON.     ██
//
// ─── Le trou, et deux chemins y ont mené indépendamment ───────────────────
//
// En S3 j'ai fermé la prose sur `/api/v1/score` et laissé ce jeton ouvert.
// Mesuré : `toPartnerVerdict(p)` rendait `"SAFE"` depuis `p.level` seul, et
// AUCUN des quatre sites d'appel ne recevait `intelligenceCoverage` —
// score-lite:219, batch-score:153, transaction-check:156 et :203.
//
// T2 l'a trouvé par un autre chemin : son critère C6 porte sur
// `reassurance: string | null`, et S4/2 ne vérifie que le DOMAINE de `"SAFE"`,
// jamais SA CONDITION D'ÉMISSION. Un mutant qui émet SAFE sur couverture
// incomplète y survivait. Deux chemins, même trou — c'est ce qui le rend sûr.
//
// `verdict: "SAFE"` dit exactement ce que la phrase disait, sous une forme que
// le partenaire consomme PROGRAMMATIQUEMENT. Donc plus fort, pas moins.
//
// ─── Ce qui change, et ce qui ne change pas ───────────────────────────────
//
//   verdict          SAFE → WARNING quand la couverture ne conclut pas
//   recommendation   INCHANGÉE — ALLOW reste ALLOW
//   domaine          trois valeurs, les mêmes
//
// L'incomplétude de couverture interdit les affirmations non étayées ; elle ne
// convertit PAS un risque jeton en risque. C'est la forme exacte de S3, où le
// NIVEAU restait ALLOW et où seule la PHRASE cessait d'affirmer.
//
// ─── LA SUR-CORRECTION, troisième piège de la journée ─────────────────────
//
// Une couverture COMPLÈTE garde son `SAFE`. Retirer le jeton trop largement
// livrerait un `WARNING` permanent à des partenaires qui le consomment par
// contrat — et l'alerte redeviendrait le fond.

import { describe, it, expect } from "vitest";
import {
  toPartnerVerdict,
  toPartnerRecommendation,
  buildPartnerReason,
  projectPreBuy,
  type PartnerVerdict,
} from "@/lib/prebuy/projection";
import type { DecisionCanonique } from "@/lib/prebuy/canonicalDecision";

const DECISION_PROPRE: DecisionCanonique = {
  verdict: "NO_CRITICAL_SIGNAL",
  verdictSource: "REFLEX",
  expectedContractSatisfied: true,
  degraded: false,
  coverage: { expected: 4, expectedMeasured: 4, missing: [] },
  identityResolved: true,
};

const ALLOW = projectPreBuy(DECISION_PROPRE);
// MESURÉ dans la table : c'est `STOP` qui produit BLOCK, pas un
// « CRITICAL_SIGNAL » que la table ne connaît pas — celui-là retombe sur le
// `default`, donc WARN. Mon premier fixture était faux, et le contrôle de
// satisfiabilité l'a attrapé avant que la batterie ne prouve autre chose
// qu'annoncé.
const BLOCK = projectPreBuy({ ...DECISION_PROPRE, verdict: "STOP" });
const WARN = projectPreBuy({ ...DECISION_PROPRE, identityResolved: false });

const COMPLETE = { negativeConclusive: true } as const;
const INCOMPLETE = { negativeConclusive: false } as const;

// ═══ S4/A — LE JETON ═════════════════════════════════════════════════════

describe("S4/A — `SAFE` obéit à la règle de la prose", () => {
  it("la batterie est satisfiable — la projection propre est bien ALLOW", () => {
    // Sans ce contrôle, un test vert ne prouverait rien : si `ALLOW` cessait
    // d'être ALLOW, tout ce qui suit passerait pour la mauvaise raison.
    expect(ALLOW.level).toBe("ALLOW");
    expect(BLOCK.level).toBe("BLOCK");
    expect(WARN.level).toBe("WARN");
  });

  it("MUTANT — couverture INCOMPLÈTE : le jeton n'affirme plus", () => {
    expect(toPartnerVerdict(ALLOW, INCOMPLETE)).toBe("WARNING");
    expect(toPartnerVerdict(ALLOW, INCOMPLETE)).not.toBe("SAFE");
  });

  it("██ SUR-CORRECTION — couverture COMPLÈTE : le jeton revient", () => {
    // Le troisième piège de la journée. Un `WARNING` permanent livré par
    // contrat à des partenaires est le même défaut sous un autre signe.
    expect(toPartnerVerdict(ALLOW, COMPLETE)).toBe("SAFE");
  });

  it("SUR-CORRECTION — sans information de couverture, le jeton ne dégrade PAS", () => {
    // Un appelant qui n'en fournit pas n'invente pas une mauvaise couverture.
    // Le défaut inverse rendrait chaque appel non migré dégradé en permanence.
    expect(toPartnerVerdict(ALLOW)).toBe("SAFE");
    expect(toPartnerVerdict(ALLOW, undefined)).toBe("SAFE");
  });

  it("MUTANT — la couverture ne peut qu'EMPÊCHER une réassurance, jamais en produire", () => {
    // Le sens unique. Une couverture complète ne doit pas racheter un BLOCK ni
    // un WARN : elle n'entre en jeu que sur ALLOW.
    expect(toPartnerVerdict(BLOCK, COMPLETE)).toBe("AVOID");
    expect(toPartnerVerdict(WARN, COMPLETE)).toBe("WARNING");
    expect(toPartnerVerdict(BLOCK, INCOMPLETE)).toBe("AVOID");
    expect(toPartnerVerdict(WARN, INCOMPLETE)).toBe("WARNING");
  });

  it("MUTANT — le DOMAINE ne bouge pas : trois valeurs, jamais une quatrième", () => {
    // Ajouter un jeton « indéterminé » serait plus expressif et casserait
    // chaque partenaire qui teste `=== "SAFE"`. La rétrocompatibilité porte
    // sur la forme et le domaine, pas sur la condition d'émission.
    const domaine: PartnerVerdict[] = ["SAFE", "WARNING", "AVOID"];
    for (const p of [ALLOW, WARN, BLOCK]) {
      for (const c of [COMPLETE, INCOMPLETE, undefined]) {
        expect(domaine).toContain(toPartnerVerdict(p, c));
      }
    }
  });
});

// ═══ S4/B — L'ACTION NE BOUGE PAS ════════════════════════════════════════

describe("S4/B — ALLOW reste ALLOW", () => {
  it("██ MUTANT — la recommandation est INDIFFÉRENTE à la couverture", () => {
    // L'incomplétude interdit une affirmation ; elle ne convertit pas un
    // risque jeton en risque. `toPartnerRecommendation` ne reçoit même pas la
    // couverture — et c'est la garantie la plus forte qu'elle ne peut pas la
    // consulter.
    expect(toPartnerRecommendation(ALLOW)).toBe("ALLOW");
    expect(toPartnerRecommendation.length).toBe(1);
  });

  it("verdict et recommandation DIVERGENT désormais, et c'est délibéré", () => {
    // ⚠ La divergence fermée en phase 2 venait de DEUX TABLES DE SEUILS qui
    // répondaient à la même question avec des bornes différentes (35 / 40).
    // Celle-ci vient d'une DIMENSION supplémentaire appliquée à la seule
    // réassurance. L'action dit quoi faire ; le jeton dit ce qu'on a le droit
    // d'affirmer. Ce ne sont pas la même question.
    expect(toPartnerVerdict(ALLOW, INCOMPLETE)).toBe("WARNING");
    expect(toPartnerRecommendation(ALLOW)).toBe("ALLOW");
    // Et sur couverture complète, ils se rejoignent.
    expect(toPartnerVerdict(ALLOW, COMPLETE)).toBe("SAFE");
  });
});

// ═══ S4/C — LA PROSE PARTENAIRE, MÊME RÈGLE ══════════════════════════════

describe("S4/C — la phrase partenaire ne peut pas rester en arrière", () => {
  const R = "no critical risk signals detected";

  it("MUTANT — couverture incomplète : la clause rassurante disparaît", () => {
    const phrase = buildPartnerReason(ALLOW, 0, 0, INCOMPLETE);
    expect(phrase).not.toContain(R);
    expect(phrase).toContain("part of the declared coverage was not verified");
  });

  it("SUR-CORRECTION — couverture complète : la phrase revient au caractère près", () => {
    expect(buildPartnerReason(ALLOW, 0, 0, COMPLETE)).toBe(`Score 0/100 — ${R}`);
    expect(buildPartnerReason(ALLOW, 0, 0)).toBe(`Score 0/100 — ${R}`);
  });

  it("le préfixe `Score N/100 — ` est conservé DANS LES DEUX CAS", () => {
    // Des partenaires le lisent. Le perdre en dégradant casserait la forme, ce
    // que la rétrocompatibilité interdit — c'est la CONDITION qui change.
    expect(buildPartnerReason(ALLOW, 42, 0, INCOMPLETE).startsWith("Score 42/100 — ")).toBe(true);
    expect(buildPartnerReason(ALLOW, 42, 0, COMPLETE).startsWith("Score 42/100 — ")).toBe(true);
  });

  it("MUTANT — BLOCK et WARN ne bougent pas d'un caractère", () => {
    for (const c of [COMPLETE, INCOMPLETE, undefined]) {
      expect(buildPartnerReason(BLOCK, 90, 2, c)).toBe("Score 90/100 — 2 high-risk signals detected");
      expect(buildPartnerReason(WARN, 50, 1, c)).toBe(
        "Score 50/100 — the expected checks did not all complete — unverified, not safe",
      );
    }
  });

  it("la phrase dégradée ne NOMME aucune source manquante", () => {
    // Elle dit qu'une partie de la couverture déclarée n'a pas été vérifiée.
    // Nommer laquelle serait servir un détail d'exploitation à un partenaire,
    // et rapprocherait la prose de l'oracle fermé en S3.2.
    const phrase = buildPartnerReason(ALLOW, 0, 0, INCOMPLETE);
    for (const s of ["ofac", "amf", "fca", "scamsniffer", "forta", "goplus"]) {
      expect(phrase.toLowerCase(), `la phrase nomme ${s}`).not.toContain(s);
    }
  });
});
