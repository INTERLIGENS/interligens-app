/**
 * src/lib/pdf/nova/generate.ts
 *
 * Renders the $NOVA synthetic casefile to a PDF Buffer using puppeteer-core +
 * @sparticuz/chromium-min. Matches the launcher pattern used by
 * src/app/api/report/v2/route.ts so we share the same chromium pack URL on R2.
 *
 * Margins are driven by print-nova.css (@page rule); we still pass them to
 * page.pdf() as a safety net in case the @page rule is overridden by upstream
 * defaults.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { templateNova } from "./templateNova";

const CHROMIUM_PACK_URL =
  "https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev/chromium-v143.0.4-pack.x64.tar";

export interface GenerateNovaPDFInput {
  version: string;
}

export async function generateNovaPDF(
  input: GenerateNovaPDFInput,
): Promise<Buffer> {
  const css = await fs.readFile(
    path.join(process.cwd(), "src/lib/pdf/nova/print-nova.css"),
    "utf-8",
  );
  const html = templateNova({ version: input.version, css });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      args: chromium.args,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "16mm", bottom: "22mm", left: "16mm" },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdf);
  } finally {
    await browser?.close();
  }
}
