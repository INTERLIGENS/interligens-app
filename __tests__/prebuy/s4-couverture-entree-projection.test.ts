// ─── S4 · P4/P5 — LA COUVERTURE COMME ENTRÉE DE PROJECTION ────────────────
//
// ██  GARDE DÉFENSIVE. Elle ne protège PAS le chemin canonique.            ██
//
// ─── Ce que cette garde couvre, et ce qu'elle NE couvre PAS ───────────────
//
// Je l'ai d'abord annoncée comme « la faute sous un troisième visage » : un
// consommateur qui lirait `verdict + degraded` en ignorant `coverage`. C'était
// SURÉVALUÉ, et je le rétracte ici plutôt que dans un rapport que personne ne
// relira.
//
// Dans le pipeline réel, `coverage` est consommée EN AMONT par
// `canonicalPreBuyDecision`, qui en dérive `degraded` et
// `expectedContractSatisfied` — `estDegrade` rend `true` dès que
// `expectedMeasured < expected`. Une `DecisionCanonique` portant « même
// verdict, même degraded, couverture différente » n'est donc PAS
// CONSTRUCTIBLE par ce pipeline.
//
//   ✗ elle NE protège PAS `/api/v1/score`, ni les routes partenaires, ni
//     aucun chemin passant par `canonicalPreBuyDecision`
//   ✓ elle protège la surface d'APPEL DIRECT : `projectPreBuy` est exporté,
//     et rien n'empêche un appelant futur de lui fabriquer une décision dont
//     les champs sont mutuellement incohérents
//
// ─── TROISIÈME RECADRAGE, et il ferme la question ─────────────────────────
//
// Écrire ce fichier a produit une mesure que ni l'affirmation ni la
// rétractation ne portaient : `projectPreBuy` NE LIT PAS les compteurs de
// couverture — à `degraded: false`, une couverture 1/4 projette `ALLOW` comme
// une 4/4. Ma trouvaille était JUSTE sur la fonction ; ma rétractation portait
// sur l'ACCESSIBILITÉ. Les deux tenaient, et je les avais confondues.
//
// Conséquence pratique : la garantie portante n'est pas dans la projection,
// elle est dans `estDegrade`. C'est elle qui est gardée ci-dessous.
//
// Un lecteur qui croirait cette garde applicable au chemin réel se croirait
// protégé sans l'être. C'est un faux vert d'un genre nouveau — au niveau de la
// DESCRIPTION, pas de l'assertion — et c'est la raison d'être de ce bloc de
// commentaire.
//
// ─── Pourquoi elle est CONSERVÉE malgré ça ────────────────────────────────
//
// `projectPreBuy` est une fonction publique du module. La cohérence interne de
// son entrée n'est garantie que par la discipline de ses appelants, et cette
// discipline n'est vérifiée nulle part. La garde coûte deux critères.

import { describe, it, expect } from "vitest";
import { projectPreBuy } from "@/lib/prebuy/projection";
import { canonicalPreBuyDecision, estDegrade } from "@/lib/prebuy/canonicalDecision";
import type { DecisionCanonique } from "@/lib/prebuy/canonicalDecision";

const PANNE = [{ engine: "tigerscore", reason: "FAILURE" as const }];

const dec = (o: Partial<DecisionCanonique> = {}): DecisionCanonique => ({
  verdict: "NO_CRITICAL_SIGNAL",
  verdictSource: "LEGACY_SCORE",
  expectedContractSatisfied: true,
  degraded: false,
  coverage: { expected: 4, expectedMeasured: 4, missing: [] },
  identityResolved: true,
  ...o,
} as DecisionCanonique);

describe("S4/P4-P5 — la couverture est une entrée, sur la surface d'appel direct", () => {
  it("CONSTAT — `projectPreBuy` ne lit PAS les compteurs de couverture", () => {
    // Mesuré, et c'est le fait qui recadre tout : à `degraded: false` et
    // `expectedContractSatisfied: true`, une couverture 1/4 projette ALLOW
    // exactement comme une couverture 4/4. La fonction lit les DÉRIVÉS, pas
    // les compteurs.
    //
    // Ma trouvaille initiale était donc JUSTE sur la fonction, et ma
    // rétractation portait sur l'ACCESSIBILITÉ. Les deux tenaient, et je les
    // avais confondues.
    const complet = projectPreBuy(dec());
    const partiel = projectPreBuy(dec({
      coverage: { expected: 4, expectedMeasured: 1, missing: PANNE },
    }));
    expect(partiel.level).toBe(complet.level);
    expect(complet.level).toBe("ALLOW");
  });

  it("P4 — LA GARANTIE PORTANTE est en AMONT : couverture incomplète ⇒ dégradé", () => {
    // C'est ICI que la sûreté se joue, et c'est donc ici qu'il faut la garder.
    // `projectPreBuy` peut ignorer les compteurs sans danger TANT QUE le
    // pipeline garantit qu'une couverture incomplète force `degraded`.
    // Retirer cette dérivation en amont rendrait la projection permissive
    // sans qu'aucun test de projection ne bouge.
    for (const [expected, mesure] of [[4, 1], [4, 3], [2, 0], [1, 0]] as const) {
      expect(
        estDegrade({ expected, expectedMeasured: mesure, missing: PANNE }),
        `couverture ${mesure}/${expected} non dégradée`,
      ).toBe(true);
    }
    // Et la borne inverse : une couverture complète ne dégrade PAS.
    expect(estDegrade({ expected: 4, expectedMeasured: 4, missing: [] })).toBe(false);
  });

  it("P5 — SUR-CORRECTION : à couverture ÉGALE, la projection est ÉGALE", () => {
    // Sans cette borne, la couverture devient une source de bruit et non un
    // critère : deux appels identiques doivent rendre le même objet.
    const a = projectPreBuy(dec());
    const b = projectPreBuy(dec());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("LA RÉTRACTATION, VÉRIFIÉE — le pipeline canonique ne peut pas produire l'entrée de P4", () => {
    // C'est la preuve de ma propre rétractation, pas une affirmation. Une
    // couverture incomplète force `degraded: true` en amont : l'état que P4
    // teste est inatteignable par `canonicalPreBuyDecision`.
    const mesure = { expected: 4, expectedMeasured: 1, missing: PANNE };
    expect(estDegrade(mesure)).toBe(true);

    const viaPipeline = canonicalPreBuyDecision({
      score: 10, measurement: mesure,
      identity: { resolved: true, authorities: ["knownBad"] },
    } as never);
    expect(viaPipeline.degraded, "le pipeline produirait une décision non dégradée").toBe(true);
  });
});
