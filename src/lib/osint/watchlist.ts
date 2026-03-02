// src/lib/osint/watchlist.ts
export type WatchCategory = "CA_promoter" | "narrative_actor" | "cta_pusher" | "domain_risk" | "generic";

export interface WatchlistEntry {
  handle: string;
  displayName: string;
  category: WatchCategory;
  hero: boolean;
  isWatched: boolean;
  sortRank: number;
  whyTracked: string;
}

export interface ProofEntry {
  url: string;
  label?: string;
}

export const DEMO_WATCHLIST: WatchlistEntry[] = [
  { handle: "JamesWynnReal", displayName: "James Wynn", category: "narrative_actor", hero: false, isWatched: true, sortRank: 100, whyTracked: "Potential narrative spikes observed (public posts)" },
  { handle: "GordonGekko", displayName: "Gordon Gekko", category: "cta_pusher", hero: false, isWatched: true, sortRank: 90, whyTracked: "CTA-like wording observed in public posts" },
  { handle: "HSIGMemeCoin", displayName: "HSIG Meme Coin", category: "CA_promoter", hero: true, isWatched: true, sortRank: 80, whyTracked: "Meme coin promotion with pump.fun links" },
  { handle: "DeeNowback", displayName: "Dee Nowback", category: "cta_pusher", hero: true, isWatched: true, sortRank: 75, whyTracked: "CTA-like wording observed in public posts" },
  { handle: "Claude_Memory", displayName: "Claude Memory", category: "cta_pusher", hero: true, isWatched: true, sortRank: 70, whyTracked: "CTA-like wording observed in public posts (airdrop / claim)" },
  { handle: "MustStopMurad", displayName: "Must Stop Murad", category: "narrative_actor", hero: true, isWatched: true, sortRank: 65, whyTracked: "High-volume narrative activity observed around token events" },
  { handle: "DonWedge", displayName: "Don Wedge", category: "domain_risk", hero: true, isWatched: true, sortRank: 60, whyTracked: "External links observed in public posts (review domain risk)" },
  { handle: "Corphishcoin", displayName: "Corphish Coin", category: "CA_promoter", hero: true, isWatched: true, sortRank: 55, whyTracked: "Repeated CA mentions observed in public posts/replies" },
  { handle: "SilverSoul_Ag", displayName: "Silver Soul", category: "CA_promoter", hero: false, isWatched: true, sortRank: 50, whyTracked: "CA detected in public posts" },
  { handle: "IronShield_Zion", displayName: "Iron Shield Zion", category: "CA_promoter", hero: false, isWatched: true, sortRank: 45, whyTracked: "CA detected in public posts" },
  { handle: "aaronschwen", displayName: "Aaron Schwen", category: "domain_risk", hero: false, isWatched: true, sortRank: 40, whyTracked: "External link patterns observed" },
  { handle: "SOLASTRONAUT01", displayName: "Sol Astronaut", category: "CA_promoter", hero: false, isWatched: true, sortRank: 35, whyTracked: "Solana CA drops in public posts" },
  { handle: "Kermitwifhat", displayName: "Kermit Wif Hat", category: "CA_promoter", hero: true, isWatched: false, sortRank: 10, whyTracked: "Frequent CA drops via public posts" },
  { handle: "avoidtherug", displayName: "Avoid The Rug", category: "narrative_actor", hero: true, isWatched: false, sortRank: 10, whyTracked: "Narrative activity observed around new token launches" },
];

