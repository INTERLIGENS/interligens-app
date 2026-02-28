import path from "path";
import fs from "fs";

const MINT_TO_CASE: Record<string, string> = {
  BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb: "botify.json",
};

export type CaseClaim = {
  claim_id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "CONFIRMED" | "UNCONFIRMED" | "DISPUTED";
  description: string;
  evidence_refs: string[];
  thread_url: string | null;
  category: string;
};

export type CaseSource = {
  source_id: string;
  type: "screenshot" | "thread" | "onchain";
  filename: string | null;
  caption: string;
  captured_at: string;
};

export type CaseMeta = {
  case_id: string;
  token_name: string;
  ticker: string;
  mint: string;
  chain: string;
  status: string;
  severity: string;
  opened_at: string;
  updated_at: string;
  investigator: string;
  summary: string;
};

export type CaseFile = {
  case_meta: CaseMeta;
  sources: CaseSource[];
  claims: CaseClaim[];
};

export function loadCaseByMint(mint: string): CaseFile | null {
  const filename = MINT_TO_CASE[mint];
  if (!filename) return null;

  const filePath = path.join(process.cwd(), "data", "cases", filename);

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as CaseFile;
    console.log(
      `[caseDb] offchain_source=case_db case_id=${parsed.case_meta.case_id} ` +
        `claims_count=${parsed.claims.length}`
    );
    return parsed;
  } catch (err) {
    console.error(`[caseDb] Failed to load ${filePath}:`, err);
    return null;
  }
}
