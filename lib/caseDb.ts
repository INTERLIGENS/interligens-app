import path from "path";
import fs from "fs";

// ── BUILD 8 / E2 — même correctif que src/lib/caseDb.ts ────────────────────
// Ce duplicat est vivant : src/app/api/scan/timeline/[address]/route.ts
// l'importe par chemin relatif. Le laisser clé sur l'alias aurait maintenu le
// défaut sur cette route pendant qu'il était fermé partout ailleurs.
import { BOTIFY_MINT, casefileLookupKey } from "../src/lib/kol-memory/tokenIdentity";

const MINT_TO_CASE: Record<string, string> = {
  [BOTIFY_MINT]: "botify.json",
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
  const filename = MINT_TO_CASE[casefileLookupKey(mint)];
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
