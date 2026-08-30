// --- Features de correlation (pur, sans I/O) ------------------------------
//
// L'unite de comptage est l'OCCASION, jamais l'evenement (correctif #1,
// occasions.ts). Une observation ne compte qu'une fois par occasion,
// dedupliquee sur la signature de transaction : deux evenements replies
// collectent le meme achat on-chain, pas deux achats.
//
// ═══ B - UN LIFT QUI NE SE CALCULE PAS N'EST PAS UN LIFT NUL ══════════════
//
// Toute impossibilite de calculer le lift rend `UNMEASURED` - la valeur du
// vocabulaire deja en place (measurement.ts, SHILL-C1) - accompagnee d'un
// motif enumere. Il n'y a ni epsilon, ni valeur de substitution, ni plafond
// de remplacement : le seul moyen d'obtenir un nombre est d'avoir mesure les
// deux taux.
//
// Le cas « temoin mesure, wallet absent » (denominateur nul) est le cas le
// plus tentant : -42 lui donnait 10, le maximum du bareme. Il est ici
// NON MESURE, et le fait qui l'interesse - le wallet n'apparait pas dans un
// temoin pourtant fourni - est rapporte separement, sans effet sur le score.

import {
  UNMEASURED,
  exactMeasurement,
  isMeasured,
  type Measurement,
} from "../measurement";
import { observationDedupKey } from "../occasions";
import {
  assessBaselineFloor,
  assessObservedFloor,
  baselineOccasionsForWallet,
  buildBaselineSide,
  buildObservedSide,
  observedOccasionsForWallet,
} from "./tally";
import { baselineIsDisjoint } from "./windows";
import {
  OBSERVED_ANALYZABLE_STATES,
  type CorrelationFeatures,
  type LiftUnmeasurableReason,
  type OccasionRecord,
  type SideTally,
} from "./types";
import type { EnginePolicy } from "./policy";

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const walletKey = (wallet: string, chain: string) => `${wallet}|${chain}`;

interface WalletAcc {
  kolHandle: string;
  wallet: string;
  chain: string;
  /** Deduplication INTRA-occasion des observations (correctif #1). */
  counted: Set<string>;
  pre: number;
  near: number;
  post: number;
  exitCount: number;
}

export function computeFeatures(
  records: readonly OccasionRecord[],
  policy: EnginePolicy,
): CorrelationFeatures[] {
  // Seules les occasions REELLEMENT analysables entrent au denominateur : une
  // occasion non collectee ou en erreur n'est pas une occasion « ratee » par le
  // wallet, elle est une occasion dont on ne sait rien. Les compter gonflerait
  // le denominateur et ecraserait tous les ratios.
  const analyzable = records.filter((r) => OBSERVED_ANALYZABLE_STATES.includes(r.observedState));

  // Un KOL = un contexte de mesure. Les deux cotes sont construits par KOL,
  // separement, et ne se rencontrent qu'au moment de la division.
  const byKol = new Map<string, OccasionRecord[]>();
  for (const r of records) {
    const list = byKol.get(r.occasion.kolHandle) ?? [];
    list.push(r);
    byKol.set(r.occasion.kolHandle, list);
  }

  const accs = new Map<string, WalletAcc>();
  const kolsByWallet = new Map<string, Set<string>>();

  for (const r of analyzable) {
    const kol = r.occasion.kolHandle;
    const occId = r.occasion.occasionId;
    for (const o of r.observations) {
      const k = `${kol}|${walletKey(o.wallet, o.chain)}`;
      let a = accs.get(k);
      if (!a) {
        a = { kolHandle: kol, wallet: o.wallet, chain: o.chain, counted: new Set(), pre: 0, near: 0, post: 0, exitCount: 0 };
        accs.set(k, a);
      }
      const dedup = `${occId}|${observationDedupKey(o)}`;
      if (a.counted.has(dedup)) continue;
      a.counted.add(dedup);
      if (o.behaviorType === "pre_tweet") a.pre++;
      else if (o.behaviorType === "near_tweet") a.near++;
      else a.post++;
      if (o.exitDeltaSeconds != null) a.exitCount++;

      const wk = walletKey(o.wallet, o.chain);
      const set = kolsByWallet.get(wk) ?? new Set<string>();
      set.add(kol);
      kolsByWallet.set(wk, set);
    }
  }

  // Verdicts de plancher, calcules UNE fois par KOL, chacun sur son seul cote.
  const kolContext = new Map<
    string,
    {
      observed: ReturnType<typeof assessObservedFloor>;
      baseline: ReturnType<typeof assessBaselineFloor>;
      records: OccasionRecord[];
    }
  >();
  for (const [kol, list] of byKol) {
    kolContext.set(kol, {
      observed: assessObservedFloor(buildObservedSide(list), policy),
      baseline: assessBaselineFloor(buildBaselineSide(list), policy),
      records: list,
    });
  }

  const out: CorrelationFeatures[] = [];
  for (const a of accs.values()) {
    const ctx = kolContext.get(a.kolHandle)!;

    const analyzableOccasions = ctx.observed.tally.occasions;
    const observedOccasions = observedOccasionsForWallet(ctx.records, a.wallet, a.chain).size;
    const baselineMeasuredOccasions = ctx.baseline.tally.occasions;
    const baselineOccurrences = baselineOccasionsForWallet(ctx.records, a.wallet, a.chain).size;

    const observedRate: Measurement =
      analyzableOccasions > 0 ? exactMeasurement(observedOccasions / analyzableOccasions) : UNMEASURED;
    const baselineRate: Measurement =
      baselineMeasuredOccasions > 0
        ? exactMeasurement(baselineOccurrences / baselineMeasuredOccasions)
        : UNMEASURED;

    const { lift, reason } = computeLift({
      policy,
      observedRate,
      baselineRate,
      baselineOccurrences,
      baselineFloor: ctx.baseline,
      observedFloor: ctx.observed,
    });

    out.push({
      kolHandle: a.kolHandle,
      wallet: a.wallet,
      chain: a.chain,

      observedOccasions,
      analyzableOccasions,
      ratioObserved: analyzableOccasions > 0 ? round4(observedOccasions / analyzableOccasions) : 0,
      observedRate,
      preTweetCount: a.pre,
      nearTweetCount: a.near,
      postTweetCount: a.post,
      exitCount: a.exitCount,
      distinctKolCount: kolsByWallet.get(walletKey(a.wallet, a.chain))?.size ?? 1,

      baselineOccurrences,
      baselineMeasuredOccasions,
      baselineRate,

      observedTally: ctx.observed.tally,
      baselineTally: ctx.baseline.tally,

      lift,
      liftUnmeasurableReason: reason,
      // FAIT, pas score : le temoin est mesure ET franchit son plancher, et ce
      // wallet n'y apparait pas une seule fois.
      absentFromMeasuredBaseline:
        baselineMeasuredOccasions > 0 && ctx.baseline.verdict === "above" && baselineOccurrences === 0,
    });
  }

  return out;
}

