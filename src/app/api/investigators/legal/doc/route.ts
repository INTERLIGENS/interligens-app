import { NextRequest, NextResponse } from "next/server";
import { getLegalDoc, type LegalDocType, type LegalDocLanguage } from "@/lib/investigators/legalDocs";
import { validateOnboardingSessionForApi } from "@/lib/investigators/accessGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: LegalDocType[] = ["nda", "terms"];
const VALID_LANGS: LegalDocLanguage[] = ["en", "fr"];

export async function GET(req: NextRequest) {
  const session = await validateOnboardingSessionForApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as LegalDocType | null;
  const lang = searchParams.get("lang") as LegalDocLanguage | null;
  const version = searchParams.get("version") ?? "1.0";

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!lang || !VALID_LANGS.includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }

  try {
    const doc = await getLegalDoc(type, lang, version);
    return NextResponse.json({
      content: doc.content,
      hash: doc.hash,
      version: doc.version,
      language: doc.language,
    });
  } catch (err) {
    console.error("[legal/doc] read failed", err);
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}
