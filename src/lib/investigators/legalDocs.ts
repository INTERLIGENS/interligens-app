/**
 * Server-side loader for INTERLIGENS legal documents (NDA, Beta Terms).
 *
 * Files live in /public/legal/{type}-{lang}-v{version}.txt and are read
 * from disk via fs.readFile (no HTTP fetch — this runs on the server).
 *
 * The SHA-256 hash computed here must match the client-side hash computed
 * in the browser over the exact displayed text. Any mismatch is treated as
 * a document integrity failure and the acceptance is rejected.
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type LegalDocType = "nda" | "terms";
export type LegalDocLanguage = "en" | "fr";

export interface LegalDocResult {
  content: string;
  hash: string;
  version: string;
  language: LegalDocLanguage;
  filename: string;
}

export async function getLegalDoc(
  docType: LegalDocType,
  language: LegalDocLanguage,
  version: string = "1.0"
): Promise<LegalDocResult> {
  const filename = `${docType}-${language}-v${version}.txt`;
  const filepath = path.join(process.cwd(), "public", "legal", filename);
  const content = await fs.readFile(filepath, "utf-8");
  const hash = crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
  return { content, hash, version, language, filename };
}
