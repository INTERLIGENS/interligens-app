// src/lib/kol/cexComplicityScore.ts
// Sprint 5 — CEX Complicity Score
// Score 0-100 mesurant le degré de complicité d'un CEX dans un cashout event

export interface CexComplicityInput {
  exchangeName: string;
  walletAddress: string;
  chain: "SOL" | "ETH" | "BASE" | string;

  // Volume et timing
  amountUsd: number;
  uniqueSenders: number;
  txCount: number;
  daysAfterExitEvent: number | null; // null si pas d'exit event connu

  // KYC / compliance
  hasKyc: boolean | null;        // null = unknown
  kycJurisdiction: string | null;
  reportedToFiu: boolean;        // déjà signalé à une FIU
  previousCases: number;         // nb de fois dans des cas similaires

  // Mixer / relay
  receivedFromMixer: boolean;
  relayDepth: number;            // nb de hops depuis wallet source
}

export interface CexComplicityResult {
  exchange: string;
  wallet: string;
  score: number;           // 0-100
  tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: CexComplicityFactor[];
  recommendation: string;
  reportPriority: "ROUTINE" | "URGENT" | "IMMEDIATE";
}

interface CexComplicityFactor {
  id: string;
  label: string;
  points: number;
  maxPoints: number;
  triggered: boolean;
  detail: string;
}

// ─── Scoring ──────────────────────────────────────────────────
export function computeCexComplicityScore(
  input: CexComplicityInput
): CexComplicityResult {
  const factors: CexComplicityFactor[] = [];
  let totalScore = 0;

  // F1 — Volume reçu
  const f1Points =
    input.amountUsd >= 200_000 ? 25 :
    input.amountUsd >= 50_000  ? 18 :
    input.amountUsd >= 10_000  ? 10 :
    input.amountUsd >= 1_000   ? 5  : 2;
  factors.push({
    id: "F1_VOLUME",
    label: "Volume reçu",
    points: f1Points,
    maxPoints: 25,
    triggered: true,
    detail: `$${input.amountUsd.toLocaleString()} reçus → ${f1Points} pts`,
  });
  totalScore += f1Points;

  // F2 — Nombre d'expéditeurs uniques (structuring indicator)
  const f2Triggered = input.uniqueSenders >= 20;
  const f2Points = f2Triggered
    ? (input.uniqueSenders >= 50 ? 15 : 10)
    : 0;
  factors.push({
    id: "F2_SENDERS",
    label: "Expéditeurs uniques (structuring)",
    points: f2Points,
    maxPoints: 15,
    triggered: f2Triggered,
    detail: `${input.uniqueSenders} expéditeurs uniques → ${f2Points} pts`,
  });
  totalScore += f2Points;

  // F3 — Timing post exit event
  const f3Triggered = input.daysAfterExitEvent !== null && input.daysAfterExitEvent <= 1;
  const f3Points = f3Triggered ? 20 : (input.daysAfterExitEvent !== null && input.daysAfterExitEvent <= 7 ? 10 : 0);
  factors.push({
    id: "F3_TIMING",
    label: "Timing post exit event",
    points: f3Points,
    maxPoints: 20,
    triggered: f3Triggered,
    detail: input.daysAfterExitEvent !== null
      ? `Dépôt J+${input.daysAfterExitEvent} après exit event → ${f3Points} pts`
      : "Pas d'exit event documenté → 0 pts",
  });
  totalScore += f3Points;

  // F4 — Fonds issus d'un mixer / relay
  const f4Points = input.receivedFromMixer ? 15 : 0;
  const f4Relay = input.relayDepth >= 3 ? 5 : (input.relayDepth >= 1 ? 2 : 0);
  factors.push({
    id: "F4_MIXER",
    label: "Fonds issus mixer/relay",
    points: f4Points + f4Relay,
    maxPoints: 20,
    triggered: input.receivedFromMixer,
    detail: `Mixer: ${input.receivedFromMixer}, relay depth: ${input.relayDepth} → ${f4Points + f4Relay} pts`,
  });
  totalScore += f4Points + f4Relay;

  // F5 — Absence de KYC
  const f5Points = input.hasKyc === false ? 10 : (input.hasKyc === null ? 5 : 0);
  factors.push({
    id: "F5_KYC",
    label: "Absence / inconnu KYC",
    points: f5Points,
    maxPoints: 10,
    triggered: input.hasKyc !== true,
    detail: `KYC: ${input.hasKyc === null ? "inconnu" : input.hasKyc ? "oui" : "non"} → ${f5Points} pts`,
  });
  totalScore += f5Points;

  // F6 — Récidive (cas précédents)
  const f6Points = Math.min(input.previousCases * 3, 10);
  factors.push({
    id: "F6_RECURRENCE",
    label: "Récidive — cas précédents",
    points: f6Points,
    maxPoints: 10,
    triggered: input.previousCases > 0,
    detail: `${input.previousCases} cas précédents → ${f6Points} pts`,
  });
  totalScore += f6Points;

  // Cap at 100
  const score = Math.min(totalScore, 100);

  const tier: CexComplicityResult["tier"] =
    score >= 80 ? "CRITICAL" :
    score >= 60 ? "HIGH" :
    score >= 35 ? "MEDIUM" : "LOW";

  const recommendation =
    tier === "CRITICAL"
      ? "Demande de gel immédiate. Signalement SAR/TRACFIN. Inclure dans freeze package."
      : tier === "HIGH"
      ? "Préservation demandée. Subpoena / MLAT recommandé. Inclure dans rapport légal."
      : tier === "MEDIUM"
      ? "Surveillance renforcée. Conserver comme pièce. Signalement si autres éléments convergent."
      : "Surveillance passive. Documenter pour contexte.";

  const reportPriority: CexComplicityResult["reportPriority"] =
    tier === "CRITICAL" ? "IMMEDIATE" :
    tier === "HIGH" ? "URGENT" : "ROUTINE";

  return {
    exchange: input.exchangeName,
    wallet: input.walletAddress,
    score,
    tier,
    factors,
    recommendation,
    reportPriority,
  };
}

// ─── Preset : Titan Exchange (D5Yq) ──────────────────────────
export function titanExchangeScore(): CexComplicityResult {
  return computeCexComplicityScore({
    exchangeName: "TITAN EXCHANGE",
    walletAddress: "D5YqVMoSxnqeZAKAUUE1Dm3bmjtdxQ5DCF356ozqN9cM",
    chain: "SOL",
    amountUsd: 64_000,
    uniqueSenders: 50,
    txCount: 50,
    daysAfterExitEvent: 0, // même jour que l'exit event
    hasKyc: null,          // inconnu
    kycJurisdiction: null,
    reportedToFiu: false,
    previousCases: 1,      // cas BK Kokoski
    receivedFromMixer: true,
    relayDepth: 3,         // HeaiDUtMQ → 1234Co → D5Yq
  });
}

// ─── Preset : ET3F ────────────────────────────────────────────
export function et3fScore(): CexComplicityResult {
  return computeCexComplicityScore({
    exchangeName: "UNKNOWN CEX (ET3F)",
    walletAddress: "ET3F3q42vUpfDHW8rgrhA1S2WPwb6Fhx97fsLR3EkxSn",
    chain: "SOL",
    amountUsd: 97_000,
    uniqueSenders: 72,
    txCount: 72,
    daysAfterExitEvent: 0,
    hasKyc: null,
    kycJurisdiction: null,
    reportedToFiu: false,
    previousCases: 1,
    receivedFromMixer: true,
    relayDepth: 2,
  });
}
