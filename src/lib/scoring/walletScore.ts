export type WalletScoreDriver = {
  title: string;
  impact: "low" | "med" | "high";
  evidence: string;
};

export type WalletScoreResult = {
  score: number; // 0..100
  tier: "GREEN" | "ORANGE" | "RED";
  drivers: WalletScoreDriver[];
};

export type WalletScoreInput = {
  fungiblesTop: Array<{
    usd: number | null;
    hasFreezeAuthority: boolean;
    mutable: boolean;
  }>;
  fungiblesCount: number;
  nftCount: number;
};

export function scoreWallet(summary: WalletScoreInput): WalletScoreResult {
  let score = 15;
  const drivers: WalletScoreDriver[] = [];

  const unpriced = summary.fungiblesTop.filter((t) => t.usd == null).length;
  if (unpriced > 0) {
    score += Math.min(25, unpriced * 5);
    drivers.push({
      title: "Unpriced / obscure tokens",
      impact: "med",
      evidence: `${unpriced} token(s) in top holdings have no price data.`,
    });
  }

  const freezeAuth = summary.fungiblesTop.filter((t) => t.hasFreezeAuthority).length;
  if (freezeAuth > 0) {
    score += Math.min(30, freezeAuth * 10);
    drivers.push({
      title: "Freeze authority present",
      impact: "high",
      evidence: `${freezeAuth} token(s) show a freeze authority (possible transfer restrictions).`,
    });
  }

  const mutable = summary.fungiblesTop.filter((t) => t.mutable).length;
  if (mutable > 0) {
    score += Math.min(15, mutable * 3);
    drivers.push({
      title: "Mutable metadata",
      impact: "low",
      evidence: `${mutable} token(s) have mutable metadata.`,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const tier: WalletScoreResult["tier"] = score >= 70 ? "RED" : score >= 40 ? "ORANGE" : "GREEN";

  return { score, tier, drivers: drivers.slice(0, 5) };
}
