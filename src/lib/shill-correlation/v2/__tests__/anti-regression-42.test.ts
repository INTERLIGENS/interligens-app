// ═══ LE TEST NEGATIF DUR ═══════════════════════════════════════════════════
//
// Ce fichier existe pour une seule raison : rendre impossible le retour de la
// ligne mesuree sur feat/cc-offline-42-shill-engine-v2, features.ts :
//
//     const liftMeasurable =
//       baselineRate != null && baselineTotal >= 1 &&
//       a.baselineCounted.size + a.counted.size >= policy.minBaselineBuys;
//
// Chaque test ci-dessous ECHOUE si cette semantique revient, d'une maniere ou
// d'une autre - meme reecrite, meme renommee.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isMeasured } from "../../measurement";
import { computeFeatures } from "../features";
import { runEngine } from "../engine";
import { scoreFeatures } from "../scoring";
import { DEFAULT_ENGINE_POLICY, FORBIDDEN_POLICY_KEYS, type EnginePolicy } from "../policy";
import {
  baselineCollected,
  baselineCollectedEmpty,
  baselineNotCollected,
  baselineBuy,
  buy,
  occasion,
  record,
} from "../__fixtures__/corpus";

const P = DEFAULT_ENGINE_POLICY;

describe("anti-regression -42 : la somme inter-cotes ne franchit aucun plancher", () => {
  it("ZERO achat temoin + assez d'achats observes ne rend PAS le lift mesurable", () => {
    // Cas de base : aucun temoin du tout. -42 le refusait aussi (via
    // `baselineRate != null`) - ce test n'est donc pas discriminant, il fixe le
    // motif attendu. Les cas OU -42 se trompait sont les deux suivants, et le
    // bloc « oracle » plus bas les rejoue contre la formule d'origine.
    const records = [0, 1, 2, 3, 4, 5].map((i) =>
      record(occasion(`o${i}`, "kol_a", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-obs-${i}`)],
        baseline: baselineNotCollected(),
      }),
    );

    const [f] = computeFeatures(records, P);
    expect(f.wallet).toBe("W1");
    expect(f.observedTally.buys.value).toBe(6);
    expect(f.baselineTally.buys.value).toBe(0);
    expect(f.baselineTally.occasions).toBe(0);

    // Le verdict attendu : NON MESURE, et pour la cause la plus amont.
    expect(isMeasured(f.lift)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_NOT_COLLECTED");
  });

  it("le plancher du temoin ne voit QUE le temoin : 4 temoin + 40 observes reste sous le plancher", () => {
    // minBaselineBuys = 5. Le temoin en porte 4 : il est sous son plancher, et
    // les 40 achats observes n'y changent rien. La somme -42 (44 >= 5) passait.
    const records = Array.from({ length: 10 }, (_, i) =>
      record(occasion(`o${i}`, "kol_b", i * 120), {
        observations: Array.from({ length: 4 }, (_, j) =>
          buy(`W${j}`, "pre_tweet", -100, `sig-obs-${i}-${j}`),
        ),
        baseline:
          i < 4
            ? baselineCollected([baselineBuy("WB", -100, `sig-base-${i}`)])
            : baselineCollectedEmpty(),
      }),
    );

    const features = computeFeatures(records, P);
    expect(features.length).toBeGreaterThan(0);
    for (const f of features) {
      expect(f.baselineTally.buys.value).toBe(4); // le temoin SEUL
      expect(f.observedTally.buys.value).toBe(40); // et il ne le secourt pas
      expect(isMeasured(f.lift)).toBe(false);
      expect(f.liftUnmeasurableReason).toBe("BASELINE_BELOW_FLOOR");
    }
  });

  it("le plancher de l'observation est une AUTRE variable : le durcir ne touche pas le temoin", () => {
    // Temoin genereux (6 achats, au-dessus de minBaselineBuys), observation
    // maigre (2 achats). Avec minObservedBuys = 3, c'est l'OBSERVATION qui
    // bloque - et le motif le nomme. Aucune confusion possible avec le temoin.
    const records = Array.from({ length: 6 }, (_, i) =>
      record(occasion(`o${i}`, "kol_c", i * 120), {
        observations: i < 2 ? [buy("W1", "pre_tweet", -100, `sig-obs-${i}`)] : [],
        baseline: baselineCollected([baselineBuy("W1", -100, `sig-base-${i}`)]),
      }),
    );

    const [f] = computeFeatures(records, P);
    expect(f.baselineTally.buys.value).toBe(6);
    expect(f.observedTally.buys.value).toBe(2);
    expect(isMeasured(f.lift)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("OBSERVED_BELOW_FLOOR");

    // Et le durcissement du plancher d'observation ne deplace PAS le motif vers
    // le temoin : les deux variables sont independantes.
    const stricter: EnginePolicy = { ...P, minObservedBuys: 99 };
    const [g] = computeFeatures(records, stricter);
    expect(g.liftUnmeasurableReason).toBe("OBSERVED_BELOW_FLOOR");

    // Inversement, relacher le plancher d'observation ne rend PAS le temoin
    // suffisant s'il ne l'est pas : ici il l'est, donc le lift se mesure.
    const looser: EnginePolicy = { ...P, minObservedBuys: 1 };
    const [h] = computeFeatures(records, looser);
    expect(isMeasured(h.lift)).toBe(true);
  });

  it("le cas le plus depourvu de temoin ne ressort JAMAIS le mieux note", () => {
    // -42 : temoin nul => lift = liftCapWhenBaselineZero = 10 => liftScore MAX.
    // L'absence de temoin PAYAIT, et payait le maximum du bareme.
    //
    // ── Recalage du 2026-09-03 (SHILL-M2) ──────────────────────────────────
    // Ce test assertait aussi `classification === 'watch'`. Ce n'etait PAS la
    // protection anti--42 : c'etait le plafond `unmeasuredLiftCapsClassification`,
    // reverse depuis. Confondre les deux aurait fait tomber la vraie garde en
    // meme temps que le plafond.
    //
    // La protection anti--42, elle, est intacte et c'est ce qu'on teste ici :
    // une absence ne recoit AUCUN credit, et ne paie JAMAIS plus qu'une mesure
    // favorable. C'est le verrou anti-epsilon, independant de M2.
    const sansTemoin = Array.from({ length: 6 }, (_, i) =>
      record(occasion(`n${i}`, "kol_sans", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-n-${i}`)],
        baseline: baselineNotCollected(),
      }),
    );

    const r = runEngine(sansTemoin, P);
    const c = r.candidates.find((x) => x.wallet === "W1")!;

    // 1. Aucun credit de substitution : le coeur du defaut -42.
    expect(c.scores.liftScore).toBe(0);
    expect(c.scores.liftCounted).toBe(false);

    // 2. L'absence ne paie pas plus que la presence. On compare le MEME wallet,
    //    memes observations, avec un temoin MESURE et un lift eleve.
    const memeAvecTemoin = scoreFeatures(
      {
        ...c.features,
        baselineOccurrences: 2,
        baselineMeasuredOccasions: 6,
        baselineRate: { value: 0.25, censored: false, censoredBy: null },
        baselineTally: {
          occasions: 6,
          buys: { value: 6, censored: false, censoredBy: null },
          truncatedBy: [],
        },
        lift: { value: 4, censored: false, censoredBy: null },
        liftUnmeasurableReason: null,
      },
      P,
    );
    expect(c.scores.correlationScore).toBeLessThanOrEqual(memeAvecTemoin.correlationScore);

    // 3. Et le fait reste VISIBLE : compte par motif, jamais tu.
    expect(r.telemetry.liftUnmeasurable.BASELINE_NOT_COLLECTED).toBeGreaterThan(0);
    expect(r.telemetry.liftMeasured).toBe(0);
  });
});

