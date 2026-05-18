const API_BASE = "https://interligens.com";

export type Verdict = "GREEN" | "ORANGE" | "RED";

export interface ScoreLiteResponse {
  verdict: Verdict;
  score: number;
}

export async function fetchVerdict(address: string): Promise<Verdict> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/score-lite?address=${encodeURIComponent(address)}`);
    if (!res.ok) return "GREEN";
    const data = (await res.json()) as ScoreLiteResponse;
    const v = data.verdict;
    if (v === "RED" || v === "ORANGE" || v === "GREEN") return v;
    return "GREEN";
  } catch {
    return "GREEN";
  }
}
