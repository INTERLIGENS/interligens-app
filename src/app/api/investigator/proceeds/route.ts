import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorApi } from "@/lib/security/investigatorAuth";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const deny = requireInvestigatorApi(req);
  if (deny) return deny;

  // Aggregate detective_trade data from all case files
  const casesDir = path.join(process.cwd(), "src", "data", "cases");
  try {
    const files = fs.readdirSync(casesDir).filter((f) => f.endsWith(".json"));
    const proceeds: Array<{
      case_id: string;
      token: string;
      ticker: string;
      wallet: string;
      pnl_usd: number | null;
      buy_tx: string;
      sell_tx: string;
      notes: string;
    }> = [];

    for (const f of files) {
      const raw = fs.readFileSync(path.join(casesDir, f), "utf-8");
      const parsed = JSON.parse(raw);
      const trade = parsed.detective_trade;
      if (trade) {
        proceeds.push({
          case_id: parsed.case_meta?.case_id ?? f,
          token: parsed.case_meta?.token_name ?? "UNKNOWN",
          ticker: parsed.case_meta?.ticker ?? "",
          wallet: trade.wallet,
          pnl_usd: trade.pnl_usd ?? null,
          buy_tx: trade.buy_tx,
          sell_tx: trade.sell_tx,
          notes: trade.notes_en ?? "",
        });
      }
    }

    return NextResponse.json({ proceeds });
  } catch {
    return NextResponse.json({ proceeds: [] });
  }
}
