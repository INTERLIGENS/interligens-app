import { WalletHop, SignalResult, LaundryTrailOutput } from "./signals";
import { runFrag } from "./detectors/frag";
import { runBridge } from "./detectors/bridge";
import { runMixer } from "./detectors/mixer";
import { runPriv } from "./detectors/priv";
import { runDeg } from "./detectors/deg";
import { runCash } from "./detectors/cash";
import { computeLaundryRisk, computeRecoveryDifficulty, computeTrailType } from "./scorer";
import { validateLaundryOutput } from "./guardrails";

export async function analyzeLaundryTrail(
  walletAddress: string,
  chain: string,
  hops: WalletHop[]
): Promise<LaundryTrailOutput> {
  const detectors = [runFrag, runBridge, runMixer, runPriv, runDeg, runCash];
  const signals = detectors.map(d => d(hops)).filter((s): s is SignalResult => s !== null);

  const degSignal = signals.find(s => s.family === "DEG");
  const trailBreakHop = (degSignal?.rawData?.breakHop as number) ?? undefined;
  const fundsUnresolved = (degSignal?.rawData?.fundsUnresolved as number) ?? undefined;

  const trailType = computeTrailType(signals);
  const evidenceNote = "Pattern detected via on-chain analysis. INTERLIGENS does not assert intent.";

  validateLaundryOutput(trailType);

  return {
    walletAddress,
    chain,
    signals,
    trailType,
    laundryRisk: computeLaundryRisk(signals),
    recoveryDifficulty: computeRecoveryDifficulty(signals, trailBreakHop),
    trailBreakHop,
    fundsUnresolved,
    evidenceNote,
  };
}
