export type CaseFileParams = {
  id: string;
  lang: "en" | "fr";
};

export function buildCaseFileUrl({ id, lang }: CaseFileParams): string {
  // Retail-visible CaseFile button calls /api/report/v2 (which supports the
  // `mock=1` retail bypass). The legacy /api/report/casefile endpoint still
  // exists but is admin-token-gated (SEC-001) — a retail-origin fetch to it
  // returns 401 and breaks the button.
  return `/api/report/v2?mint=${encodeURIComponent(id)}&lang=${lang}&mock=1&t=${Date.now()}`;
}

export function buildCaseFileFilename(id: string): string {
  return `casefile-${id.slice(0, 8)}.pdf`;
}
