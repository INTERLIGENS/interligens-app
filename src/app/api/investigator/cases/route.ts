import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorApi } from "@/lib/security/investigatorAuth";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const deny = requireInvestigatorApi(req);
  if (deny) return deny;

  const casesDir = path.join(process.cwd(), "src", "data", "cases");
  try {
    const files = fs.readdirSync(casesDir).filter((f) => f.endsWith(".json"));
    const cases = files.map((f) => {
      const raw = fs.readFileSync(path.join(casesDir, f), "utf-8");
      const parsed = JSON.parse(raw);
      return parsed.case_meta ?? null;
    }).filter(Boolean);
    return NextResponse.json({ cases });
  } catch {
    return NextResponse.json({ cases: [] });
  }
}
