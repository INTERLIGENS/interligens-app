import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { buildPlainteHtml } from "@/lib/plainte/htmlTemplate";
import { PRESET_MAP, type PlainteInput, type PlainteTheme } from "@/lib/plainte/data";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { preset?: string; data?: PlainteInput; theme?: PlainteTheme };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const theme: PlainteTheme = body.theme === "interligens" ? "interligens" : "print";

  let input: PlainteInput;
  if (body.preset && PRESET_MAP[body.preset]) {
    input = PRESET_MAP[body.preset];
  } else if (body.data) {
    input = body.data;
  } else {
    return NextResponse.json(
      { error: "Provide preset='vine'|'botify'|'drain' or a custom data object" },
      { status: 400 }
    );
  }

  try {
    const html = buildPlainteHtml(input, theme);
    const executablePath = await chromium.executablePath(CHROMIUM_URL);
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    let pdfBytes: Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdfBytes = (await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="width:100%;text-align:center;font-size:7px;color:${theme === "interligens" ? "#555" : "#888"};font-family:Arial">INTERLIGENS — app.interligens.com — ${new Date().toISOString().slice(0, 10)} — Page <span class="pageNumber"></span>/<span class="totalPages"></span> — CONFIDENTIEL</div>`,
      })) as Uint8Array;
    } finally {
      await browser.close();
    }

    const slug = (input.nom || "CASE").replace(/[^A-Za-z0-9]/g, "_").slice(0, 30);
    const jur = input.juridiction || "FR";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const themeSuffix = theme === "interligens" ? "_DARK" : "_PRINT";
    const filename = `INTERLIGENS_DOSSIER_${slug}_${jur}_${date}${themeSuffix}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
