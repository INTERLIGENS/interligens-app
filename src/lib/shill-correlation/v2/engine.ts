// --- Orchestrateur (pur, sans I/O) ---------------------------------------
//
// Prend des occasions deja collectees, rend des candidats + une telemetrie.
// Aucun appel reseau, aucune ecriture : les I/O appartiennent a l'appelant.
// C'est ce qui rend le moteur testable sur fixtures et backtestable.
//
// INTERDITS structurels, tenus par le type de sortie :
//   - reviewStatus vaut TOUJOURS 'draft' : le moteur ne conclut pas ;
//   - _nature vaut TOUJOURS INFERENCE : le moteur calcule, il n'observe pas ;
//   - aucun handle de KOL n'est attache a un wallet comme propriete : le
//     couple (kolHandle, wallet) decrit une CO-OCCURRENCE, et les limitations
//     du score le rappellent.

import { computeFeatures } from "./features";
import { buildTelemetry, isObservedAnalyzable, markScored } from "./journal";
import { buildInferenceEnvelope } from "./nature";
import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from "./policy";
import { scoreFeatures } from "./scoring";
import { observedOccasionsForWallet } from "./tally";
import type { CandidateInference, EngineTelemetry, OccasionRecord } from "./types";

export interface EngineResult {
  candidates: CandidateInference[];
  records: OccasionRecord[];
  telemetry: EngineTelemetry;
  policy: EnginePolicy;
}

export function runEngine(
  input: readonly OccasionRecord[],
  policy: EnginePolicy = DEFAULT_ENGINE_POLICY,
): EngineResult {
  const features = computeFeatures(input, policy);
  const analyzable = input.filter(isObservedAnalyzable);

  const candidates: CandidateInference[] = features.map((f) => {
    // Les occasions qui fondent l'inference sont celles ou le wallet a ete vu
    // du cote OBSERVATION. Le temoin fonde le denominateur, pas la piste.
    const ids = observedOccasionsForWallet(analyzable, f.wallet, f.chain);
    const contributing = analyzable.filter(
      (r) => r.occasion.kolHandle === f.kolHandle && ids.has(r.occasion.occasionId),
    );
    return {
      kolHandle: f.kolHandle,
      wallet: f.wallet,
      chain: f.chain,
      features: f,
      scores: scoreFeatures(f, policy),
      // Verrou de doctrine : jamais autre chose que 'draft'.
      reviewStatus: "draft" as const,
      _nature: buildInferenceEnvelope(contributing, policy),
    };
  });

  // T1-b : toute occasion ayant contribue est marquee 'scored'. C'est ici, et
  // nulle part ailleurs, que l'etat de la source suit la production de sorties.
  const contributed = new Set<string>();
  for (const c of candidates) for (const id of c._nature.basisRefs.occasionIds) contributed.add(id);
  const records = input.map((r) => (contributed.has(r.occasion.occasionId) ? markScored(r) : r));

  return { candidates, records, telemetry: buildTelemetry(records, candidates), policy };
}
