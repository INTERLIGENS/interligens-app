export type CaseFileParams = {
  id: string;
  lang: "en" | "fr";
};

export function buildCaseFileUrl({ id, lang }: CaseFileParams): string {
  return `/api/report/casefile?mint=${encodeURIComponent(id)}&lang=${lang}&t=${Date.now()}`;
}

export function buildCaseFileFilename(id: string): string {
  return `casefile-${id.slice(0, 8)}.pdf`;
}