export const DEMO_PROOFS: Record<string, ProofEntry[]> = {
  Kermitwifhat: [
    { url: "https://x.com/Kermitwifhat/status/2028198592381382837", label: "CA drop" },
    { url: "https://x.com/Kermitwifhat/status/2028191040600265047", label: "pump.fun link" },
    { url: "https://x.com/Kermitwifhat/status/2028168391517954515", label: "CTA" },
  ],
  HSIGMemeCoin: [
    { url: "https://x.com/HSIGMemeCoin/status/2028211438834033021", label: "pump.fun link" },
    { url: "https://x.com/HSIGMemeCoin/status/2028209848790245846", label: "CA drop" },
    { url: "https://x.com/HSIGMemeCoin/status/2028209656380743981", label: "CTA" },
  ],
  avoidtherug: [
    { url: "https://x.com/avoidtherug/status/2027807153881260329", label: "narrative spike" },
  ],
  Corphishcoin: [
    { url: "https://x.com/Corphishcoin/status/2028150225601179871", label: "CA drop" },
  ],
  DonWedge: [
    { url: "https://x.com/DonWedge/status/2028102858265202870", label: "domain risk" },
    { url: "https://x.com/DonWedge/status/2028090925613043816", label: "domain risk" },
  ],
  SilverSoul_Ag: [
    { url: "https://x.com/SilverSoul_Ag/status/2028136465973035069", label: "CA drop" },
  ],
  IronShield_Zion: [
    { url: "https://x.com/IronShield_Zion/status/2028126188926058758", label: "CA drop" },
  ],
  DeeNowback: [
    { url: "https://x.com/DeeNowback/status/2028040845375778875", label: "CTA dangerous" },
  ],
  Claude_Memory: [
    { url: "https://x.com/Claude_Memory/status/2026587002502566161", label: "airdrop CTA" },
  ],
  JamesWynnReal: [
    { url: "https://x.com/JamesWynnReal/status/2024852530048733576", label: "narrative spike" },
  ],
  GordonGekko: [
    { url: "https://x.com/GordonGekko/status/2028173607608676745", label: "CTA" },
    { url: "https://x.com/GordonGekko/status/2028170329445511639", label: "buy-pressure" },
  ],
  aaronschwen: [
    { url: "https://x.com/aaronschwen/status/2026945058977775757", label: "domain risk" },
  ],
  SOLASTRONAUT01: [
    { url: "https://x.com/SOLASTRONAUT01/status/2028026191282635017", label: "CA drop" },
  ],
  MustStopMurad: [
    { url: "https://x.com/MustStopMurad/status/2028150914197127182", label: "narrative spike" },
    { url: "https://x.com/MustStopMurad/status/2027469717695508938", label: "narrative spike" },
  ],
};

const COMMON_WORDS = new Set(["the","and","for","this","that","with","from","your","have","just","been","more","will","into","they","their","when","what","all","but","not","are","was","can","out","one","you","our","has","his","her","its","who","him","she","any","may","use"]);
const CTA_KEYWORDS = ["claim","airdrop","drop your","send sol","connect","presale","pump.fun","approve","wallet"];

export interface ExtractedEntities {
  evmContracts: string[];
  solanaCandidates: string[];
  urls: string[];
  domains: string[];
  ctaKeywords: string[];
}

export function extractEntities(text: string): ExtractedEntities {
  const evmContracts = [...new Set((text.match(/0x[0-9a-fA-F]{40}/g) ?? []).map((s) => s.toLowerCase()))];
  const solRe = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const solanaCandidates = [...new Set((text.match(solRe) ?? []).filter((s) => /\d/.test(s) && !COMMON_WORDS.has(s.toLowerCase())))];
  const urls = [...new Set(text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [])];
  const domains = [...new Set(urls.map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }).filter(Boolean) as string[])];
  const lower = text.toLowerCase();
  const ctaKeywords = CTA_KEYWORDS.filter((kw) => lower.includes(kw));
  return { evmContracts, solanaCandidates, urls, domains, ctaKeywords };
}

export interface DerivedSignals {
  ctaDangerous: boolean;
  domainRisk: boolean;
  caDetected: boolean;
  narrativeSpike: boolean;
}

export function deriveSignalsFromProofUrl(url: string, label?: string): DerivedSignals {
  const lower = (url + " " + (label ?? "")).toLowerCase();
  return {
    ctaDangerous: lower.includes("send sol") || lower.includes("drop your") || lower.includes("airdrop") || lower.includes("claim") || lower.includes("cta"),
    domainRisk: lower.includes("pump.fun") || lower.includes("domain"),
    caDetected: lower.includes("ca drop") || lower.includes("ca detected") || lower.includes("presale"),
    narrativeSpike: lower.includes("narrative"),
  };
}

export function aggregateSignalsForHandle(handle: string): DerivedSignals {
  const proofs = DEMO_PROOFS[handle] ?? [];
  const merged: DerivedSignals = { ctaDangerous: false, domainRisk: false, caDetected: false, narrativeSpike: false };
  for (const proof of proofs) {
    const s = deriveSignalsFromProofUrl(proof.url, proof.label);
    merged.ctaDangerous = merged.ctaDangerous || s.ctaDangerous;
    merged.domainRisk = merged.domainRisk || s.domainRisk;
    merged.caDetected = merged.caDetected || s.caDetected;
    merged.narrativeSpike = merged.narrativeSpike || s.narrativeSpike;
  }
  return merged;
}

export function signalPriority(s: DerivedSignals): number {
  return (s.ctaDangerous ? 8 : 0) + (s.domainRisk ? 4 : 0) + (s.caDetected ? 2 : 0) + (s.narrativeSpike ? 1 : 0);
}
