export interface WhatYouSign {
  title_en: string;
  title_fr: string;
  lines_en: string[];
  lines_fr: string[];
}

export function buildWhatYouSign(scan: any): WhatYouSign | null {
  if (!scan) return null;
  const unlimitedCount = Number(scan?.on_chain?.unlimitedCount ?? scan?.unlimitedCount ?? 0);
  const spenders: any[] = scan?.on_chain?.spenders ?? scan?.spenders ?? [];
  const lines_en: string[] = [];
  const lines_fr: string[] = [];

  if (unlimitedCount > 0) {
    lines_en.push(`${unlimitedCount} unlimited approval${unlimitedCount > 1 ? "s" : ""} detected — revoke recommended.`);
    lines_fr.push(`${unlimitedCount} approbation${unlimitedCount > 1 ? "s" : ""} illimitée${unlimitedCount > 1 ? "s" : ""} détectée${unlimitedCount > 1 ? "s" : ""} — révocation conseillée.`);
  }

  const officialSpenders = spenders.filter((s: any) => s.badge === "OFFICIAL" || s.label?.toLowerCase().includes("uniswap") || s.label?.toLowerCase().includes("1inch"));
  const unknownSpenders = spenders.filter((s: any) => !s.badge || s.badge === "UNKNOWN");

  if (officialSpenders.length > 0 && lines_en.length < 2) {
    lines_en.push(`Official router approved (${officialSpenders[0].label ?? "DEX"}).`);
    lines_fr.push(`Routeur officiel approuvé (${officialSpenders[0].label ?? "DEX"}).`);
  } else if (unknownSpenders.length >= 2 && lines_en.length < 2) {
    lines_en.push(`${unknownSpenders.length} unknown spender approvals detected.`);
    lines_fr.push(`${unknownSpenders.length} approbations vers des adresses inconnues détectées.`);
  }

  if (lines_en.length === 0) return null;

  return {
    title_en: "What you signed",
    title_fr: "Ce que tu as signé",
    lines_en: lines_en.slice(0, 2),
    lines_fr: lines_fr.slice(0, 2),
  };
}
