// src/app/api/casefile/generate/route.ts
//
// POST /api/casefile/generate
//   Body: { source: "vine" | "custom", data?: CaseFileInput, uploadToR2?: boolean }
//   Returns: PDF binary (application/pdf) or JSON with R2 key
//
// Admin-only route.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  generateCaseFilePdf,
  type CaseFileInput,
} from "@/lib/casefile/pdfGenerator";

import vineOsint from "@/data/vine-osint.json";
import vineSmokingGuns from "@/data/vine-smoking-guns.json";

export const runtime = "nodejs";
export const maxDuration = 300;

function buildVineInput(): CaseFileInput {
  const meta = vineOsint.case_meta;
  return {
    case_meta: {
      case_id: meta.case_id,
      token_name: meta.token_name,
      ticker: meta.ticker,
      mint: meta.mint,
      chain: meta.chain,
      deployer: meta.deployer,
      status: meta.status,
      severity: meta.severity,
      summary: meta.summary,
      summary_fr: meta.summary_fr,
      launched_at: meta.launched_at,
      ath_market_cap_usd: meta.ath_market_cap_usd,
      current_market_cap_usd: meta.current_market_cap_usd,
      drawdown_pct: meta.drawdown_pct,
    },
    timeline: vineOsint.timeline as CaseFileInput["timeline"],
    shillers: vineOsint.shillers as CaseFileInput["shillers"],
    wallets_onchain: vineOsint.wallets_onchain as CaseFileInput["wallets_onchain"],
    new_claims: vineOsint.new_claims as CaseFileInput["new_claims"],
    smoking_guns: {
      tier_1: vineSmokingGuns.tier_1_criminal_insider_trading as CaseFileInput["smoking_guns"] extends infer T ? T extends { tier_1?: infer U } ? U : never : never,
      tier_2: vineSmokingGuns.tier_2_coordination_evidence as CaseFileInput["smoking_guns"] extends infer T ? T extends { tier_2?: infer U } ? U : never : never,
      tier_3: vineSmokingGuns.tier_3_contextual_supporting as CaseFileInput["smoking_guns"] extends infer T ? T extends { tier_3?: infer U } ? U : never : never,
      verdict_fr: vineSmokingGuns.overall_assessment.verdict_fr,
    },
    requisitions: vineSmokingGuns.recommended_requisitions as CaseFileInput["requisitions"],
  };
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { source?: string; data?: CaseFileInput; uploadToR2?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input: CaseFileInput;
  if (body.source === "vine") {
    input = buildVineInput();
  } else if (body.data) {
    input = body.data;
  } else {
    return NextResponse.json(
      { error: "Provide source='vine' or a custom data object" },
      { status: 400 }
    );
  }

  const result = await generateCaseFilePdf(input, {
    uploadToR2: body.uploadToR2 ?? false,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (body.uploadToR2 && result.r2Key) {
    return NextResponse.json({
      success: true,
      r2Key: result.r2Key,
      sizeBytes: result.pdfBytes?.length,
    });
  }

  return new NextResponse(result.pdfBytes ? Buffer.from(result.pdfBytes) : null, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${input.case_meta.case_id}.pdf"`,
      "Cache-Control": "no-cache",
    },
  });
}