interface LiftInput {
  policy: EnginePolicy;
  observedRate: Measurement;
  baselineRate: Measurement;
  baselineOccurrences: number;
  baselineFloor: { tally: SideTally; verdict: "above" | "below" | "indeterminate" };
  observedFloor: { tally: SideTally; verdict: "above" | "below" | "indeterminate" };
}

/**
 * B - la porte unique du lift. Elle rend soit une mesure, soit UNMEASURED avec
 * un motif. Il n'existe aucun troisieme chemin : pas de valeur par defaut, pas
 * de plafond, pas d'epsilon au denominateur.
 *
 * L'ordre des refus est significatif - on nomme la cause la plus AMONT, celle
 * qu'il faut lever en premier. Un temoin jamais collecte n'a pas a etre
 * rapporte comme « sous le plancher » : il n'a pas ete tente.
 */
export function computeLift(
  input: LiftInput,
): { lift: Measurement; reason: LiftUnmeasurableReason | null } {
  const no = (reason: LiftUnmeasurableReason) => ({ lift: UNMEASURED, reason });

  // 0. Le dispositif lui-meme doit etre valide : un temoin qui recouvre
  //    l'observation se compare a lui-meme.
  if (!baselineIsDisjoint(input.policy)) return no("BASELINE_WINDOW_OVERLAPS_OBSERVED");

  // 1. Y a-t-il seulement un temoin ? (denominateur du TAUX temoin)
  if (input.baselineFloor.tally.occasions === 0) return no("BASELINE_NOT_COLLECTED");

  // 2. SHILL-C1 - un temoin borne par un budget est un plancher, pas un total.
  //    `indeterminate` vient de compareToThreshold : meme grammaire, meme mot.
  if (input.baselineFloor.verdict === "indeterminate") return no("BASELINE_CENSORED");
  if (input.baselineFloor.verdict === "below") return no("BASELINE_BELOW_FLOOR");

  // 3. Plancher de l'OBSERVATION - variable distincte, verdict distinct.
  if (input.observedFloor.verdict === "indeterminate") return no("OBSERVED_CENSORED");
  if (input.observedFloor.verdict === "below") return no("OBSERVED_BELOW_FLOOR");

  // 4. ZERO EPSILON. Le temoin est mesure et suffisant, mais ce wallet n'y
  //    apparait pas : le denominateur du RATIO est nul. Une division par zero
  //    ne rend pas « tres grand », elle ne rend rien. Le fait est rapporte
  //    ailleurs (absentFromMeasuredBaseline) sans devenir un nombre.
  if (input.baselineOccurrences === 0) return no("BASELINE_ZERO_OCCURRENCES");

  // 5. Les deux taux doivent exister.
  if (!isMeasured(input.observedRate)) return no("OBSERVED_RATE_UNMEASURED");
  if (!isMeasured(input.baselineRate) || input.baselineRate.value === 0) {
    // Defense en profondeur : baselineOccurrences > 0 implique un taux > 0.
    // Si cette ligne s'execute, une invariance a ete rompue en amont - et le
    // moteur refuse, il n'improvise pas.
    return no("BASELINE_ZERO_OCCURRENCES");
  }

  return {
    lift: exactMeasurement(round4(input.observedRate.value / input.baselineRate.value)),
    reason: null,
  };
}
