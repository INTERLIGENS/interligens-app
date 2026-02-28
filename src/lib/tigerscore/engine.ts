export type TigerTier = "GREEN" | "ORANGE" | "RED";

export type TigerDriver = {
  id: string;
  label: string;
  severity: "low" | "med" | "high" | "critical";
  delta: number;
  why: string;
};

export type TigerInput = {
  chain: "SOL" | "ETH" | "TRON" | "BSC" | "HYPER";
  deep?: boolean;
  unlimitedApprovals?: number;
  approvalsTotal?: number;
  unknownPrograms?: number;
  txCount?: number;
  freezeAuthority?: boolean;
  mintAuthorityActive?: boolean;
  mutableMetadata?: boolean;
  manipulationLevel?: "low" | "med" | "high";
  alertsLevel?: "low" | "med" | "high";
  trustLevel?: "low" | "med" | "high";
  confirmedCriticalClaims?: number;
};

export type TigerResult = {
  score: number;
  tier: TigerTier;
  drivers: TigerDriver[];
  confidence: "Low" | "Medium" | "High";
};

export function computeTigerScore(input: TigerInput): TigerResult {
  const drivers: TigerDriver[] = [];
  let score = 0;

  const add = (d: TigerDriver) => { drivers.push(d); score += d.delta; };

  if ((input.unlimitedApprovals ?? 0) >= 1)
    add({ id: "unlimited_approvals", label: "Unlimited approvals detected", severity: "critical", delta: 70, why: "Spender can drain wallet at any time" });

  if ((input.unlimitedApprovals ?? 0) === 0 && (input.approvalsTotal ?? 0) >= 9)
    add({ id: "high_approvals", label: "High approval count", severity: "high", delta: 35, why: "Large attack surface from many approvals" });

  if ((input.unknownPrograms ?? 0) >= 1)
    add({ id: "unknown_programs", label: "Unknown programs interacted", severity: "high", delta: 35, why: "Unverified programs may be malicious" });

  if (input.freezeAuthority === true)
    add({ id: "freeze_authority", label: "Freeze authority active", severity: "critical", delta: 70, why: "Deployer can freeze your tokens" });

  if (input.mintAuthorityActive === true)
    add({ id: "mint_authority", label: "Mint authority not revoked", severity: "critical", delta: 35, why: "Deployer can inflate supply and dump" });

  if (input.mutableMetadata === true)
    add({ id: "mutable_metadata", label: "Mutable metadata", severity: "med", delta: 15, why: "Token metadata can be changed post-launch" });

  if ((input.txCount ?? 999) < 5)
    add({ id: "low_tx_count", label: "Very low transaction history", severity: "med", delta: 10, why: "Wallet/token has minimal activity — disposable pattern" });

  if (input.manipulationLevel === "high")
    add({ id: "manipulation_high", label: "High manipulation pressure", severity: "high", delta: 20, why: "Coordinated shill or pump signals detected" });

  if (input.alertsLevel === "high")
    add({ id: "alerts_high", label: "High community alerts", severity: "high", delta: 15, why: "Community reports rising distress signals" });

  if (input.trustLevel === "low")
    add({ id: "trust_low", label: "Low trust score", severity: "med", delta: 15, why: "Transparency signals below acceptable threshold" });

  if ((input.confirmedCriticalClaims ?? 0) >= 1)
    add({ id: "confirmed_critical_claims", label: "Confirmed critical claims on file", severity: "critical", delta: 70, why: "Detective-referenced critical evidence found" });

  const clampedScore = Math.min(100, Math.max(0, score));
  const tier: TigerTier = clampedScore >= 70 ? "RED" : clampedScore >= 35 ? "ORANGE" : "GREEN";
  const confidence: "Low" | "Medium" | "High" =
    drivers.length === 0 ? "Low" : input.deep ? "High" : "Medium";

  return { score: clampedScore, tier, drivers, confidence };
}