describe("anti-regression -42 : zero epsilon", () => {
  it("aucune cle de substitution de lift n'existe dans la politique", () => {
    for (const k of FORBIDDEN_POLICY_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(DEFAULT_ENGINE_POLICY, k)).toBe(false);
    }
    expect(JSON.stringify(DEFAULT_ENGINE_POLICY)).not.toContain("liftCapWhenBaselineZero");
  });

  it("temoin MESURE et suffisant, wallet absent : NON MESURE, pas un lift plafonne", () => {
    // 8 occasions ; le temoin est collecte partout et porte 8 achats d'un AUTRE
    // wallet. W1 y est absent. -42 en faisait un lift de 10, le maximum.
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`z${i}`, "kol_z", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-z-${i}`)],
        baseline: baselineCollected([baselineBuy("WAUTRE", -100, `sig-zb-${i}`)]),
      }),
    );

    const [f] = computeFeatures(records, P);
    expect(f.baselineMeasuredOccasions).toBe(8);
    expect(f.baselineOccurrences).toBe(0);
    expect(isMeasured(f.lift)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_ZERO_OCCURRENCES");

    // Le fait n'est pas perdu - il est rapporte, sans devenir un nombre.
    expect(f.absentFromMeasuredBaseline).toBe(true);

    const r = runEngine(records, P);
    const c = r.candidates.find((x) => x.wallet === "W1")!;
    expect(c.scores.liftScore).toBe(0);
    expect(c.scores.liftCounted).toBe(false);
    expect(r.telemetry.absentFromMeasuredBaseline).toBe(1);
    expect(c.scores.limitations.some((l) => l.includes("absent d'un temoin MESURE"))).toBe(true);
  });
});

// ─── L'ORACLE : la formule -42, reimplementee, opposee au moteur ───────────
//
// Reproduire le defaut en toutes lettres est le seul moyen de prouver qu'il ne
// revient pas : un test qui n'affirme que le comportement CORRECT passerait
// aussi bien sous une troisieme semantique, elle aussi fausse.

/** La ligne de -42, telle qu'elle etait. Ne JAMAIS appeler hors de ce test. */
function liftMeasurable42(args: {
  baselineOccasionsWithBuys: number;
  baselineBuysForWallet: number;
  observedBuysForWallet: number;
  minBaselineBuys: number;
}): boolean {
  const baselineRateExists = args.baselineOccasionsWithBuys > 0;
  return (
    baselineRateExists &&
    args.baselineOccasionsWithBuys >= 1 &&
    args.baselineBuysForWallet + args.observedBuysForWallet >= args.minBaselineBuys
  );
}

describe("anti-regression -42 : l'oracle, et le desaccord exige", () => {
  it("desaccord 1 - temoin sous son plancher, sauve par l'addition", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      record(occasion(`d1_${i}`, "kol_d1", i * 120), {
        observations: Array.from({ length: 4 }, (_, j) =>
          buy(`W${j}`, "pre_tweet", -100, `d1-obs-${i}-${j}`),
        ),
        baseline:
          i < 4
            ? baselineCollected([baselineBuy("W0", -100, `d1-base-${i}`)])
            : baselineCollectedEmpty(),
      }),
    );

    // -42 : 4 occasions temoin non vides, 1 achat temoin pour W0, 10 observes
    //       => 1 + 10 = 11 >= 5 => « mesurable ».
    expect(
      liftMeasurable42({
        baselineOccasionsWithBuys: 4,
        baselineBuysForWallet: 1,
        observedBuysForWallet: 10,
        minBaselineBuys: P.minBaselineBuys,
      }),
    ).toBe(true);

    // Le moteur : le temoin porte 4 achats < 5. Refus, et le refus le dit.
    const f = computeFeatures(records, P).find((x) => x.wallet === "W0")!;
    expect(f.baselineTally.buys.value).toBe(4);
    expect(isMeasured(f.lift)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_BELOW_FLOOR");
  });

  it("desaccord 2 - wallet absent d'un temoin fourni, promu par le plafond", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`d2_${i}`, "kol_d2", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `d2-obs-${i}`)],
        baseline: baselineCollected([baselineBuy("WAUTRE", -100, `d2-base-${i}`)]),
      }),
    );

    // -42 : 8 occasions temoin non vides, 0 achat temoin pour W1, 8 observes
    //       => 0 + 8 >= 5 => « mesurable », puis lift = liftCapWhenBaselineZero.
    expect(
      liftMeasurable42({
        baselineOccasionsWithBuys: 8,
        baselineBuysForWallet: 0,
        observedBuysForWallet: 8,
        minBaselineBuys: P.minBaselineBuys,
      }),
    ).toBe(true);

    const f = computeFeatures(records, P).find((x) => x.wallet === "W1")!;
    expect(isMeasured(f.lift)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_ZERO_OCCURRENCES");
  });

  it("accord attendu - un temoin reellement fourni se mesure des deux cotes", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`d3_${i}`, "kol_d3", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `d3-obs-${i}`)],
        baseline:
          i < 4
            ? baselineCollected([
                baselineBuy("W1", -100, `d3-base-${i}`),
                baselineBuy("WX", -80, `d3-basex-${i}`),
              ])
            : baselineCollectedEmpty(),
      }),
    );

    expect(
      liftMeasurable42({
        baselineOccasionsWithBuys: 4,
        baselineBuysForWallet: 4,
        observedBuysForWallet: 8,
        minBaselineBuys: P.minBaselineBuys,
      }),
    ).toBe(true);

    // Le moteur est d'accord ICI - et c'est le point : il n'est pas plus
    // restrictif partout, il est restrictif LA OU la mesure manque.
    const f = computeFeatures(records, P).find((x) => x.wallet === "W1")!;
    expect(f.baselineTally.buys.value).toBe(8);
    expect(isMeasured(f.lift)).toBe(true);
    expect(f.liftUnmeasurableReason).toBeNull();
  });
});

describe("anti-regression -42 : tripwire de source", () => {
  const dir = join(__dirname, "..");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), "utf8") }));

  it("aucun module v2 ne compare minBaselineBuys a une somme", () => {
    // La faute exacte : un `+` du cote gauche d'une comparaison a minBaselineBuys.
    const offending = /minBaselineBuys/.source;
    for (const { file, text } of sources) {
      for (const line of text.split("\n")) {
        // On ignore les commentaires : le defaut y est cite volontairement.
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) continue;
        if (!new RegExp(offending).test(code)) continue;
        expect(
          /\+[^\n]*minBaselineBuys|minBaselineBuys[^\n]*\+/.test(code),
          `${file} : « ${code} » additionne quelque chose autour de minBaselineBuys`,
        ).toBe(false);
      }
    }
  });

  it("assessBaselineFloor ne recoit aucun compteur d'observation", () => {
    const tally = sources.find((s) => s.file === "tally.ts")!.text;
    const sig = tally.slice(tally.indexOf("export function assessBaselineFloor"));
    const head = sig.slice(0, sig.indexOf("{"));
    expect(head).toContain("BaselineSide");
    expect(head).not.toContain("ObservedSide");
  });

  it("assessObservedFloor ne recoit aucun compteur temoin", () => {
    const tally = sources.find((s) => s.file === "tally.ts")!.text;
    const sig = tally.slice(tally.indexOf("export function assessObservedFloor"));
    const head = sig.slice(0, sig.indexOf("{"));
    expect(head).toContain("ObservedSide");
    expect(head).not.toContain("BaselineSide");
  });
});
