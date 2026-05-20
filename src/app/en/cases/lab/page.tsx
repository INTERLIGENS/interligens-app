import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TokenCasefileView, {
  type TokenCasefileData,
  type TokenCasefileFounder,
  type TokenCasefileKeyWallet,
  type TokenCasefileSource,
} from "@/components/cases/TokenCasefileView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LAB ($LAB) — The $63M Pre-Pump Deposits Retail Never Saw · INTERLIGENS",
  description:
    "Token Fraud casefile IL-PND-LAB-001. Pump-and-dump / insider supply control on BNB Chain. 68.75% of LAB supply locked in 5 Gnosis Safes — independently verified on-chain by INTERLIGENS.",
  openGraph: {
    title: "LAB ($LAB) — TigerScore 91 · AVOID · INTERLIGENS",
    description:
      "Joint Specter × INTERLIGENS casefile. 68.75% supply concentration verified on-chain.",
  },
};

const REF = "IL-PND-LAB-001";

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asRecord(v: unknown): Record<string, string | null> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string | null> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
    else if (val === null) out[k] = null;
  }
  return out;
}
function asFounders(v: unknown): TokenCasefileFounder[] {
  if (!Array.isArray(v)) return [];
  return v.map((f) => {
    const r = (f ?? {}) as Record<string, unknown>;
    return {
      name: String(r.name ?? ""),
      handle: String(r.handle ?? ""),
      location: (r.location as string) ?? null,
      priorProject: (r.priorProject as string) ?? null,
    };
  });
}
function asKeyWallets(v: unknown): TokenCasefileKeyWallet[] {
  if (!Array.isArray(v)) return [];
  return v.map((w) => {
    const r = (w ?? {}) as Record<string, unknown>;
    return {
      role: String(r.role ?? ""),
      address: String(r.address ?? ""),
      holdingLab: (r.holdingLab as string) ?? null,
    };
  });
}
function asSources(v: unknown): TokenCasefileSource[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => {
    const r = (s ?? {}) as Record<string, unknown>;
    return {
      investigator: String(r.investigator ?? ""),
      date: String(r.date ?? ""),
      url: (r.url as string) ?? null,
      note: (r.note as string) ?? null,
    };
  });
}
function bigToNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return null;
}
function decToNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  // Prisma.Decimal has .toNumber()
  const d = v as { toNumber?: () => number };
  if (typeof d.toNumber === "function") return d.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getLab(): Promise<TokenCasefileData | null> {
  try {
    const r = await prisma.tokenCaseFile.findUnique({ where: { ref: REF } });
    if (!r || r.publishStatus !== "published") return null;
    return {
      ref: r.ref,
      codename: r.codename,
      ticker: r.ticker,
      title: r.title,
      family: r.family,
      subtype: r.subtype,
      tigerScore: r.tigerScore,
      verdict: r.verdict,
      status: r.status,
      statusNote: r.statusNote,
      primaryChain: r.primaryChain,
      secondaryChains: asStringArray(r.secondaryChains),
      contractAddresses: asRecord(r.contractAddresses),
      tokenName: r.tokenName,
      decimals: r.decimals,
      totalSupply: r.totalSupply,
      circulatingSupply: r.circulatingSupply,
      ath: decToNum(r.ath),
      atl: decToNum(r.atl),
      fdvPeakUsd: bigToNum(r.fdvPeakUsd),
      marketCapMinUsd: bigToNum(r.marketCapMinUsd),
      marketCapMaxUsd: bigToNum(r.marketCapMaxUsd),
      tgeDate: r.tgeDate ? r.tgeDate.toISOString().slice(0, 10) : null,
      claimedRaiseUsd: r.claimedRaiseUsd,
      backers: asStringArray(r.backers),
      founders: asFounders(r.founders),
      exchanges: asStringArray(r.exchanges),
      exitExchanges: asStringArray(r.exitExchanges),
      keyWallets: asKeyWallets(r.keyWallets),
      linkedTokens: asStringArray(r.linkedTokens),
      estimatedRetailHarmUsd: bigToNum(r.estimatedRetailHarmUsd),
      currency: r.currency,
      sources: asSources(r.sources),
      specterCollab: r.specterCollab,
      publishedDate: r.publishedDate ? r.publishedDate.toISOString().slice(0, 10) : null,
      summary: r.summary,
      summaryFr: r.summaryFr,
      bodyMarkdown: r.bodyMarkdown,
    };
  } catch {
    // token_casefiles table missing or DB unreachable -> treat as not found.
    return null;
  }
}

export default async function LabCasePageEN() {
  const data = await getLab();
  if (!data) notFound();
  return <TokenCasefileView data={data} locale="en" />;
}
