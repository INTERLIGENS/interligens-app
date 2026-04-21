export type CaseFileParams = {
  id: string;
  lang: "en" | "fr";
};

export function buildCaseFileUrl({ id, lang }: CaseFileParams): string {
  return `/api/casefile/pdf?mint=${encodeURIComponent(id)}&template=public&lang=${lang}&mock=1&t=${Date.now()}`;
}

export function buildCaseFileFilename(id: string): string {
  return `casefile-${id.slice(0, 8)}.pdf`;
}
