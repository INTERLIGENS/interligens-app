import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorApi } from "@/lib/security/investigatorAuth";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const deny = requireInvestigatorApi(req);
  if (deny) return deny;

  const publicDir = path.join(process.cwd(), "public");
  try {
    const all = fs.readdirSync(publicDir);
    const pdfs = all
      .filter((f) => f.endsWith(".pdf"))
      .map((f) => {
        const stat = fs.statSync(path.join(publicDir, f));
        return {
          filename: f,
          url: `/${f}`,
          sizeKb: Math.round(stat.size / 1024),
          modified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified));
    return NextResponse.json({ pdfs });
  } catch {
    return NextResponse.json({ pdfs: [] });
  }
}
