import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorSession } from "@/lib/security/investigatorAuth";
import { getPublishedPdfs } from "@/lib/investigator/registry";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const deny = await requireInvestigatorSession(req);
  if (deny) return deny;

  const filename = req.nextUrl.searchParams.get("file");
  if (!filename || filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Only serve files that are in the published registry
  const published = getPublishedPdfs();
  const entry = published.find((p) => p.filename === filename);
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
